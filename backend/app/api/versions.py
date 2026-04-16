"""Version history endpoints"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import not_

from ..models import Document, DocumentVersion, DocumentCollaborator, EditLog
from ..services.transaction_manager import TransactionManager
from ..services.diff_engine import DiffEngine
from ..schemas.document_schema import DocumentVersionSchema
from ..extensions import db

versions_bp = Blueprint('versions', __name__)
transaction_manager = TransactionManager()
diff_engine = DiffEngine()


def _current_user_id():
    return int(get_jwt_identity())


def _can_access_document(document, user_id, require_edit=False):
    if document.is_deleted:
        return False

    if document.created_by == user_id:
        return True

    collaborator = DocumentCollaborator.query.filter_by(
        doc_id=document.doc_id,
        user_id=user_id
    ).first()

    if not collaborator:
        return False
    return not require_edit or collaborator.permission in ('edit', 'owner')


def _emit_document_saved(doc_id, version, user_id):
    from ..extensions import socketio
    from ..models import User

    user = User.query.get(user_id)
    socketio.emit('document_saved', {
        'document_id': doc_id,
        'version_id': version.version_id,
        'version_number': version.version_number,
        'user_id': user_id,
        'user_name': user.name if user else f'User {user_id}',
        'content': version.content,
        'last_version_id': version.version_id,
        'updated_at': version.document.updated_at.isoformat() if version.document.updated_at else None,
        'is_saved_version': version.is_saved_version
    }, room=f'document_{doc_id}')

@versions_bp.route('/document/<int:doc_id>', methods=['GET'])
@jwt_required()
def get_version_history(doc_id):
    """Get version history for a document"""
    try:
        current_user_id = _current_user_id()
        
        # Verify document access
        document = Document.query.filter_by(
            doc_id=doc_id,
            is_deleted=False
        ).first()
        
        if not document:
            return jsonify({'error': 'Document not found'}), 404
        
        if not _can_access_document(document, current_user_id):
            return jsonify({'error': 'Access denied'}), 403
        
        # Get pagination parameters
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        
        # Query only explicit saved versions, not autosaves
        versions_query = DocumentVersion.query.filter(
            DocumentVersion.doc_id == doc_id,
            DocumentVersion.is_saved_version.is_(True),
            not_(
                (DocumentVersion.version_number == 1) &
                (DocumentVersion.change_summary == 'Initial version') &
                (DocumentVersion.content == '')
            )
        )\
            .order_by(DocumentVersion.timestamp.desc())
        
        paginated_versions = versions_query.paginate(
            page=page, 
            per_page=per_page, 
            error_out=False
        )
        
        schema = DocumentVersionSchema(many=True)
        
        return jsonify({
            'versions': schema.dump(paginated_versions.items),
            'total': paginated_versions.total,
            'page': page,
            'pages': paginated_versions.pages,
            'per_page': per_page
        }), 200
        
    except Exception as e:
        return jsonify({'error': 'Failed to fetch versions', 'message': str(e)}), 400


@versions_bp.route('/document/<int:doc_id>/save', methods=['POST'])
@jwt_required()
def save_named_version(doc_id):
    """Create an explicit saved version, like a git commit."""
    try:
        current_user_id = _current_user_id()
        document = Document.query.filter_by(doc_id=doc_id, is_deleted=False).first()

        if not document:
            return jsonify({'error': 'Document not found'}), 404

        if not _can_access_document(document, current_user_id, require_edit=True):
            return jsonify({'error': 'Access denied'}), 403

        data = request.get_json() or {}
        content = data.get('content', document.content)
        summary = (data.get('change_summary') or '').strip() or 'Saved version'

        new_version, conflict_info = transaction_manager.save_document_version(
            doc_id=doc_id,
            user_id=current_user_id,
            new_content=content,
            base_version_id=data.get('base_version_id'),
            change_summary=summary,
            is_saved_version=True
        )

        _emit_document_saved(doc_id, new_version, current_user_id)

        return jsonify({
            'message': 'Version saved successfully',
            'version_id': new_version.version_id,
            'version_number': new_version.version_number,
            'conflict_info': conflict_info
        }), 201
    except ValueError as e:
        return jsonify({'error': 'Document not found', 'message': str(e)}), 404
    except Exception as e:
        return jsonify({'error': 'Failed to save version', 'message': str(e)}), 400

@versions_bp.route('/<int:version_id>', methods=['GET'])
@jwt_required()
def get_version(version_id):
    """Get a specific version with full content"""
    try:
        current_user_id = _current_user_id()
        
        version = DocumentVersion.query.get(version_id)
        
        if not version:
            return jsonify({'error': 'Version not found'}), 404
        
        # Verify document access
        if not _can_access_document(version.document, current_user_id):
            return jsonify({'error': 'Access denied'}), 403
        
        schema = DocumentVersionSchema()
        return jsonify(schema.dump(version)), 200
        
    except Exception as e:
        return jsonify({'error': 'Failed to fetch version', 'message': str(e)}), 400

@versions_bp.route('/<int:version_id>/diff/<int:compare_version_id>', methods=['GET'])
@jwt_required()
def get_version_diff(version_id, compare_version_id):
    """Get diff between two versions"""
    try:
        current_user_id = _current_user_id()
        
        version1 = DocumentVersion.query.get(version_id)
        version2 = DocumentVersion.query.get(compare_version_id)
        
        if not version1 or not version2:
            return jsonify({'error': 'Version not found'}), 404
        
        if version1.doc_id != version2.doc_id:
            return jsonify({'error': 'Versions belong to different documents'}), 400
        
        # Verify access
        if not _can_access_document(version1.document, current_user_id):
            return jsonify({'error': 'Access denied'}), 403
        
        # Generate diff
        diffs = diff_engine.compute_diff(version1.content, version2.content)
        
        # Convert to readable format
        diff_data = []
        for op, text in diffs:
            op_name = 'equal'
            if op == -1:
                op_name = 'delete'
            elif op == 1:
                op_name = 'insert'
            
            diff_data.append({
                'operation': op_name,
                'text': text
            })
        
        return jsonify({
            'version1_id': version_id,
            'version2_id': compare_version_id,
            'diff': diff_data
        }), 200
        
    except Exception as e:
        return jsonify({'error': 'Failed to generate diff', 'message': str(e)}), 400

@versions_bp.route('/document/<int:doc_id>/rollback/<int:version_id>', methods=['POST'])
@jwt_required()
def rollback_to_version(doc_id, version_id):
    """Rollback document to a previous version"""
    try:
        current_user_id = _current_user_id()
        
        # Verify document access
        document = Document.query.filter_by(
            doc_id=doc_id,
            is_deleted=False
        ).first()
        
        if not document:
            return jsonify({'error': 'Document not found'}), 404
        
        if not _can_access_document(document, current_user_id, require_edit=True):
            return jsonify({'error': 'Access denied'}), 403

        target_version = DocumentVersion.query.filter(
            DocumentVersion.doc_id == doc_id,
            DocumentVersion.version_id == version_id,
            DocumentVersion.is_saved_version.is_(True),
            not_(
                (DocumentVersion.version_number == 1) &
                (DocumentVersion.change_summary == 'Initial version') &
                (DocumentVersion.content == '')
            )
        ).first()
        if not target_version:
            return jsonify({'error': 'Rollback failed', 'message': 'Only saved versions can be restored'}), 404
        
        # Perform rollback
        new_version = transaction_manager.rollback_to_version(
            doc_id=doc_id,
            version_id=version_id,
            user_id=current_user_id
        )
        _emit_document_saved(doc_id, new_version, current_user_id)
        
        return jsonify({
            'message': 'Successfully rolled back',
            'new_version_id': new_version.version_id,
            'version_number': new_version.version_number
        }), 200
        
    except ValueError as e:
        return jsonify({'error': 'Rollback failed', 'message': str(e)}), 404
    except Exception as e:
        return jsonify({'error': 'Rollback failed', 'message': str(e)}), 400


@versions_bp.route('/<int:version_id>', methods=['DELETE'])
@jwt_required()
def delete_saved_version(version_id):
    """Delete a saved version. Only the real document owner can do this."""
    try:
        current_user_id = _current_user_id()
        version = DocumentVersion.query.get(version_id)

        if not version:
            return jsonify({'error': 'Version not found'}), 404

        document = version.document
        if document.created_by != current_user_id:
            return jsonify({'error': 'Only the real owner can delete saved versions'}), 403
        if not version.is_saved_version:
            return jsonify({'error': 'Only saved versions can be deleted'}), 400
        if document.last_version_id == version.version_id:
            return jsonify({'error': 'Cannot delete the current active version'}), 400

        EditLog.query.filter_by(version_id=version.version_id).update({'version_id': None})

        db.session.delete(version)
        db.session.add(EditLog(
            doc_id=document.doc_id,
            user_id=current_user_id,
            operation='DELETE_SAVED_VERSION',
            metadata_json={'deleted_version_id': version_id}
        ))
        db.session.commit()

        return jsonify({'message': 'Saved version deleted'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to delete saved version', 'message': str(e)}), 400

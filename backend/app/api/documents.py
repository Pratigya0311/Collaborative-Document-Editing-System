"""Document management endpoints"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import or_
import hashlib

from ..extensions import db, socketio
from ..models import Document, DocumentVersion, EditLog, User, DocumentCollaborator
from ..services.transaction_manager import TransactionManager
from ..schemas.document_schema import (
    DocumentSchema, 
    CreateDocumentRequest, 
    UpdateDocumentRequest
)
from ..utils.decorators import token_required

documents_bp = Blueprint('documents', __name__)
transaction_manager = TransactionManager()


def _current_user_id():
    return int(get_jwt_identity())


def _document_permission(document, user_id):
    if document.created_by == user_id:
        return 'owner'

    collaborator = DocumentCollaborator.query.filter_by(
        doc_id=document.doc_id,
        user_id=user_id
    ).first()

    return collaborator.permission if collaborator else None


def _can_access_document(doc_id, user_id, require_edit=False):
    document = Document.query.filter_by(doc_id=doc_id, is_deleted=False).first()
    if not document:
        return None, False

    permission = _document_permission(document, user_id)
    if not permission:
        return document, False

    if require_edit and permission not in ('edit', 'owner'):
        return document, False

    return document, True


def _can_share_document(document, user_id):
    return _document_permission(document, user_id) == 'owner'


def _serialize_document(document, user_id):
    data = DocumentSchema().dump(document)
    permission = _document_permission(document, user_id)
    data['current_user_permission'] = permission
    data['can_edit'] = permission in ('edit', 'owner')
    data['can_share'] = permission == 'owner'
    return data

@documents_bp.route('/', methods=['GET'])
@jwt_required()
def get_documents():
    """Get all documents for current user"""
    try:
        current_user_id = _current_user_id()
        
        documents = Document.query.outerjoin(
            DocumentCollaborator,
            Document.doc_id == DocumentCollaborator.doc_id
        ).filter(
            Document.is_deleted.is_(False),
            or_(
                Document.created_by == current_user_id,
                DocumentCollaborator.user_id == current_user_id
            )
        ).order_by(Document.updated_at.desc()).all()
        
        return jsonify([
            _serialize_document(document, current_user_id)
            for document in documents
        ]), 200
        
    except Exception as e:
        return jsonify({'error': 'Failed to fetch documents', 'message': str(e)}), 400

@documents_bp.route('/', methods=['POST'])
@jwt_required()
def create_document():
    """Create a new document"""
    try:
        current_user_id = _current_user_id()
        
        # Validate request
        schema = CreateDocumentRequest()
        data = schema.load(request.json)
        
        content = data.get('content') or ''

        document = Document(
            title=data['title'],
            content=content,
            created_by=current_user_id
        )
        
        db.session.add(document)
        db.session.flush()
        
        # Create initial version
        version = DocumentVersion(
            doc_id=document.doc_id,
            content=document.content,
            edited_by=current_user_id,
            version_number=1,
            change_summary='Initial version',
            content_hash=hashlib.sha256(content.encode()).hexdigest()
        )
        
        db.session.add(version)
        db.session.flush()
        
        document.last_version_id = version.version_id
        
        # Log creation
        log = EditLog(
            doc_id=document.doc_id,
            user_id=current_user_id,
            operation='INSERT',
            version_id=version.version_id,
            metadata_json={'action': 'document_created'}
        )
        
        db.session.add(log)
        db.session.commit()
        
        return jsonify(_serialize_document(document, current_user_id)), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to create document', 'message': str(e)}), 400

@documents_bp.route('/<int:doc_id>', methods=['GET'])
@jwt_required()
def get_document(doc_id):
    """Get a specific document"""
    try:
        current_user_id = _current_user_id()
        document, allowed = _can_access_document(doc_id, current_user_id)
        
        if not document:
            return jsonify({'error': 'Document not found'}), 404
        
        if not allowed:
            return jsonify({'error': 'Access denied'}), 403
        
        return jsonify(_serialize_document(document, current_user_id)), 200
        
    except Exception as e:
        return jsonify({'error': 'Failed to fetch document', 'message': str(e)}), 400

@documents_bp.route('/<int:doc_id>', methods=['PUT'])
@jwt_required()
def update_document(doc_id):
    """
    Update document with transaction control and conflict detection.
    This is the CORE endpoint demonstrating DBMS ACID properties.
    """
    try:
        current_user_id = _current_user_id()
        
        # Validate request
        schema = UpdateDocumentRequest()
        data = schema.load(request.json)
        
        document, allowed = _can_access_document(doc_id, current_user_id, require_edit=True)
        if not document:
            return jsonify({'error': 'Document not found'}), 404
        if not allowed:
            return jsonify({'error': 'Access denied'}), 403

        new_version, conflict_info = transaction_manager.save_document_version(
            doc_id=doc_id,
            user_id=current_user_id,
            new_content=data['content'],
            base_version_id=data.get('base_version_id'),
            change_summary=data.get('change_summary', ''),
            title=data.get('title')
        )
        
        response_data = {
            'message': 'Document updated successfully',
            'version_id': new_version.version_id,
            'version_number': new_version.version_number,
            'conflict_info': conflict_info
        }
        
        # Return 409 Conflict if merge was not automatic
        if conflict_info['detected'] and not conflict_info['resolved']:
            return jsonify(response_data), 409

        user = User.query.get(current_user_id)
        socketio.emit('document_saved', {
            'document_id': doc_id,
            'version_id': new_version.version_id,
            'version_number': new_version.version_number,
            'user_id': current_user_id,
            'user_name': user.name if user else f'User {current_user_id}',
            'content': new_version.content,
            'last_version_id': new_version.version_id,
            'updated_at': document.updated_at.isoformat() if document.updated_at else None,
        }, room=f'document_{doc_id}')
        
        return jsonify(response_data), 200
        
    except ValueError as e:
        return jsonify({'error': 'Document not found', 'message': str(e)}), 404
    except Exception as e:
        return jsonify({'error': 'Failed to update document', 'message': str(e)}), 400

@documents_bp.route('/<int:doc_id>', methods=['DELETE'])
@jwt_required()
def delete_document(doc_id):
    """Soft delete a document"""
    try:
        current_user_id = _current_user_id()
        
        document = Document.query.filter_by(
            doc_id=doc_id,
            created_by=current_user_id
        ).first()
        
        if not document:
            return jsonify({'error': 'Document not found'}), 404
        
        document.is_deleted = True
        
        # Log deletion
        log = EditLog(
            doc_id=doc_id,
            user_id=current_user_id,
            operation='DELETE'
        )
        
        db.session.add(log)
        db.session.commit()
        
        return jsonify({'message': 'Document deleted successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to delete document', 'message': str(e)}), 400


@documents_bp.route('/<int:doc_id>/collaborators', methods=['GET'])
@jwt_required()
def get_collaborators(doc_id):
    """List collaborators for a document."""
    current_user_id = _current_user_id()
    document, allowed = _can_access_document(doc_id, current_user_id)

    if not document:
        return jsonify({'error': 'Document not found'}), 404
    if not allowed:
        return jsonify({'error': 'Access denied'}), 403

    collaborators = DocumentCollaborator.query.filter_by(doc_id=doc_id).all()
    return jsonify([collaborator.to_dict() for collaborator in collaborators]), 200


@documents_bp.route('/<int:doc_id>/collaborators', methods=['POST'])
@jwt_required()
def add_collaborator(doc_id):
    """Share a document with another user by email."""
    try:
        current_user_id = _current_user_id()
        document, allowed = _can_access_document(doc_id, current_user_id)

        if not document:
            return jsonify({'error': 'Document not found'}), 404
        if not allowed or not _can_share_document(document, current_user_id):
            return jsonify({'error': 'Only owners can share this document'}), 403

        data = request.get_json() or {}
        email = (data.get('email') or '').strip().lower()
        permission = data.get('permission', 'edit')

        if permission not in ('view', 'edit', 'owner'):
            return jsonify({'error': 'Invalid permission', 'message': 'Use view, edit, or owner'}), 400

        user = User.query.filter_by(email=email, is_active=True).first()
        if not user:
            return jsonify({'error': 'User not found'}), 404
        if user.user_id == current_user_id:
            return jsonify({'error': 'Owner already has access'}), 400

        collaborator = DocumentCollaborator.query.filter_by(
            doc_id=doc_id,
            user_id=user.user_id
        ).first()

        if collaborator:
            collaborator.permission = permission
        else:
            collaborator = DocumentCollaborator(
                doc_id=doc_id,
                user_id=user.user_id,
                permission=permission,
                added_by=current_user_id
            )
            db.session.add(collaborator)

        db.session.add(EditLog(
            doc_id=doc_id,
            user_id=current_user_id,
            operation='SHARE',
            metadata_json={'shared_with': email, 'permission': permission}
        ))
        db.session.commit()

        return jsonify(collaborator.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to add collaborator', 'message': str(e)}), 400

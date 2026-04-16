"""Version history endpoints"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from ..models import Document, DocumentVersion
from ..services.transaction_manager import TransactionManager
from ..services.diff_engine import DiffEngine
from ..schemas.document_schema import DocumentVersionSchema

versions_bp = Blueprint('versions', __name__)
transaction_manager = TransactionManager()
diff_engine = DiffEngine()

@versions_bp.route('/document/<int:doc_id>', methods=['GET'])
@jwt_required()
def get_version_history(doc_id):
    """Get version history for a document"""
    try:
        current_user_id = get_jwt_identity()
        
        # Verify document access
        document = Document.query.filter_by(
            doc_id=doc_id,
            is_deleted=False
        ).first()
        
        if not document:
            return jsonify({'error': 'Document not found'}), 404
        
        if document.created_by != current_user_id:
            return jsonify({'error': 'Access denied'}), 403
        
        # Get pagination parameters
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        
        # Query versions
        versions_query = DocumentVersion.query.filter_by(doc_id=doc_id)\
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

@versions_bp.route('/<int:version_id>', methods=['GET'])
@jwt_required()
def get_version(version_id):
    """Get a specific version with full content"""
    try:
        current_user_id = get_jwt_identity()
        
        version = DocumentVersion.query.get(version_id)
        
        if not version:
            return jsonify({'error': 'Version not found'}), 404
        
        # Verify document access
        if version.document.created_by != current_user_id:
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
        current_user_id = get_jwt_identity()
        
        version1 = DocumentVersion.query.get(version_id)
        version2 = DocumentVersion.query.get(compare_version_id)
        
        if not version1 or not version2:
            return jsonify({'error': 'Version not found'}), 404
        
        if version1.doc_id != version2.doc_id:
            return jsonify({'error': 'Versions belong to different documents'}), 400
        
        # Verify access
        if version1.document.created_by != current_user_id:
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
        current_user_id = get_jwt_identity()
        
        # Verify document access
        document = Document.query.filter_by(
            doc_id=doc_id,
            is_deleted=False
        ).first()
        
        if not document:
            return jsonify({'error': 'Document not found'}), 404
        
        if document.created_by != current_user_id:
            return jsonify({'error': 'Access denied'}), 403
        
        # Perform rollback
        new_version = transaction_manager.rollback_to_version(
            doc_id=doc_id,
            version_id=version_id,
            user_id=current_user_id
        )
        
        return jsonify({
            'message': 'Successfully rolled back',
            'new_version_id': new_version.version_id,
            'version_number': new_version.version_number
        }), 200
        
    except ValueError as e:
        return jsonify({'error': 'Rollback failed', 'message': str(e)}), 404
    except Exception as e:
        return jsonify({'error': 'Rollback failed', 'message': str(e)}), 400
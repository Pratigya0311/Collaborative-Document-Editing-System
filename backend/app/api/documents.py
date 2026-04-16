"""Document management endpoints"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import and_

from ..extensions import db
from ..models import Document, DocumentVersion, EditLog, User
from ..services.transaction_manager import TransactionManager
from ..schemas.document_schema import (
    DocumentSchema, 
    CreateDocumentRequest, 
    UpdateDocumentRequest
)
from ..utils.decorators import token_required

documents_bp = Blueprint('documents', __name__)
transaction_manager = TransactionManager()

@documents_bp.route('/', methods=['GET'])
@jwt_required()
def get_documents():
    """Get all documents for current user"""
    try:
        current_user_id = get_jwt_identity()
        
        # Get documents created by user
        documents = Document.query.filter_by(
            created_by=current_user_id,
            is_deleted=False
        ).order_by(Document.updated_at.desc()).all()
        
        schema = DocumentSchema(many=True)
        return jsonify(schema.dump(documents)), 200
        
    except Exception as e:
        return jsonify({'error': 'Failed to fetch documents', 'message': str(e)}), 400

@documents_bp.route('/', methods=['POST'])
@jwt_required()
def create_document():
    """Create a new document"""
    try:
        current_user_id = get_jwt_identity()
        
        # Validate request
        schema = CreateDocumentRequest()
        data = schema.load(request.json)
        
        # Create document
        document = Document(
            title=data['title'],
            content=data.get('content', ''),
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
            change_summary='Initial version'
        )
        
        db.session.add(version)
        db.session.flush()
        
        document.last_version_id = version.version_id
        
        # Log creation
        log = EditLog(
            doc_id=document.doc_id,
            user_id=current_user_id,
            operation='INSERT',
            version_id=version.version_id
        )
        
        db.session.add(log)
        db.session.commit()
        
        doc_schema = DocumentSchema()
        return jsonify(doc_schema.dump(document)), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to create document', 'message': str(e)}), 400

@documents_bp.route('/<int:doc_id>', methods=['GET'])
@jwt_required()
def get_document(doc_id):
    """Get a specific document"""
    try:
        current_user_id = get_jwt_identity()
        
        document = Document.query.filter_by(
            doc_id=doc_id,
            is_deleted=False
        ).first()
        
        if not document:
            return jsonify({'error': 'Document not found'}), 404
        
        # Check access (in production, implement sharing logic)
        if document.created_by != current_user_id:
            return jsonify({'error': 'Access denied'}), 403
        
        schema = DocumentSchema()
        return jsonify(schema.dump(document)), 200
        
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
        current_user_id = get_jwt_identity()
        
        # Validate request
        schema = UpdateDocumentRequest()
        data = schema.load(request.json)
        
        # Use transaction manager for ACID-compliant update
        new_version, conflict_info = transaction_manager.save_document_version(
            doc_id=doc_id,
            user_id=current_user_id,
            new_content=data['content'],
            base_version_id=data.get('base_version_id'),
            change_summary=data.get('change_summary', '')
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
        current_user_id = get_jwt_identity()
        
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
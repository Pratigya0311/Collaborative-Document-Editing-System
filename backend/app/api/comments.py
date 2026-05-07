"""Selected-text comments endpoints."""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from ..extensions import db, socketio
from ..models import Document, DocumentCollaborator, DocumentComment, EditLog, User
from ..services.annotation_service import AnnotationService
from ..services.transaction_manager import TransactionManager

comments_bp = Blueprint('comments', __name__)
annotation_service = AnnotationService()
transaction_manager = TransactionManager()


def _current_user_id():
    return int(get_jwt_identity())


def _can_access_document(document, user_id, require_edit=False):
    if not document or document.is_deleted:
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


def _emit_comment_update(doc_id, version, user_id, action):
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
        'annotation_action': action,
    }, room=f'document_{doc_id}')


@comments_bp.route('/document/<int:doc_id>', methods=['GET'])
@jwt_required()
def list_comments(doc_id):
    current_user_id = _current_user_id()
    document = Document.query.filter_by(doc_id=doc_id, is_deleted=False).first()

    if not document:
        return jsonify({'error': 'Document not found'}), 404
    if not _can_access_document(document, current_user_id):
        return jsonify({'error': 'Access denied'}), 403

    comments = DocumentComment.query.filter_by(doc_id=doc_id).order_by(DocumentComment.created_at.asc()).all()
    return jsonify([comment.to_dict() for comment in comments]), 200


@comments_bp.route('/document/<int:doc_id>', methods=['POST'])
@jwt_required()
def create_comment(doc_id):
    current_user_id = _current_user_id()
    document = Document.query.filter_by(doc_id=doc_id, is_deleted=False).first()

    if not document:
        return jsonify({'error': 'Document not found'}), 404
    if not _can_access_document(document, current_user_id, require_edit=True):
        return jsonify({'error': 'Access denied'}), 403

    data = request.get_json() or {}
    content = data.get('content', '')
    anchor_id = (data.get('anchor_id') or '').strip()
    body = (data.get('body') or '').strip()

    if not anchor_id or not body:
        return jsonify({'error': 'Invalid request', 'message': 'anchor_id and body are required'}), 400

    anchor = annotation_service.find_span(content, annotation_service.COMMENT_ATTR, anchor_id)
    if not anchor:
        return jsonify({'error': 'Invalid request', 'message': 'Selected text anchor was not found'}), 400

    try:
        new_version, _ = transaction_manager.save_document_version(
            doc_id=doc_id,
            user_id=current_user_id,
            new_content=content,
            base_version_id=data.get('base_version_id'),
            change_summary='Added selected-text comment',
            is_saved_version=False
        )

        comment = DocumentComment(
            doc_id=doc_id,
            user_id=current_user_id,
            anchor_id=anchor_id,
            selected_text=anchor['text'],
            body=body
        )
        db.session.add(comment)
        db.session.add(EditLog(
            doc_id=doc_id,
            user_id=current_user_id,
            operation='COMMENT_ADD',
            version_id=new_version.version_id,
            metadata_json={'anchor_id': anchor_id, 'selected_text': anchor['text']}
        ))
        db.session.commit()

        _emit_comment_update(doc_id, new_version, current_user_id, 'comment_added')
        return jsonify({
            'comment': comment.to_dict(),
            'version_id': new_version.version_id,
            'version_number': new_version.version_number
        }), 201
    except PermissionError as e:
        db.session.rollback()
        return jsonify({'error': 'Locked text', 'message': str(e)}), 423
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to create comment', 'message': str(e)}), 400


@comments_bp.route('/<int:comment_id>', methods=['DELETE'])
@jwt_required()
def delete_comment(comment_id):
    current_user_id = _current_user_id()
    comment = DocumentComment.query.get(comment_id)

    if not comment:
        return jsonify({'error': 'Comment not found'}), 404

    document = Document.query.filter_by(doc_id=comment.doc_id, is_deleted=False).first()
    if not document:
        return jsonify({'error': 'Document not found'}), 404

    if not _can_access_document(document, current_user_id, require_edit=True):
        return jsonify({
            'error': 'Access denied',
            'message': 'You need edit access to delete comments.'
        }), 403

    data = request.get_json() or {}
    content = data.get('content', '')
    remaining_anchor_comments = DocumentComment.query.filter(
        DocumentComment.doc_id == comment.doc_id,
        DocumentComment.anchor_id == comment.anchor_id,
        DocumentComment.comment_id != comment.comment_id
    ).count()

    if remaining_anchor_comments == 0:
        content = annotation_service.unwrap_span(
            content,
            annotation_service.COMMENT_ATTR,
            comment.anchor_id
        )

    try:
        new_version, _ = transaction_manager.save_document_version(
            doc_id=comment.doc_id,
            user_id=current_user_id,
            new_content=content,
            base_version_id=data.get('base_version_id'),
            change_summary='Removed selected-text comment',
            is_saved_version=False
        )

        db.session.delete(comment)
        db.session.add(EditLog(
            doc_id=document.doc_id,
            user_id=current_user_id,
            operation='COMMENT_DELETE',
            version_id=new_version.version_id,
            metadata_json={'comment_id': comment_id}
        ))
        db.session.commit()

        _emit_comment_update(document.doc_id, new_version, current_user_id, 'comment_deleted')
        return jsonify({
            'message': 'Comment deleted',
            'version_id': new_version.version_id,
            'version_number': new_version.version_number,
            'content': new_version.content
        }), 200
    except PermissionError as e:
        db.session.rollback()
        return jsonify({'error': 'Locked text', 'message': str(e)}), 423
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to delete comment', 'message': str(e)}), 400

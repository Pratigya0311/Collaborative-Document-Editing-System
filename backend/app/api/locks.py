"""Owner-managed selected-text lock endpoints."""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from ..extensions import db, socketio
from ..models import Document, DocumentCollaborator, DocumentLock, EditLog, User
from ..services.annotation_service import AnnotationService
from ..services.transaction_manager import TransactionManager

locks_bp = Blueprint('locks', __name__)
annotation_service = AnnotationService()
transaction_manager = TransactionManager()


def _current_user_id():
    return int(get_jwt_identity())


def _can_access_document(document, user_id):
    if not document or document.is_deleted:
        return False
    if document.created_by == user_id:
        return True
    return DocumentCollaborator.query.filter_by(doc_id=document.doc_id, user_id=user_id).first() is not None


def _emit_lock_update(doc_id, version, user_id, action):
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


@locks_bp.route('/document/<int:doc_id>', methods=['GET'])
@jwt_required()
def list_locks(doc_id):
    current_user_id = _current_user_id()
    document = Document.query.filter_by(doc_id=doc_id, is_deleted=False).first()

    if not document:
        return jsonify({'error': 'Document not found'}), 404
    if not _can_access_document(document, current_user_id):
        return jsonify({'error': 'Access denied'}), 403

    locks = DocumentLock.query.filter_by(doc_id=doc_id).order_by(DocumentLock.created_at.asc()).all()
    return jsonify([lock.to_dict() for lock in locks]), 200


@locks_bp.route('/document/<int:doc_id>', methods=['POST'])
@jwt_required()
def create_lock(doc_id):
    current_user_id = _current_user_id()
    document = Document.query.filter_by(doc_id=doc_id, is_deleted=False).first()

    if not document:
        return jsonify({'error': 'Document not found'}), 404
    if document.created_by != current_user_id:
        return jsonify({'error': 'Only the real owner can lock selected text'}), 403

    data = request.get_json() or {}
    content = data.get('content', '')
    lock_id = (data.get('lock_id') or '').strip()

    if not lock_id:
        return jsonify({'error': 'Invalid request', 'message': 'lock_id is required'}), 400

    if DocumentLock.query.filter_by(lock_id=lock_id).first():
        return jsonify({'error': 'Invalid request', 'message': 'Lock already exists'}), 400

    span = annotation_service.find_span(content, annotation_service.LOCK_ATTR, lock_id)
    if not span:
        return jsonify({'error': 'Invalid request', 'message': 'Locked text anchor was not found'}), 400

    try:
        new_version, _ = transaction_manager.save_document_version(
            doc_id=doc_id,
            user_id=current_user_id,
            new_content=content,
            base_version_id=data.get('base_version_id'),
            change_summary='Locked selected text',
            is_saved_version=False
        )

        new_lock = DocumentLock(
            lock_id=lock_id,
            doc_id=doc_id,
            created_by=current_user_id,
            selected_text=span['text'],
            selected_html=span['inner_html']
        )
        db.session.add(new_lock)
        db.session.add(EditLog(
            doc_id=doc_id,
            user_id=current_user_id,
            operation='LOCK_ADD',
            version_id=new_version.version_id,
            metadata_json={'lock_id': lock_id, 'selected_text': span['text']}
        ))
        db.session.commit()

        _emit_lock_update(doc_id, new_version, current_user_id, 'lock_added')
        return jsonify({
            'lock': new_lock.to_dict(),
            'version_id': new_version.version_id,
            'version_number': new_version.version_number
        }), 201
    except PermissionError as e:
        db.session.rollback()
        return jsonify({'error': 'Locked text', 'message': str(e)}), 423
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to lock text', 'message': str(e)}), 400


@locks_bp.route('/<string:lock_id>', methods=['DELETE'])
@jwt_required()
def delete_lock(lock_id):
    current_user_id = _current_user_id()
    lock = DocumentLock.query.get(lock_id)

    if not lock:
        return jsonify({'error': 'Lock not found'}), 404

    document = Document.query.filter_by(doc_id=lock.doc_id, is_deleted=False).first()
    if not document:
        return jsonify({'error': 'Document not found'}), 404
    if document.created_by != current_user_id:
        return jsonify({'error': 'Only the real owner can unlock selected text'}), 403

    data = request.get_json() or {}
    content = data.get('content', '')
    if annotation_service.find_span(content, annotation_service.LOCK_ATTR, lock.lock_id):
        return jsonify({'error': 'Invalid request', 'message': 'Locked highlight must be removed before unlocking'}), 400

    try:
        previous_lock_id = lock.lock_id
        new_version, _ = transaction_manager.save_document_version(
            doc_id=lock.doc_id,
            user_id=current_user_id,
            new_content=content,
            base_version_id=data.get('base_version_id'),
            change_summary='Unlocked selected text',
            is_saved_version=False,
            skip_lock_ids=[lock.lock_id]
        )

        db.session.delete(lock)
        db.session.add(EditLog(
            doc_id=document.doc_id,
            user_id=current_user_id,
            operation='LOCK_REMOVE',
            version_id=new_version.version_id,
            metadata_json={'lock_id': previous_lock_id}
        ))
        db.session.commit()

        _emit_lock_update(document.doc_id, new_version, current_user_id, 'lock_removed')
        return jsonify({
            'message': 'Text unlocked',
            'version_id': new_version.version_id,
            'version_number': new_version.version_number
        }), 200
    except PermissionError as e:
        db.session.rollback()
        return jsonify({'error': 'Locked text', 'message': str(e)}), 423
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to unlock text', 'message': str(e)}), 400

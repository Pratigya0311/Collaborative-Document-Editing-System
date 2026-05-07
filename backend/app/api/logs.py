"""Audit log endpoints."""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from ..models import EditLog, Document, DocumentCollaborator

logs_bp = Blueprint('logs', __name__)


@logs_bp.route('/', methods=['GET'])
@jwt_required()
def get_recent_logs():
    """Return recent audit logs for documents the current user can access."""
    try:
        current_user_id = int(get_jwt_identity())
        limit = min(request.args.get('limit', 10, type=int), 30)

        owned_doc_ids = [
            doc_id for (doc_id,) in Document.query.filter_by(
                created_by=current_user_id,
                is_deleted=False
            ).with_entities(Document.doc_id).all()
        ]
        shared_doc_ids = [
            doc_id for (doc_id,) in DocumentCollaborator.query.join(
                Document, DocumentCollaborator.doc_id == Document.doc_id
            ).filter(
                DocumentCollaborator.user_id == current_user_id,
                Document.is_deleted.is_(False)
            ).with_entities(DocumentCollaborator.doc_id).all()
        ]
        accessible_doc_ids = list(set(owned_doc_ids + shared_doc_ids))

        if not accessible_doc_ids:
            return jsonify([]), 200

        raw_logs = EditLog.query.join(
            Document, EditLog.doc_id == Document.doc_id
        ).filter(
            EditLog.doc_id.in_(accessible_doc_ids),
            Document.is_deleted.is_(False)
        ).order_by(EditLog.timestamp.desc()).limit(max(limit * 5, 30)).all()

        meaningful_logs = [
            log for log in raw_logs
            if not (
                log.operation == 'UPDATE' and
                not (log.metadata_json or {}).get('is_saved_version')
            )
        ]
        logs = (meaningful_logs or raw_logs)[:limit]

        return jsonify([
            {
                **log.to_dict(),
                'document_title': log.document.title if log.document else None,
                'document_owner_name': log.document.owner.name if log.document and log.document.owner else None
            }
            for log in logs
        ]), 200
    except Exception as e:
        return jsonify({'error': 'Failed to fetch logs', 'message': str(e)}), 400

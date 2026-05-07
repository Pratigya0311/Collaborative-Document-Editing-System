"""Locked text ranges owned by the real document owner."""
from datetime import datetime
from ..extensions import db


class DocumentLock(db.Model):
    """Immutable text selection inside a document."""
    __tablename__ = 'document_locks'

    lock_id = db.Column(db.String(64), primary_key=True)
    doc_id = db.Column(db.Integer, db.ForeignKey('documents.doc_id'), nullable=False, index=True)
    created_by = db.Column(db.Integer, db.ForeignKey('users.user_id'), nullable=False, index=True)
    selected_text = db.Column(db.Text, nullable=False)
    selected_html = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        db.Index('idx_lock_doc_created', 'doc_id', 'created_at'),
    )

    def to_dict(self):
        """Convert lock to JSON-safe dictionary."""
        return {
            'lock_id': self.lock_id,
            'doc_id': self.doc_id,
            'created_by': self.created_by,
            'created_by_name': self.creator.name if self.creator else None,
            'selected_text': self.selected_text,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }

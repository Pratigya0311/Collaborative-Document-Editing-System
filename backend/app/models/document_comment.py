"""Document comments anchored to selected text."""
from datetime import datetime
from ..extensions import db


class DocumentComment(db.Model):
    """Comment attached to a highlighted selection inside a document."""
    __tablename__ = 'document_comments'

    comment_id = db.Column(db.Integer, primary_key=True)
    doc_id = db.Column(db.Integer, db.ForeignKey('documents.doc_id'), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.user_id'), nullable=False, index=True)
    anchor_id = db.Column(db.String(64), nullable=False, unique=True, index=True)
    selected_text = db.Column(db.Text, nullable=False)
    body = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        db.Index('idx_comment_doc_created', 'doc_id', 'created_at'),
    )

    def to_dict(self):
        """Convert comment to JSON-safe dictionary."""
        return {
            'comment_id': self.comment_id,
            'doc_id': self.doc_id,
            'user_id': self.user_id,
            'user_name': self.user.name if self.user else None,
            'anchor_id': self.anchor_id,
            'selected_text': self.selected_text,
            'body': self.body,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }

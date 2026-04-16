"""Document collaborator model for shared document access."""
from datetime import datetime
from ..extensions import db


class DocumentCollaborator(db.Model):
    """Users who can access and edit a shared document."""
    __tablename__ = 'document_collaborators'

    collaborator_id = db.Column(db.Integer, primary_key=True)
    doc_id = db.Column(db.Integer, db.ForeignKey('documents.doc_id'), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.user_id'), nullable=False, index=True)
    permission = db.Column(db.String(20), nullable=False, default='edit')
    added_by = db.Column(db.Integer, db.ForeignKey('users.user_id'), nullable=False)
    added_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        db.UniqueConstraint('doc_id', 'user_id', name='uq_document_collaborator'),
        db.CheckConstraint("permission in ('view', 'edit', 'owner')", name='ck_document_permission'),
    )

    def to_dict(self):
        """Convert collaborator entry to dictionary."""
        return {
            'collaborator_id': self.collaborator_id,
            'doc_id': self.doc_id,
            'user_id': self.user_id,
            'user_name': self.user.name if self.user else None,
            'user_email': self.user.email if self.user else None,
            'permission': self.permission,
            'added_by': self.added_by,
            'added_at': self.added_at.isoformat() if self.added_at else None,
        }

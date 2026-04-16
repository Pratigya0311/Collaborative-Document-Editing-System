"""Edit Log model for operation tracking"""
from datetime import datetime
from ..extensions import db

class EditLog(db.Model):
    """Edit log model for tracking all document operations"""
    __tablename__ = 'edit_logs'
    
    log_id = db.Column(db.Integer, primary_key=True)
    doc_id = db.Column(db.Integer, db.ForeignKey('documents.doc_id'), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.user_id'), nullable=False, index=True)
    operation = db.Column(db.String(50), nullable=False)  # INSERT, UPDATE, DELETE, MERGE
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    version_id = db.Column(db.Integer, db.ForeignKey('document_versions.version_id'))
    metadata = db.Column(db.JSON)  # Additional context (IP, user agent, etc.)
    
    # Composite index for user activity queries
    __table_args__ = (
        db.Index('idx_log_doc_user_time', 'doc_id', 'user_id', 'timestamp'),
    )
    
    def to_dict(self):
        """Convert log entry to dictionary"""
        return {
            'log_id': self.log_id,
            'doc_id': self.doc_id,
            'user_id': self.user_id,
            'user_name': self.user.name if self.user else None,
            'operation': self.operation,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
            'version_id': self.version_id,
            'metadata': self.metadata
        }
    
    def __repr__(self):
        return f'<EditLog {self.operation} on Doc {self.doc_id}>'
"""Document Version model for version control"""
from datetime import datetime
from ..extensions import db

class DocumentVersion(db.Model):
    """Document version model for tracking document history"""
    __tablename__ = 'document_versions'
    
    version_id = db.Column(db.Integer, primary_key=True)
    doc_id = db.Column(db.Integer, db.ForeignKey('documents.doc_id'), nullable=False, index=True)
    content = db.Column(db.Text, nullable=False)
    edited_by = db.Column(db.Integer, db.ForeignKey('users.user_id'), nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    version_number = db.Column(db.Integer, nullable=False)
    change_summary = db.Column(db.String(500))
    content_hash = db.Column(db.String(64), index=True)  # For quick diff detection
    parent_version_id = db.Column(db.Integer, db.ForeignKey('document_versions.version_id'))
    
    # Relationships
    parent_version = db.relationship('DocumentVersion', remote_side=[version_id], 
                                    backref='children')
    
    # Composite index for efficient version queries
    __table_args__ = (
        db.Index('idx_version_doc_timestamp', 'doc_id', 'timestamp'),
        db.Index('idx_version_hash', 'content_hash'),
    )
    
    def to_dict(self, include_content=True):
        """Convert version to dictionary"""
        data = {
            'version_id': self.version_id,
            'doc_id': self.doc_id,
            'edited_by': self.edited_by,
            'editor_name': self.editor.name if self.editor else None,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
            'version_number': self.version_number,
            'change_summary': self.change_summary,
            'parent_version_id': self.parent_version_id
        }
        
        if include_content:
            data['content'] = self.content
            
        return data
    
    def __repr__(self):
        return f'<DocumentVersion {self.version_id} for Doc {self.doc_id}>'
"""Document model"""
from datetime import datetime
from ..extensions import db

class Document(db.Model):
    """Document model representing a collaborative document"""
    __tablename__ = 'documents'
    
    doc_id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    content = db.Column(db.Text, default='')
    created_by = db.Column(db.Integer, db.ForeignKey('users.user_id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_version_id = db.Column(db.Integer, nullable=True)
    is_deleted = db.Column(db.Boolean, default=False, index=True)
    
    # Relationships
    versions = db.relationship('DocumentVersion', backref='document', lazy='dynamic', 
                              cascade='all, delete-orphan')
    edit_logs = db.relationship('EditLog', backref='document', lazy='dynamic', 
                               cascade='all, delete-orphan')
    collaborators = db.relationship('DocumentCollaborator', backref='document', lazy='dynamic',
                                    cascade='all, delete-orphan')
    comments = db.relationship('DocumentComment', backref='document', lazy='dynamic',
                               cascade='all, delete-orphan')
    locks = db.relationship('DocumentLock', backref='document', lazy='dynamic',
                            cascade='all, delete-orphan')
    
    # Indexes for performance
    __table_args__ = (
        db.Index('idx_document_created_by', 'created_by'),
        db.Index('idx_document_updated_at', 'updated_at'),
    )
    
    def to_dict(self, include_content=True):
        """Convert document to dictionary"""
        data = {
            'doc_id': self.doc_id,
            'title': self.title,
            'created_by': self.created_by,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'last_version_id': self.last_version_id,
            'owner_name': self.owner.name if self.owner else None
        }
        
        if include_content:
            data['content'] = self.content
            
        return data
    
    def __repr__(self):
        return f'<Document {self.title}>'

"""User model"""
from datetime import datetime
import bcrypt
from ..extensions import db

class User(db.Model):
    """User model for authentication and document ownership"""
    __tablename__ = 'users'
    
    user_id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)
    
    # Relationships
    documents = db.relationship('Document', backref='owner', lazy='dynamic', cascade='all, delete-orphan')
    versions = db.relationship('DocumentVersion', backref='editor', lazy='dynamic')
    edit_logs = db.relationship('EditLog', backref='user', lazy='dynamic')
    collaborations = db.relationship(
        'DocumentCollaborator',
        foreign_keys='DocumentCollaborator.user_id',
        backref='user',
        lazy='dynamic',
        cascade='all, delete-orphan',
    )
    comments = db.relationship('DocumentComment', backref='user', lazy='dynamic', cascade='all, delete-orphan')
    created_locks = db.relationship(
        'DocumentLock',
        foreign_keys='DocumentLock.created_by',
        backref='creator',
        lazy='dynamic',
        cascade='all, delete-orphan',
    )
    
    def set_password(self, password):
        """Hash and set user password"""
        salt = bcrypt.gensalt()
        self.password_hash = bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')
    
    def check_password(self, password):
        """Verify password against stored hash"""
        return bcrypt.checkpw(
            password.encode('utf-8'),
            self.password_hash.encode('utf-8')
        )
    
    def to_dict(self):
        """Convert user to dictionary"""
        return {
            'user_id': self.user_id,
            'name': self.name,
            'email': self.email,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
    
    def __repr__(self):
        return f'<User {self.email}>'

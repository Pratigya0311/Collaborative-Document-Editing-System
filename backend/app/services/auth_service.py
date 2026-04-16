"""Authentication service for user management"""
from typing import Optional, Dict, Any
from datetime import datetime
import re

from ..extensions import db
from ..models import User
from flask_jwt_extended import create_access_token, create_refresh_token

class AuthService:
    """Handles user authentication and registration"""
    
    @staticmethod
    def validate_email(email: str) -> bool:
        """Validate email format"""
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        return bool(re.match(pattern, email))
    
    @staticmethod
    def validate_password(password: str) -> tuple[bool, str]:
        """
        Validate password strength.
        
        Returns:
            Tuple of (is_valid, message)
        """
        if len(password) < 6:
            return False, "Password must be at least 6 characters long"
        
        return True, "Password is valid"
    
    def register_user(self, name: str, email: str, password: str) -> tuple[Optional[User], Optional[str]]:
        """
        Register a new user.
        
        Args:
            name: User's full name
            email: User's email
            password: User's password
            
        Returns:
            Tuple of (user, error_message)
        """
        email = email.strip().lower()

        # Validate email
        if not self.validate_email(email):
            return None, "Invalid email format"
        
        # Validate password
        is_valid, message = self.validate_password(password)
        if not is_valid:
            return None, message
        
        # Check if user already exists
        existing_user = User.query.filter_by(email=email).first()
        if existing_user:
            return None, "Email already registered"
        
        try:
            # Create new user
            user = User(
                name=name,
                email=email,
                created_at=datetime.utcnow()
            )
            user.set_password(password)
            
            db.session.add(user)
            db.session.commit()
            
            return user, None
            
        except Exception as e:
            db.session.rollback()
            return None, f"Registration failed: {str(e)}"
    
    def authenticate_user(self, email: str, password: str) -> tuple[Optional[User], Optional[str]]:
        """
        Authenticate a user.
        
        Args:
            email: User's email
            password: User's password
            
        Returns:
            Tuple of (user, error_message)
        """
        user = User.query.filter_by(email=email.lower(), is_active=True).first()
        
        if not user:
            return None, "Invalid email or password"
        
        if not user.check_password(password):
            return None, "Invalid email or password"
        
        return user, None
    
    def create_tokens(self, user: User) -> Dict[str, str]:
        """
        Create JWT tokens for authenticated user.
        
        Args:
            user: User object
            
        Returns:
            Dictionary with access_token and refresh_token
        """
        identity = str(user.user_id)
        access_token = create_access_token(
            identity=identity,
            additional_claims={
                'email': user.email,
                'name': user.name
            }
        )
        
        refresh_token = create_refresh_token(identity=identity)
        
        return {
            'access_token': access_token,
            'refresh_token': refresh_token,
            'token_type': 'Bearer',
            'user': user.to_dict()
        }
    
    def get_user_by_id(self, user_id: int) -> Optional[User]:
        """Get user by ID"""
        return User.query.filter_by(user_id=user_id, is_active=True).first()

"""Custom decorators for route handlers"""
from functools import wraps
from flask import request, jsonify
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity
from sqlalchemy.exc import SQLAlchemyError
import time
from collections import defaultdict

from ..extensions import db

# Simple in-memory rate limiter (use Redis in production)
rate_limit_store = defaultdict(list)

def token_required(f):
    """Decorator to require valid JWT token"""
    @wraps(f)
    def decorated(*args, **kwargs):
        try:
            verify_jwt_in_request()
            current_user_id = get_jwt_identity()
            kwargs['current_user_id'] = current_user_id
            return f(*args, **kwargs)
        except Exception as e:
            return jsonify({'error': 'Invalid or expired token', 'message': str(e)}), 401
    return decorated

def transactional(f):
    """Decorator to wrap function in a database transaction"""
    @wraps(f)
    def decorated(*args, **kwargs):
        try:
            result = f(*args, **kwargs)
            db.session.commit()
            return result
        except Exception as e:
            db.session.rollback()
            raise e
    return decorated

def rate_limit(max_requests: int, window_seconds: int):
    """
    Rate limiting decorator.
    
    Args:
        max_requests: Maximum number of requests allowed
        window_seconds: Time window in seconds
    """
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            # Get client identifier (IP or user ID)
            identifier = request.remote_addr
            
            # Get current timestamp
            now = time.time()
            
            # Clean old entries
            rate_limit_store[identifier] = [
                ts for ts in rate_limit_store[identifier] 
                if ts > now - window_seconds
            ]
            
            # Check rate limit
            if len(rate_limit_store[identifier]) >= max_requests:
                return jsonify({
                    'error': 'Rate limit exceeded',
                    'message': f'Maximum {max_requests} requests per {window_seconds} seconds'
                }), 429
            
            # Add current request
            rate_limit_store[identifier].append(now)
            
            return f(*args, **kwargs)
        return decorated
    return decorator
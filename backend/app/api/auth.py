"""Authentication endpoints"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, create_access_token

from ..services.auth_service import AuthService
from ..schemas.document_schema import LoginRequest, RegisterRequest, UserSchema
from ..utils.decorators import rate_limit

auth_bp = Blueprint('auth', __name__)
auth_service = AuthService()

@auth_bp.route('/register', methods=['POST'])
@rate_limit(max_requests=5, window_seconds=60)
def register():
    """Register a new user"""
    try:
        # Validate request
        schema = RegisterRequest()
        data = schema.load(request.json)
        
        # Register user
        user, error = auth_service.register_user(
            name=data['name'],
            email=data['email'],
            password=data['password']
        )
        
        if error:
            return jsonify({'error': 'Registration failed', 'message': error}), 400
        
        # Create tokens
        tokens = auth_service.create_tokens(user)
        
        return jsonify(tokens), 201
        
    except Exception as e:
        return jsonify({'error': 'Registration failed', 'message': str(e)}), 400

@auth_bp.route('/login', methods=['POST'])
@rate_limit(max_requests=10, window_seconds=60)
def login():
    """Login user and return tokens"""
    try:
        # Validate request
        schema = LoginRequest()
        data = schema.load(request.json)
        
        # Authenticate user
        user, error = auth_service.authenticate_user(
            email=data['email'],
            password=data['password']
        )
        
        if error:
            return jsonify({'error': 'Authentication failed', 'message': error}), 401
        
        # Create tokens
        tokens = auth_service.create_tokens(user)
        
        return jsonify(tokens), 200
        
    except Exception as e:
        return jsonify({'error': 'Login failed', 'message': str(e)}), 400

@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    """Refresh access token"""
    try:
        current_user_id = get_jwt_identity()
        access_token = create_access_token(identity=current_user_id)
        
        return jsonify({'access_token': access_token}), 200
        
    except Exception as e:
        return jsonify({'error': 'Token refresh failed', 'message': str(e)}), 400

@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_current_user():
    """Get current user information"""
    try:
        current_user_id = get_jwt_identity()
        user = auth_service.get_user_by_id(current_user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        schema = UserSchema()
        return jsonify(schema.dump(user)), 200
        
    except Exception as e:
        return jsonify({'error': 'Failed to get user', 'message': str(e)}), 400

@auth_bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    """Logout user (client should discard tokens)"""
    # JWT is stateless, client-side logout is sufficient
    return jsonify({'message': 'Successfully logged out'}), 200
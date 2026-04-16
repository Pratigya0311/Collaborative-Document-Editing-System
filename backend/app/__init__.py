"""Application Factory Pattern"""
from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_migrate import Migrate
from flask_socketio import SocketIO
import os

from .config import Config, DevelopmentConfig, ProductionConfig, TestingConfig
from .extensions import db, jwt, socketio, migrate

def create_app(config_name=None):
    """Create and configure the Flask application"""
    app = Flask(__name__)
    
    # Load configuration
    if config_name is None:
        config_name = os.getenv('FLASK_ENV', 'development')
    
    config_map = {
        'development': DevelopmentConfig,
        'production': ProductionConfig,
        'testing': TestingConfig
    }
    
    app.config.from_object(config_map.get(config_name, DevelopmentConfig))
    
    # Initialize extensions
    initialize_extensions(app)
    
    # Register blueprints
    register_blueprints(app)
    
    # Register error handlers
    register_error_handlers(app)
    
    # Configure CORS
    CORS(app, origins=app.config['CORS_ORIGINS'], supports_credentials=True)
    
    return app

def initialize_extensions(app):
    """Initialize Flask extensions"""
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    socketio.init_app(
        app,
        cors_allowed_origins=app.config['CORS_ORIGINS'],
        async_mode='eventlet',
        logger=True,
        engineio_logger=True
    )

def register_blueprints(app):
    """Register all blueprints"""
    from .api.auth import auth_bp
    from .api.documents import documents_bp
    from .api.versions import versions_bp
    from .api.websockets import ws_bp
    
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(documents_bp, url_prefix='/api/documents')
    app.register_blueprint(versions_bp, url_prefix='/api/versions')
    app.register_blueprint(ws_bp, url_prefix='/api/ws')

def register_error_handlers(app):
    """Register custom error handlers"""
    from flask import jsonify
    from werkzeug.exceptions import HTTPException
    
    @app.errorhandler(Exception)
    def handle_exception(e):
        if isinstance(e, HTTPException):
            response = jsonify({
                'error': e.name,
                'message': e.description,
                'status_code': e.code
            })
            response.status_code = e.code
        else:
            response = jsonify({
                'error': 'Internal Server Error',
                'message': str(e),
                'status_code': 500
            })
            response.status_code = 500
        return response
"""Application Factory Pattern"""
from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_migrate import Migrate
from flask_socketio import SocketIO
from dotenv import load_dotenv
import os
from pathlib import Path

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

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

    # Register CLI commands
    register_cli_commands(app)
    
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

def register_cli_commands(app):
    """Register database setup commands."""
    import click
    from .extensions import db

    @app.cli.command('init-db')
    def init_db():
        """Create all database tables for local development."""
        from . import models  # noqa: F401

        db.create_all()
        click.echo('Database tables created.')

    @app.cli.command('seed-demo')
    def seed_demo():
        """Create a demo user and sample document."""
        from .models import User, Document, DocumentVersion, EditLog
        import hashlib

        user = User.query.filter_by(email='demo@example.com').first()
        if not user:
            user = User(name='Demo User', email='demo@example.com')
            user.set_password('Demo1234')
            db.session.add(user)
            db.session.flush()

        document = Document.query.filter_by(title='DBMS Collaborative Editing Demo').first()
        if not document:
            content = 'This document demonstrates transactions, versioning, and edit logs.'
            document = Document(title='DBMS Collaborative Editing Demo', content=content, created_by=user.user_id)
            db.session.add(document)
            db.session.flush()

            version = DocumentVersion(
                doc_id=document.doc_id,
                content=content,
                edited_by=user.user_id,
                version_number=1,
                change_summary='Seed demo document',
                content_hash=hashlib.sha256(content.encode()).hexdigest(),
                is_saved_version=True
            )
            db.session.add(version)
            db.session.flush()

            document.last_version_id = version.version_id
            db.session.add(EditLog(
                doc_id=document.doc_id,
                user_id=user.user_id,
                operation='INSERT',
                version_id=version.version_id,
                metadata_json={'action': 'seed_demo'}
            ))

        db.session.commit()
        click.echo('Demo data ready: demo@example.com / Demo1234')

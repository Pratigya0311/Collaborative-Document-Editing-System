"""Create the PostgreSQL schema and optional demo data."""
import hashlib
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

from app import create_app
from app.extensions import db
from app.models import User, Document, DocumentVersion, EditLog


app = create_app()


def create_schema():
    """Create all tables from SQLAlchemy models."""
    with app.app_context():
        db.create_all()
        print("OK: Database tables created.")


def seed_demo():
    """Create the demo account shown on the login page."""
    with app.app_context():
        user = User.query.filter_by(email='demo@example.com').first()
        if not user:
            user = User(name='Demo User', email='demo@example.com')
            user.set_password('Demo1234')
            db.session.add(user)
            db.session.flush()

        document = Document.query.filter_by(
            title='DBMS Collaborative Editing Demo',
            created_by=user.user_id
        ).first()
        if not document:
            content = 'This document demonstrates transactions, versioning, conflict checks, and edit logs.'
            document = Document(
                title='DBMS Collaborative Editing Demo',
                content=content,
                created_by=user.user_id
            )
            db.session.add(document)
            db.session.flush()

            version = DocumentVersion(
                doc_id=document.doc_id,
                content=content,
                edited_by=user.user_id,
                version_number=1,
                change_summary='Seed demo document',
                content_hash=hashlib.sha256(content.encode()).hexdigest()
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
        print("OK: Demo data ready: demo@example.com / Demo1234")


if __name__ == '__main__':
    create_schema()
    seed_demo()

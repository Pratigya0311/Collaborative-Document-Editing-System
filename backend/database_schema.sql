-- PostgreSQL schema for the Collaborative Document Management System.
-- SQLAlchemy can create this with: python init_db.py

CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS documents (
    doc_id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT DEFAULT '',
    created_by INTEGER NOT NULL REFERENCES users(user_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_version_id INTEGER,
    is_deleted BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS document_versions (
    version_id SERIAL PRIMARY KEY,
    doc_id INTEGER NOT NULL REFERENCES documents(doc_id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    edited_by INTEGER NOT NULL REFERENCES users(user_id),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    version_number INTEGER NOT NULL,
    change_summary VARCHAR(500),
    content_hash VARCHAR(64),
    parent_version_id INTEGER REFERENCES document_versions(version_id),
    is_saved_version BOOLEAN DEFAULT FALSE NOT NULL
);

CREATE TABLE IF NOT EXISTS edit_logs (
    log_id SERIAL PRIMARY KEY,
    doc_id INTEGER NOT NULL REFERENCES documents(doc_id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(user_id),
    operation VARCHAR(50) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    version_id INTEGER REFERENCES document_versions(version_id),
    metadata JSON
);

CREATE TABLE IF NOT EXISTS document_collaborators (
    collaborator_id SERIAL PRIMARY KEY,
    doc_id INTEGER NOT NULL REFERENCES documents(doc_id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(user_id),
    permission VARCHAR(20) NOT NULL DEFAULT 'edit',
    added_by INTEGER NOT NULL REFERENCES users(user_id),
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT uq_document_collaborator UNIQUE (doc_id, user_id),
    CONSTRAINT ck_document_permission CHECK (permission in ('view', 'edit', 'owner'))
);

CREATE TABLE IF NOT EXISTS document_comments (
    comment_id SERIAL PRIMARY KEY,
    doc_id INTEGER NOT NULL REFERENCES documents(doc_id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(user_id),
    anchor_id VARCHAR(64) NOT NULL UNIQUE,
    selected_text TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS document_locks (
    lock_id VARCHAR(64) PRIMARY KEY,
    doc_id INTEGER NOT NULL REFERENCES documents(doc_id) ON DELETE CASCADE,
    created_by INTEGER NOT NULL REFERENCES users(user_id),
    selected_text TEXT NOT NULL,
    selected_html TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_users_email ON users(email);
CREATE INDEX IF NOT EXISTS ix_documents_is_deleted ON documents(is_deleted);
CREATE INDEX IF NOT EXISTS idx_document_created_by ON documents(created_by);
CREATE INDEX IF NOT EXISTS idx_document_updated_at ON documents(updated_at);
CREATE INDEX IF NOT EXISTS ix_document_versions_doc_id ON document_versions(doc_id);
CREATE INDEX IF NOT EXISTS ix_document_versions_timestamp ON document_versions(timestamp);
CREATE INDEX IF NOT EXISTS idx_version_doc_timestamp ON document_versions(doc_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_version_hash ON document_versions(content_hash);
CREATE INDEX IF NOT EXISTS ix_document_versions_is_saved_version ON document_versions(is_saved_version);
CREATE INDEX IF NOT EXISTS ix_edit_logs_doc_id ON edit_logs(doc_id);
CREATE INDEX IF NOT EXISTS ix_edit_logs_user_id ON edit_logs(user_id);
CREATE INDEX IF NOT EXISTS ix_edit_logs_timestamp ON edit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_log_doc_user_time ON edit_logs(doc_id, user_id, timestamp);
CREATE INDEX IF NOT EXISTS ix_document_collaborators_doc_id ON document_collaborators(doc_id);
CREATE INDEX IF NOT EXISTS ix_document_collaborators_user_id ON document_collaborators(user_id);
CREATE INDEX IF NOT EXISTS ix_document_comments_doc_id ON document_comments(doc_id);
CREATE INDEX IF NOT EXISTS ix_document_comments_user_id ON document_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comment_doc_created ON document_comments(doc_id, created_at);
CREATE INDEX IF NOT EXISTS ix_document_locks_doc_id ON document_locks(doc_id);
CREATE INDEX IF NOT EXISTS ix_document_locks_created_by ON document_locks(created_by);
CREATE INDEX IF NOT EXISTS idx_lock_doc_created ON document_locks(doc_id, created_at);

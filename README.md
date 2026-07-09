# Collaborative Document Editing System

A polished collaborative editor for teams that need real-time coauthoring, access control, version checkpoints, comment threads, and protected text regions. The product brings together editing, sharing, history, and activity tracking in a single workflow.

## Overview

The application is designed as a practical document workspace. Users can create documents, edit them in the browser, invite collaborators, protect important text, and trace every meaningful change over time.

The backend manages authentication, persistence, versioning, collaboration rules, audit logging, and live update events. The frontend delivers the editor, dashboard, version browser, comment tools, sharing controls, and activity views.

## Key Capabilities

- Create and organize documents from a personal dashboard
- Edit content in a browser-based collaborative editor
- Share documents with view, edit, and owner permissions
- Add comments on selected text ranges
- Lock critical text so only the owner can modify it
- Save named versions and restore previous checkpoints
- Compare versions with readable diffs
- Download documents as plain text
- Review recent activity across accessible documents
- Receive live updates when multiple users are active in the same document

## Product Areas

- **Dashboard** - Presents owned and shared documents with quick actions for editing, history, and access management
- **Editor** - Supports live editing, formatting, autosave, manual save, sharing, annotations, downloads, and concurrent collaboration
- **Version History** - Stores explicit saved snapshots for rollback and review without cluttering the interface with every autosave
- **Comments and Locks** - Enables threaded feedback on selected text and owner-controlled locking for critical passages
- **Audit Logs** - Surfaces a concise timeline of meaningful document events

## Architecture

### Backend

- Flask REST API with JWT authentication
- Flask-SocketIO for live document events
- SQLAlchemy for transactional persistence
- Marshmallow for validation and serialization
- PostgreSQL as the data store

### Frontend

- React with Vite
- React Router for navigation
- Axios for API requests
- Socket.IO client for live collaboration
- diff-match-patch for comparison and merge support

## Data Model

| Entity | Purpose |
|---|---|
| `users` | Authentication and document ownership |
| `documents` | Current document state and metadata |
| `document_versions` | Saved snapshots and rollback points |
| `document_collaborators` | Shared access and permissions |
| `document_comments` | Selected-text discussion threads |
| `document_locks` | Protected text regions controlled by the owner |
| `edit_logs` | Human-readable activity history |

## Collaboration Flow

1. A user opens a document from the dashboard.
2. The editor loads the current content and any existing annotations.
3. Changes are autosaved and shared with other connected users.
4. Named saves create durable checkpoints for later rollback.
5. Comments and locks are persisted as part of the document workflow.
6. Audit logs capture sharing, saving, rollback, comment, and lock events.

## Tech Stack

- Frontend: React, Vite, JavaScript, CSS
- Backend: Python, Flask
- Database: PostgreSQL
- Realtime: Socket.IO
- Authentication: JWT
- Containerization: Docker

## Getting Started

### Backend

1. Create a PostgreSQL database and configure `backend/.env`.
2. Install dependencies:

```bash
pip install -r backend/requirements.txt
```

3. Create the database tables:

```bash
python backend/init_db.py
```

4. Start the backend:

```bash
python backend/run.py
```

### Frontend

1. Install dependencies:

```bash
cd frontend
npm install
```

2. Start the frontend:

```bash
npm run dev
```

## Useful Scripts

- `backend/init_db.py` - Creates the database schema
- `backend/check_db.py` - Verifies database connectivity
- `backend/run.py` - Starts the Flask app with Socket.IO
- `frontend/src/main.jsx` - Frontend entry point

## Limitations

The current build delivers the core collaboration workflow well, while leaving room for deeper product maturity in a few areas:

- Collaboration is event-based rather than powered by a full operational-transform engine
- Version recovery is checkpoint-based rather than a full branching and merge history model
- Presence signals are intentionally lightweight compared with larger collaboration suites
- Permission management is focused on the current editing and sharing workflow
- Deployment, observability, and scaling are geared toward small to medium deployments

## Future Scope

Based on the current design, the next practical enhancements would be:

- Smarter merge handling for overlapping edits, including user-facing conflict resolution
- Live presence indicators for cursors, selections, and active collaborators
- Granular roles such as editor, commenter, reviewer, and owner
- Richer version tools such as side-by-side comparison, annotations, and restore previews
- Full deployment configuration for development, staging, and production environments
- Search and filter support for documents, versions, comments, and audit activity

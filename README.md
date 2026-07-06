# Collaborative Document Editing System

A database-driven collaborative document editing system that enables multiple users to edit shared documents simultaneously while ensuring **data consistency, isolation, and recoverability** through transaction management and concurrency control.

## Problem Statement

Modern collaborative platforms allow multiple users to read and write shared documents at the same time. Without proper concurrency control, this leads to critical issues:

- **Lost Updates** – one user's changes overwrite another's
- **Read-Write Conflicts** – simultaneous access causing data corruption
- **Inconsistent Document States** – partial or unsynchronized updates
- **Version Conflicts** – difficulty maintaining accurate document history

This project addresses these challenges by applying core DBMS concepts — transaction management, concurrency control, and versioning — to build a reliable multi-user editing system.

## Objectives

- Enable multiple users to edit documents simultaneously with controlled, correct execution
- Prevent conflicting updates and maintain consistent document states
- Apply concurrency control mechanisms such as row-level locking and version-based validation
- Ensure incomplete or failed operations don't affect document integrity, with safe recovery
- Maintain a structured version history for rollback and change tracking

## Key Features

- **Transaction-Based Editing** – Every document update runs as a database transaction, ensuring atomic and consistent modifications
- **Concurrency-Safe Updates** – Row-level locking and version checks manage simultaneous edits and prevent conflicts between users
- **Version Control Engine** – Maintains structured document history with version lineage for rollback and comparison
- **Conflict Detection** – Detects concurrent edit conflicts via base-version comparison
- **Edit Logging System** – Captures all operations in audit logs for traceability and recovery
- **Document Sharing & Permissions** – Collaborators can be added to documents with defined access levels

## Tech Stack

- **Language:** Python, JavaScript
- **Database:** PostgreSQL
- **Styling:** HTML, CSS
- **Containerization:** Docker
- **Version Control:** Git, GitHub

## Database Design

The schema is built around five core entities:

| Table | Purpose |
|---|---|
| `Users` | Stores user account and authentication details |
| `Documents` | Stores document metadata and content |
| `Document Versions` | Tracks version history, change summaries, and lineage |
| `Edit Logs` | Audit trail of all operations performed on documents |
| `Document Collaborators` | Manages sharing and permission levels between users and documents |

### Entity Relationships

- A **User** creates one or more **Documents**
- A **Document** is the *parent of* multiple **Document Versions**
- **Users** perform operations that generate entries in **Edit Logs**
- **Documents** are shared with other users via **Document Collaborators**
- **Edit Logs** and **Document Collaborators** both reference the accessing/performing **User**
## Core Concepts Applied

- **Transaction Management** – Atomicity and consistency for every document update, with commit/rollback support
- **Concurrency Control** – Locking combined with version-based validation for safe concurrent access
- **Isolation** – Row-level locking prevents concurrent transactions from interfering with one another
- **Recovery & Durability** – Ensures committed updates persist and incomplete operations don't corrupt system state


## Future Scope

- Real-time synchronization using WebSockets for live collaborative editing
- Merge-based conflict resolution instead of last-write-wins
- Role-based access control for document collaborators
- Performance benchmarking under high-concurrency workloads



---
*Developed as a DBMS course project focused on transaction management and concurrency control in collaborative systems.*

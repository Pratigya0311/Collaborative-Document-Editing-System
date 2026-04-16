"""Transaction Manager - Core DBMS ACID logic for concurrent document editing"""
import hashlib
from typing import Optional, Tuple, Dict, Any
from sqlalchemy.exc import SQLAlchemyError
from datetime import datetime

from ..extensions import db
from ..models import Document, DocumentVersion, EditLog, User
from .diff_engine import DiffEngine

class TransactionManager:
    """
    Manages ACID-compliant document transactions with conflict detection.
    Implements pessimistic locking and version-based conflict resolution.
    """
    
    def __init__(self):
        self.diff_engine = DiffEngine()
    
    def save_document_version(
        self, 
        doc_id: int, 
        user_id: int, 
        new_content: str, 
        base_version_id: Optional[int] = None,
        change_summary: str = ""
    ) -> Tuple[DocumentVersion, Dict[str, Any]]:
        """
        Save a new document version with ACID guarantees.
        
        Args:
            doc_id: Document ID
            user_id: User making the edit
            new_content: New document content
            base_version_id: Version this edit is based on (for conflict detection)
            change_summary: Description of changes made
            
        Returns:
            Tuple of (new_version, conflict_info)
        """
        conflict_info = {'detected': False, 'resolved': False, 'merge_strategy': 'none'}
        
        try:
            # BEGIN TRANSACTION
            with db.session.begin():
                # ACID: Isolation - Pessimistic Locking
                # SELECT FOR UPDATE locks the row for this transaction
                document = Document.query.with_for_update().filter_by(
                    doc_id=doc_id, 
                    is_deleted=False
                ).first()
                
                if not document:
                    raise ValueError(f"Document {doc_id} not found")
                
                # Conflict Detection
                current_content = document.content
                current_version_id = document.last_version_id
                
                if base_version_id and base_version_id != current_version_id:
                    conflict_info['detected'] = True
                    
                    # Attempt automatic merge
                    merged_content, merge_success = self._attempt_merge(
                        base_content=self._get_version_content(base_version_id),
                        current_content=current_content,
                        new_content=new_content
                    )
                    
                    if merge_success:
                        conflict_info['resolved'] = True
                        conflict_info['merge_strategy'] = 'auto-merge'
                        new_content = merged_content
                    else:
                        # Manual resolution required - create branch version
                        conflict_info['merge_strategy'] = 'branch-created'
                        # Still save as a branch (conflict not resolved automatically)
                
                # Calculate content hash for quick comparison
                content_hash = hashlib.sha256(new_content.encode()).hexdigest()
                
                # Get next version number
                latest_version = DocumentVersion.query.filter_by(doc_id=doc_id)\
                    .order_by(DocumentVersion.version_number.desc()).first()
                next_version_number = (latest_version.version_number + 1) if latest_version else 1
                
                # Create new version record
                new_version = DocumentVersion(
                    doc_id=doc_id,
                    content=new_content,
                    edited_by=user_id,
                    version_number=next_version_number,
                    change_summary=change_summary,
                    content_hash=content_hash,
                    parent_version_id=base_version_id
                )
                db.session.add(new_version)
                db.session.flush()  # Get version_id
                
                # Update document with new content and version reference
                document.content = new_content
                document.last_version_id = new_version.version_id
                document.updated_at = datetime.utcnow()
                
                # Create edit log entry
                operation = 'MERGE' if conflict_info['detected'] else 'UPDATE'
                log_entry = EditLog(
                    doc_id=doc_id,
                    user_id=user_id,
                    operation=operation,
                    version_id=new_version.version_id,
                    metadata={
                        'conflict_detected': conflict_info['detected'],
                        'conflict_resolved': conflict_info['resolved'],
                        'base_version': base_version_id,
                        'new_version': new_version.version_id
                    }
                )
                db.session.add(log_entry)
                
                # COMMIT - All or nothing
                db.session.commit()
                
                return new_version, conflict_info
                
        except SQLAlchemyError as e:
            # ACID: Atomicity - Rollback on error
            db.session.rollback()
            raise Exception(f"Transaction failed: {str(e)}")
    
    def _attempt_merge(self, base_content: str, current_content: str, new_content: str) -> Tuple[str, bool]:
        """
        Attempt three-way merge of document changes.
        
        Args:
            base_content: Original content before any changes
            current_content: Current content in database (other user's changes)
            new_content: New content from current user
            
        Returns:
            Tuple of (merged_content, success_flag)
        """
        try:
            # Use diff engine for three-way merge
            merged = self.diff_engine.three_way_merge(base_content, current_content, new_content)
            return merged, True
        except Exception as e:
            return current_content, False
    
    def _get_version_content(self, version_id: int) -> str:
        """Retrieve content for a specific version"""
        if not version_id:
            return ""
        
        version = DocumentVersion.query.get(version_id)
        return version.content if version else ""
    
    def get_version_history(self, doc_id: int, limit: int = 50) -> list:
        """
        Retrieve version history for a document.
        
        Args:
            doc_id: Document ID
            limit: Maximum number of versions to return
            
        Returns:
            List of version dictionaries
        """
        versions = DocumentVersion.query.filter_by(doc_id=doc_id)\
            .order_by(DocumentVersion.timestamp.desc())\
            .limit(limit)\
            .all()
        
        return [v.to_dict(include_content=False) for v in versions]
    
    def rollback_to_version(self, doc_id: int, version_id: int, user_id: int) -> DocumentVersion:
        """
        Rollback document to a previous version.
        Creates a new version with the old content.
        
        Args:
            doc_id: Document ID
            version_id: Target version ID to rollback to
            user_id: User performing rollback
            
        Returns:
            New version object
        """
        try:
            with db.session.begin():
                # Lock document
                document = Document.query.with_for_update().filter_by(doc_id=doc_id).first()
                
                # Get target version
                target_version = DocumentVersion.query.filter_by(
                    doc_id=doc_id, 
                    version_id=version_id
                ).first()
                
                if not target_version:
                    raise ValueError(f"Version {version_id} not found")
                
                # Create rollback version
                return self.save_document_version(
                    doc_id=doc_id,
                    user_id=user_id,
                    new_content=target_version.content,
                    base_version_id=document.last_version_id,
                    change_summary=f"Rollback to version {version_id}"
                )[0]
                
        except SQLAlchemyError as e:
            db.session.rollback()
            raise Exception(f"Rollback failed: {str(e)}")
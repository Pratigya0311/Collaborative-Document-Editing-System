"""Diff Engine - Text comparison and merging algorithms"""
import diff_match_patch as dmp_module
from typing import List, Tuple, Optional

class DiffEngine:
    """
    Handles text diffing, patching, and three-way merging.
    Uses Google's diff-match-patch library for efficient text operations.
    """
    
    def __init__(self):
        self.dmp = dmp_module.diff_match_patch()
        self.dmp.Diff_Timeout = 1.0  # 1 second timeout for diff computation
        self.dmp.Diff_EditCost = 4   # Balance between speed and quality
        
    def compute_diff(self, text1: str, text2: str) -> List[Tuple[int, str]]:
        """
        Compute the difference between two texts.
        
        Args:
            text1: Original text
            text2: Modified text
            
        Returns:
            List of diffs: [(operation, text)]
            operation: -1 (delete), 0 (equal), 1 (insert)
        """
        return self.dmp.diff_main(text1, text2)
    
    def compute_patches(self, text1: str, text2: str) -> List[str]:
        """
        Create patches that can transform text1 into text2.
        
        Args:
            text1: Source text
            text2: Target text
            
        Returns:
            List of patch strings (base64 encoded)
        """
        diffs = self.dmp.diff_main(text1, text2)
        self.dmp.diff_cleanupSemantic(diffs)
        patches = self.dmp.patch_make(text1, diffs)
        return self.dmp.patch_toText(patches)
    
    def apply_patches(self, patches: List[str], text: str) -> Tuple[str, List[bool]]:
        """
        Apply patches to transform text.
        
        Args:
            patches: Patch strings
            text: Text to apply patches to
            
        Returns:
            Tuple of (resulting_text, success_array)
        """
        patch_objects = self.dmp.patch_fromText(patches)
        return self.dmp.patch_apply(patch_objects, text)
    
    def three_way_merge(self, base: str, current: str, new: str) -> str:
        """
        Perform three-way merge of text changes.
        
        Args:
            base: Original text before any changes
            current: Current text (other user's changes)
            new: New text (current user's changes)
            
        Returns:
            Merged text
        """
        # Compute diffs from base to current and base to new
        diffs_current = self.dmp.diff_main(base, current)
        diffs_new = self.dmp.diff_main(base, new)
        
        self.dmp.diff_cleanupSemantic(diffs_current)
        self.dmp.diff_cleanupSemantic(diffs_new)
        
        # Create patches from base->current and base->new
        patches_current = self.dmp.patch_make(base, diffs_current)
        patches_new = self.dmp.patch_make(base, diffs_new)
        
        # Apply current patches to base first
        merged_text, _ = self.dmp.patch_apply(patches_current, base)
        
        # Then apply new patches
        merged_text, _ = self.dmp.patch_apply(patches_new, merged_text)
        
        return merged_text
    
    def has_conflict(self, base: str, current: str, new: str) -> bool:
        """
        Check if changes from two users conflict.
        
        Args:
            base: Original text
            current: Current text
            new: New text
            
        Returns:
            True if conflicts exist, False otherwise
        """
        # Get changed regions
        base_lines = base.split('\n')
        current_lines = current.split('\n')
        new_lines = new.split('\n')
        
        # Simple conflict detection: check if same lines were modified
        current_changes = set()
        new_changes = set()
        
        for i, (b, c) in enumerate(zip(base_lines, current_lines)):
            if b != c:
                current_changes.add(i)
                
        for i, (b, n) in enumerate(zip(base_lines, new_lines)):
            if b != n:
                new_changes.add(i)
        
        # Conflict if both users modified the same lines
        conflicts = current_changes.intersection(new_changes)
        return len(conflicts) > 0
    
    def create_diff_patches(self, old_content: str, new_content: str) -> dict:
        """
        Create diff patches for efficient network transmission.
        
        Args:
            old_content: Previous content
            new_content: New content
            
        Returns:
            Dictionary with patches and metadata
        """
        patches = self.compute_patches(old_content, new_content)
        diffs = self.compute_diff(old_content, new_content)
        
        # Calculate change statistics
        insertions = sum(len(text) for op, text in diffs if op == 1)
        deletions = sum(len(text) for op, text in diffs if op == -1)
        
        return {
            'patches': patches,
            'patch_count': len(patches),
            'insertions': insertions,
            'deletions': deletions,
            'total_changes': insertions + deletions
        }
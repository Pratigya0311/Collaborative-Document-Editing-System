import DiffMatchPatch from 'diff-match-patch';

class DiffEngine {
  constructor() {
    this.dmp = new DiffMatchPatch();
    this.dmp.Diff_Timeout = 1.0;
  }
  
  computeDiff(text1, text2) {
    return this.dmp.diff_main(text1, text2);
  }
  
  computePatches(text1, text2) {
    const diffs = this.dmp.diff_main(text1, text2);
    this.dmp.diff_cleanupSemantic(diffs);
    const patches = this.dmp.patch_make(text1, diffs);
    return this.dmp.patch_toText(patches);
  }
  
  applyPatches(patchesText, text) {
    const patches = this.dmp.patch_fromText(patchesText);
    return this.dmp.patch_apply(patches, text);
  }
  
  hasConflicts(base, current, newText) {
    const baseLines = base.split('\n');
    const currentLines = current.split('\n');
    const newLines = newText.split('\n');
    
    const currentChanges = new Set();
    const newChanges = new Set();
    
    for (let i = 0; i < Math.min(baseLines.length, currentLines.length); i++) {
      if (baseLines[i] !== currentLines[i]) {
        currentChanges.add(i);
      }
    }
    
    for (let i = 0; i < Math.min(baseLines.length, newLines.length); i++) {
      if (baseLines[i] !== newLines[i]) {
        newChanges.add(i);
      }
    }
    
    return [...currentChanges].some(line => newChanges.has(line));
  }
  
  formatDiffForDisplay(diffs) {
    return diffs.map(([op, text]) => ({
      type: op === 1 ? 'insert' : op === -1 ? 'delete' : 'equal',
      text
    }));
  }
}

export default new DiffEngine();
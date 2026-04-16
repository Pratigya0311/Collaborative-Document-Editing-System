import React from 'react';
import { 
  FiBold, FiItalic, FiUnderline, 
  FiList, FiSave, FiClock, FiShare2, FiGitCommit
  , FiDownload
} from 'react-icons/fi';
import './Toolbar.css';

const Toolbar = ({ 
  onSave, 
  onSaveVersion,
  onDownload,
  saving, 
  savingVersion = false,
  lastSaved, 
  onFormat, 
  onShowHistory,
  onShare,
  canEdit = true,
  canShare = false
}) => {
  return (
    <div className="editor-toolbar">
      <div className="toolbar-group">
        <button 
          className="toolbar-btn" 
          onClick={() => onFormat('bold')}
          disabled={!canEdit}
          title="Bold"
        >
          <FiBold />
        </button>
        <button 
          className="toolbar-btn" 
          onClick={() => onFormat('italic')}
          disabled={!canEdit}
          title="Italic"
        >
          <FiItalic />
        </button>
        <button 
          className="toolbar-btn" 
          onClick={() => onFormat('underline')}
          disabled={!canEdit}
          title="Underline"
        >
          <FiUnderline />
        </button>
        <button 
          className="toolbar-btn" 
          onClick={() => onFormat('bullet')}
          disabled={!canEdit}
          title="Bullet List"
        >
          <FiList />
        </button>
      </div>
      
      <div className="toolbar-group">
        <button 
          className="toolbar-btn history-btn"
          onClick={onShowHistory}
          title="Version History"
        >
          <FiClock />
          <span>History</span>
        </button>

        {canShare && (
          <button
            className="toolbar-btn share-btn"
            onClick={onShare}
            title="Share Document"
          >
            <FiShare2 />
            <span>Share</span>
          </button>
        )}
        
        <button 
          className={`toolbar-btn save-btn ${saving ? 'saving' : ''}`}
          onClick={onSave}
          disabled={saving || !canEdit}
        >
          <FiSave />
          <span>{saving ? 'Saving...' : 'Save'}</span>
        </button>

        <button
          className={`toolbar-btn version-save-btn ${savingVersion ? 'saving' : ''}`}
          onClick={onSaveVersion}
          disabled={savingVersion || !canEdit}
          title="Save Version"
        >
          <FiGitCommit />
          <span>{savingVersion ? 'Saving version...' : 'Save Version'}</span>
        </button>

        <button
          className="toolbar-btn download-btn"
          onClick={onDownload}
          title="Download Document"
        >
          <FiDownload />
          <span>Download</span>
        </button>
        
        {lastSaved && (
          <span className="save-status">
            Last saved: {lastSaved}
          </span>
        )}
      </div>
    </div>
  );
};

export default Toolbar;

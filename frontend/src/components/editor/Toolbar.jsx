import React from 'react';
import { 
  FiBold, FiItalic, FiUnderline, 
  FiList, FiSave, FiClock 
} from 'react-icons/fi';
import './Toolbar.css';

const Toolbar = ({ 
  onSave, 
  saving, 
  lastSaved, 
  onFormat, 
  onShowHistory 
}) => {
  return (
    <div className="editor-toolbar">
      <div className="toolbar-group">
        <button 
          className="toolbar-btn" 
          onClick={() => onFormat('bold')}
          title="Bold"
        >
          <FiBold />
        </button>
        <button 
          className="toolbar-btn" 
          onClick={() => onFormat('italic')}
          title="Italic"
        >
          <FiItalic />
        </button>
        <button 
          className="toolbar-btn" 
          onClick={() => onFormat('underline')}
          title="Underline"
        >
          <FiUnderline />
        </button>
        <button 
          className="toolbar-btn" 
          onClick={() => onFormat('bullet')}
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
        
        <button 
          className={`toolbar-btn save-btn ${saving ? 'saving' : ''}`}
          onClick={onSave}
          disabled={saving}
        >
          <FiSave />
          <span>{saving ? 'Saving...' : 'Save'}</span>
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
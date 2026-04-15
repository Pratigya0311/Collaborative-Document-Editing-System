import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import Toolbar from '../components/editor/Toolbar';
import VersionDiffViewer from '../components/editor/VersionDiffViewer';
import { documentsApi } from '../api/documents';
import { useDocumentSocket } from '../hooks/useDocumentSocket';
import { useDebouncedCallback } from '../hooks/useDebounce';
import { formatRelativeTime } from '../lib/utils';
import diffEngine from '../lib/diffEngine';
import Spinner from '../components/common/Spinner';
import toast from 'react-hot-toast';
import './DocumentEditorPage.css';

const DocumentEditorPage = () => {
  const { docId } = useParams();
  const navigate = useNavigate();
  const editorRef = useRef(null);
  
  const [document, setDocument] = useState(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [currentVersionId, setCurrentVersionId] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState(null);
  
  // WebSocket for real-time collaboration
  const { 
    connected, 
    activeUsers, 
    cursors, 
    typingUsers,
    sendCursorPosition,
    sendTypingStatus 
  } = useDocumentSocket(docId);
  
  // Load document
  useEffect(() => {
    loadDocument();
  }, [docId]);
  
  const loadDocument = async () => {
    try {
      const response = await documentsApi.getById(docId);
      setDocument(response.data);
      setContent(response.data.content || '');
      setCurrentVersionId(response.data.last_version_id);
    } catch (error) {
      console.error('Failed to load document:', error);
      toast.error('Failed to load document');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };
  
  // Auto-save with debounce
  const debouncedSave = useDebouncedCallback(async (newContent) => {
    await saveDocument(newContent);
  }, 2000);
  
  const saveDocument = async (contentToSave) => {
    if (!contentToSave || contentToSave === document?.content) return;
    
    setSaving(true);
    try {
      const response = await documentsApi.update(
        docId,
        contentToSave,
        currentVersionId,
        'Auto-save'
      );
      
      // Handle conflict
      if (response.status === 409) {
        toast.warning('Conflict detected. Merging changes...', {
          duration: 5000
        });
        
        // Reload document to get merged version
        await loadDocument();
      } else {
        setCurrentVersionId(response.data.version_id);
        setLastSaved(new Date());
        toast.success('Document saved', { duration: 1500 });
      }
    } catch (error) {
      console.error('Failed to save document:', error);
      toast.error('Failed to save document');
    } finally {
      setSaving(false);
    }
  };
  
  const handleContentChange = (e) => {
    const newContent = e.target.value;
    setContent(newContent);
    
    // Send typing status
    sendTypingStatus(true);
    setTimeout(() => sendTypingStatus(false), 1000);
    
    // Auto-save
    debouncedSave(newContent);
  };
  
  const handleManualSave = () => {
    saveDocument(content);
  };
  
  const handleCursorChange = (e) => {
    const position = {
      selectionStart: e.target.selectionStart,
      selectionEnd: e.target.selectionEnd
    };
    sendCursorPosition(position);
  };
  
  const handleFormat = (format) => {
    const textarea = editorRef.current;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    
    let formattedText = '';
    switch (format) {
      case 'bold':
        formattedText = `**${selectedText}**`;
        break;
      case 'italic':
        formattedText = `*${selectedText}*`;
        break;
      case 'underline':
        formattedText = `__${selectedText}__`;
        break;
      case 'bullet':
        formattedText = selectedText.split('\n').map(line => `• ${line}`).join('\n');
        break;
      default:
        return;
    }
    
    const newContent = content.substring(0, start) + formattedText + content.substring(end);
    setContent(newContent);
    debouncedSave(newContent);
    
    // Restore cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start, start + formattedText.length);
    }, 0);
  };
  
  const handleShowHistory = () => {
    setShowHistory(true);
  };
  
  if (loading) {
    return (
      <DashboardLayout>
        <div className="loading-container">
          <Spinner size="large" />
        </div>
      </DashboardLayout>
    );
  }
  
  return (
    <DashboardLayout>
      <div className="editor-page">
        <div className="editor-header">
          <div className="document-title-section">
            <h1>{document?.title}</h1>
            <div className="connection-status">
              <span className={`status-dot ${connected ? 'connected' : 'disconnected'}`}></span>
              <span>{connected ? `${activeUsers} active user${activeUsers !== 1 ? 's' : ''}` : 'Disconnected'}</span>
            </div>
          </div>
          
          <Toolbar
            onSave={handleManualSave}
            saving={saving}
            lastSaved={lastSaved ? formatRelativeTime(lastSaved) : null}
            onFormat={handleFormat}
            onShowHistory={handleShowHistory}
          />
        </div>
        
        <div className="editor-container">
          <textarea
            ref={editorRef}
            className="document-editor"
            value={content}
            onChange={handleContentChange}
            onSelect={handleCursorChange}
            onKeyUp={handleCursorChange}
            placeholder="Start typing..."
            spellCheck="false"
          />
          
          {/* Display other users' cursors */}
          {Object.entries(cursors).map(([userId, data]) => (
            <div
              key={userId}
              className="remote-cursor"
              style={{
                position: 'absolute',
                top: data.position ? `${data.position.selectionStart}px` : 0,
                left: 0
              }}
            >
              <div className="cursor-label">
                User {userId}
                {typingUsers.has(parseInt(userId)) && ' is typing...'}
              </div>
            </div>
          ))}
        </div>
        
        {/* Version History Modal */}
        {showHistory && (
          <>
            <div className="modal-overlay" onClick={() => setShowHistory(false)} />
            <VersionDiffViewer
              docId={docId}
              versionId={selectedVersionId || currentVersionId}
              onClose={() => {
                setShowHistory(false);
                setSelectedVersionId(null);
              }}
            />
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default DocumentEditorPage;
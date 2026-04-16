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
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [sharePermission, setSharePermission] = useState('edit');
  const [sharing, setSharing] = useState(false);
  const [collaborators, setCollaborators] = useState([]);
  const canEdit = document?.can_edit !== false;
  const canShare = document?.can_share === true;
  
  // WebSocket for real-time collaboration
  const { 
    connected, 
    activeUsers, 
    cursors, 
    typingUsers,
    latestRemoteSave,
    latestRemoteDraft,
    sendCursorPosition,
    sendTypingStatus,
    sendContentChange
  } = useDocumentSocket(docId);
  
  // Load document
  useEffect(() => {
    loadDocument();
  }, [docId]);

  useEffect(() => {
    if (!latestRemoteSave) return;

    if (String(latestRemoteSave.document_id) !== String(docId)) return;

    setContent(latestRemoteSave.content || '');
    setCurrentVersionId(latestRemoteSave.last_version_id || latestRemoteSave.version_id);
    setDocument((current) => ({
      ...current,
      content: latestRemoteSave.content || '',
      last_version_id: latestRemoteSave.last_version_id || latestRemoteSave.version_id,
      updated_at: latestRemoteSave.updated_at || current?.updated_at
    }));
    toast(`${latestRemoteSave.user_name || 'Another user'} saved changes`, { duration: 2500 });
  }, [latestRemoteSave]);

  useEffect(() => {
    if (!latestRemoteDraft) return;
    if (String(latestRemoteDraft.document_id) !== String(docId)) return;

    setContent(latestRemoteDraft.content || '');
    setDocument((current) => ({
      ...current,
      content: latestRemoteDraft.content || ''
    }));
  }, [latestRemoteDraft]);
  
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
    if (!canEdit) return;
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
        setDocument((current) => ({
          ...current,
          content: contentToSave,
          last_version_id: response.data.version_id
        }));
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
    if (!canEdit) return;
    setContent(newContent);
    
    // Send typing status
    sendTypingStatus(true);
    sendContentChange(newContent);
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
    if (!canEdit) return;
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

  const handleOpenShare = async () => {
    setShowShareModal(true);

    try {
      const response = await documentsApi.getCollaborators(docId);
      setCollaborators(response.data);
    } catch (error) {
      console.error('Failed to load collaborators:', error);
    }
  };

  const handleShareDocument = async (e) => {
    e.preventDefault();
    if (!shareEmail.trim()) return;

    setSharing(true);
    try {
      const response = await documentsApi.addCollaborator(
        docId,
        shareEmail.trim(),
        sharePermission
      );

      setCollaborators((current) => {
        const withoutExisting = current.filter(
          (item) => item.user_id !== response.data.user_id
        );
        return [...withoutExisting, response.data];
      });
      setShareEmail('');
      toast.success('Document shared successfully');
    } catch (error) {
      console.error('Failed to share document:', error);
      toast.error(error.response?.data?.message || error.response?.data?.error || 'Failed to share document');
    } finally {
      setSharing(false);
    }
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
            onShare={handleOpenShare}
            canEdit={canEdit}
            canShare={canShare}
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
            readOnly={!canEdit}
          />
          {!canEdit && (
            <div className="view-only-banner">
              You have view access. Ask an owner for edit permission to make changes.
            </div>
          )}
          
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
                {data.user_name || `User ${userId}`}
                {typingUsers.has(String(userId)) && ' is typing...'}
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

        {showShareModal && (
          <div className="modal-overlay" onClick={() => setShowShareModal(false)}>
            <div className="share-modal" onClick={(e) => e.stopPropagation()}>
              <div className="share-modal-header">
                <h2>Share Document</h2>
                <button
                  className="modal-close"
                  onClick={() => setShowShareModal(false)}
                >
                  x
                </button>
              </div>

              <form onSubmit={handleShareDocument} className="share-form">
                <label htmlFor="share-email">User email</label>
                <div className="share-row">
                  <input
                    id="share-email"
                    type="email"
                    value={shareEmail}
                    onChange={(e) => setShareEmail(e.target.value)}
                    placeholder="friend@example.com"
                    required
                  />
                  <select
                    value={sharePermission}
                    onChange={(e) => setSharePermission(e.target.value)}
                  >
                    <option value="edit">Can edit</option>
                    <option value="view">Can view</option>
                    <option value="owner">Owner</option>
                  </select>
                  <button type="submit" disabled={sharing}>
                    {sharing ? 'Adding...' : 'Add'}
                  </button>
                </div>
              </form>

              <div className="collaborators-list">
                <h3>People with access</h3>
                {collaborators.length === 0 ? (
                  <p className="empty-collaborators">No collaborators added yet.</p>
                ) : (
                  collaborators.map((person) => (
                    <div key={person.collaborator_id} className="collaborator-item">
                      <div>
                        <strong>{person.user_name || person.user_email}</strong>
                        <span>{person.user_email}</span>
                      </div>
                      <span className="permission-badge">{person.permission}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default DocumentEditorPage;

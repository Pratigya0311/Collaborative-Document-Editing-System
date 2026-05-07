import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import Toolbar from '../components/editor/Toolbar';
import { commentsApi, documentsApi, locksApi, versionsApi } from '../api/documents';
import { useDocumentSocket } from '../hooks/useDocumentSocket';
import { useDebouncedCallback } from '../hooks/useDebounce';
import { formatRelativeTime } from '../lib/utils';
import {
  decorateEditorAnnotations,
  focusAnnotation,
  getMissingCommentAnchors,
  moveCaretOutOfAnnotation,
  repairCommentBoundaries,
  unwrapAnnotation,
  wrapSelectionWithAnnotation
} from '../lib/annotationUtils';
import Spinner from '../components/common/Spinner';
import toast from 'react-hot-toast';
import './DocumentEditorPage.css';

const DocumentEditorPage = () => {
  const { docId } = useParams();
  const navigate = useNavigate();
  const editorRef = useRef(null);

  const [documentData, setDocumentData] = useState(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingVersion, setSavingVersion] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [currentVersionId, setCurrentVersionId] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [sharePermission, setSharePermission] = useState('edit');
  const [sharing, setSharing] = useState(false);
  const [collaborators, setCollaborators] = useState([]);
  const [comments, setComments] = useState([]);
  const [locks, setLocks] = useState([]);
  const deletingMissingCommentsRef = useRef(new Set());
  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    underline: false,
    bullet: false
  });

  const canEdit = documentData?.can_edit !== false;
  const canShare = documentData?.can_share === true;
  const canLock = documentData?.is_real_owner === true;

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

  const syncEditorHtml = (html) => {
    if (!editorRef.current) return;
    if (editorRef.current.innerHTML !== (html || '')) {
      editorRef.current.innerHTML = html || '';
    }
    decorateEditorAnnotations(editorRef.current);
  };

  const getEditorHtml = () => editorRef.current?.innerHTML || '';

  const refreshAnnotations = async () => {
    try {
      const [commentsResponse, locksResponse] = await Promise.all([
        commentsApi.getByDocument(docId),
        locksApi.getByDocument(docId)
      ]);
      setComments(commentsResponse.data);
      setLocks(locksResponse.data);
    } catch (error) {
      console.error('Failed to refresh annotations:', error);
    }
  };

  const updateActiveFormats = () => {
    if (!editorRef.current) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      setActiveFormats({ bold: false, italic: false, underline: false, bullet: false });
      return;
    }

    const anchorNode = selection.anchorNode;
    if (!anchorNode || !editorRef.current.contains(anchorNode)) {
      setActiveFormats({ bold: false, italic: false, underline: false, bullet: false });
      return;
    }

    setActiveFormats({
      bold: Boolean(document.queryCommandState('bold')),
      italic: Boolean(document.queryCommandState('italic')),
      underline: Boolean(document.queryCommandState('underline')),
      bullet: Boolean(document.queryCommandState('insertUnorderedList'))
    });
  };

  const loadDocument = async () => {
    try {
      const response = await documentsApi.getById(docId);
      setDocumentData(response.data);
      setContent(response.data.content || '');
      setCurrentVersionId(response.data.last_version_id);
      syncEditorHtml(response.data.content || '');
    } catch (error) {
      console.error('Failed to load document:', error);
      toast.error('Failed to load document');
      navigate('/dashboard');
    }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([loadDocument(), refreshAnnotations()]).finally(() => setLoading(false));
  }, [docId]);

  useEffect(() => {
    const handleSelectionChange = () => updateActiveFormats();
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, []);

  useEffect(() => {
    syncEditorHtml(content);
  }, [loading]);

  useEffect(() => {
    if (!latestRemoteSave) return;
    if (String(latestRemoteSave.document_id) !== String(docId)) return;

    const nextContent = latestRemoteSave.content || '';
    setContent(nextContent);
    syncEditorHtml(nextContent);
    setCurrentVersionId(latestRemoteSave.last_version_id || latestRemoteSave.version_id);
    setDocumentData((current) => ({
      ...current,
      content: nextContent,
      last_version_id: latestRemoteSave.last_version_id || latestRemoteSave.version_id,
      updated_at: latestRemoteSave.updated_at || current?.updated_at
    }));
    refreshAnnotations();
    toast(`${latestRemoteSave.user_name || 'Another user'} updated the document`, { duration: 2500 });
  }, [latestRemoteSave, docId]);

  useEffect(() => {
    if (!latestRemoteDraft) return;
    if (String(latestRemoteDraft.document_id) !== String(docId)) return;

    const nextContent = latestRemoteDraft.content || '';
    setContent(nextContent);
    syncEditorHtml(nextContent);
    setDocumentData((current) => ({
      ...current,
      content: nextContent
    }));
  }, [latestRemoteDraft, docId]);

  const debouncedSave = useDebouncedCallback(async (newContent) => {
    await saveDocument(newContent);
  }, 2000);

  const saveDocument = async (contentToSave) => {
    if (!canEdit) return;
    if (contentToSave === documentData?.content) return;

    setSaving(true);
    try {
      const response = await documentsApi.update(docId, contentToSave, currentVersionId, 'Auto-save');
      setCurrentVersionId(response.data.version_id);
      setDocumentData((current) => ({
        ...current,
        content: contentToSave,
        last_version_id: response.data.version_id
      }));
      setLastSaved(new Date());
    } catch (error) {
      console.error('Failed to save document:', error);
      const status = error.response?.status;
      if (status === 409) {
        toast.error('Conflict detected. Reloading the latest version.');
        await loadDocument();
      } else if (status === 423) {
        toast.error(error.response?.data?.message || 'That text is locked by the owner.');
        await loadDocument();
      } else {
        toast.error('Failed to save document');
      }
      await refreshAnnotations();
    } finally {
      setSaving(false);
    }
  };

  const handleContentChange = (e) => {
    if (!canEdit) return;

    repairCommentBoundaries(editorRef.current, comments);
    const newContent = e.currentTarget.innerHTML;
    const missingComments = getMissingCommentAnchors(editorRef.current, comments);

    if (missingComments.length > 0) {
      setComments((current) => current.filter((comment) => (
        !missingComments.some((missing) => missing.comment_id === comment.comment_id)
      )));

      missingComments.forEach((comment) => {
        if (deletingMissingCommentsRef.current.has(comment.comment_id)) return;

        deletingMissingCommentsRef.current.add(comment.comment_id);
        commentsApi.delete(comment.comment_id, {
          content: newContent,
          base_version_id: currentVersionId
        }).then((response) => {
          setCurrentVersionId(response.data.version_id);
          setDocumentData((current) => ({
            ...current,
            content: response.data.content || newContent,
            last_version_id: response.data.version_id
          }));
        }).catch((error) => {
          console.error('Failed to delete removed comment:', error);
          refreshAnnotations();
        }).finally(() => {
          deletingMissingCommentsRef.current.delete(comment.comment_id);
        });
      });
    }

    setContent(newContent);
    sendTypingStatus(true);
    sendContentChange(newContent);
    window.setTimeout(() => sendTypingStatus(false), 1000);
    debouncedSave(newContent);
  };

  const handleManualSave = () => saveDocument(getEditorHtml());

  const handleDownload = async () => {
    try {
      const response = await documentsApi.download(docId);
      const blob = new Blob([response.data], { type: 'text/plain;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const anchor = window.document.createElement('a');
      anchor.href = url;
      anchor.download = `${(documentData?.title || 'document').replace(/[^\w-]+/g, '_')}.txt`;
      window.document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download document:', error);
      toast.error(error.response?.data?.message || 'Failed to download document');
    }
  };

  const handleSaveVersion = async () => {
    if (!canEdit) return;

    const summary = window.prompt('Version message', 'Saved version');
    if (summary === null) return;

    setSavingVersion(true);
    try {
      const response = await versionsApi.saveVersion(
        docId,
        getEditorHtml(),
        currentVersionId,
        summary.trim() || 'Saved version'
      );

      setCurrentVersionId(response.data.version_id);
      setDocumentData((current) => ({
        ...current,
        content: getEditorHtml(),
        last_version_id: response.data.version_id
      }));
      setLastSaved(new Date());
      toast.success('Version saved to history');
    } catch (error) {
      console.error('Failed to save version:', error);
      toast.error(error.response?.data?.message || 'Failed to save version');
    } finally {
      setSavingVersion(false);
    }
  };

  const handleCursorChange = () => {
    moveCaretOutOfAnnotation(editorRef.current);
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    sendCursorPosition({
      selectionStart: range.startOffset,
      selectionEnd: range.endOffset
    });
    updateActiveFormats();
  };

  const handleFormat = (format) => {
    if (!canEdit || !editorRef.current) return;

    editorRef.current.focus();

    switch (format) {
      case 'bold':
        document.execCommand('bold');
        break;
      case 'italic':
        document.execCommand('italic');
        break;
      case 'underline':
        document.execCommand('underline');
        break;
      case 'bullet':
        document.execCommand('insertUnorderedList');
        break;
      default:
        return;
    }

    const newContent = getEditorHtml();
    setContent(newContent);
    decorateEditorAnnotations(editorRef.current);
    sendContentChange(newContent);
    debouncedSave(newContent);
    updateActiveFormats();
  };

  const handleAddComment = async () => {
    if (!canEdit || !editorRef.current) return;

    const body = window.prompt('Comment for selected text');
    if (!body || !body.trim()) return;

    const anchorId = crypto.randomUUID();
    const wrapped = wrapSelectionWithAnnotation(editorRef.current, 'comment', anchorId);
    if (wrapped.error) {
      toast.error(wrapped.error);
      return;
    }

    const updatedContent = getEditorHtml();
    setContent(updatedContent);

    try {
      const response = await commentsApi.create(docId, {
        content: updatedContent,
        anchor_id: anchorId,
        body: body.trim(),
        base_version_id: currentVersionId
      });

      setComments((current) => [...current, response.data.comment]);
      setCurrentVersionId(response.data.version_id);
      editorRef.current?.focus();
      setDocumentData((current) => ({
        ...current,
        content: updatedContent,
        last_version_id: response.data.version_id
      }));
      setLastSaved(new Date());
      toast.success('Comment added to selected text');
    } catch (error) {
      console.error('Failed to create comment:', error);
      toast.error(error.response?.data?.message || 'Failed to create comment');
      await loadDocument();
      await refreshAnnotations();
    }
  };

  const handleDeleteComment = async (comment) => {
    if (!editorRef.current) return;
    if (!window.confirm('Delete this comment?')) return;

    const removed = unwrapAnnotation(editorRef.current, `[data-comment-id="${comment.anchor_id}"]`);
    if (!removed) {
      toast.error('Comment highlight was not found in the document.');
      return;
    }

    const updatedContent = getEditorHtml();
    setContent(updatedContent);

    try {
      const response = await commentsApi.delete(comment.comment_id, {
        content: updatedContent,
        base_version_id: currentVersionId
      });
      setComments((current) => current.filter((item) => item.comment_id !== comment.comment_id));
      setCurrentVersionId(response.data.version_id);
      const nextContent = response.data.content || updatedContent;
      syncEditorHtml(nextContent);
      setDocumentData((current) => ({
        ...current,
        content: nextContent,
        last_version_id: response.data.version_id
      }));
      setContent(nextContent);
      toast.success('Comment deleted');
    } catch (error) {
      console.error('Failed to delete comment:', error);
      toast.error(error.response?.data?.message || 'Failed to delete comment');
      await loadDocument();
      await refreshAnnotations();
    }
  };

  const handleLockSelection = async () => {
    if (!canEdit || !canLock || !editorRef.current) return;

    const lockId = crypto.randomUUID();
    const wrapped = wrapSelectionWithAnnotation(editorRef.current, 'lock', lockId);
    if (wrapped.error) {
      toast.error(wrapped.error);
      return;
    }

    const updatedContent = getEditorHtml();
    setContent(updatedContent);

    try {
      const response = await locksApi.create(docId, {
        content: updatedContent,
        lock_id: lockId,
        base_version_id: currentVersionId
      });
      setLocks((current) => [...current, response.data.lock]);
      setCurrentVersionId(response.data.version_id);
      setDocumentData((current) => ({
        ...current,
        content: updatedContent,
        last_version_id: response.data.version_id
      }));
      toast.success('Selected text locked for everyone');
    } catch (error) {
      console.error('Failed to lock text:', error);
      toast.error(error.response?.data?.message || 'Failed to lock text');
      await loadDocument();
      await refreshAnnotations();
    }
  };

  const handleUnlockText = async (lock) => {
    if (!editorRef.current || !canLock) return;
    if (!window.confirm('Unlock this selected text?')) return;

    const removed = unwrapAnnotation(editorRef.current, `[data-lock-id="${lock.lock_id}"]`);
    if (!removed) {
      toast.error('Locked text was not found in the document.');
      return;
    }

    const updatedContent = getEditorHtml();
    setContent(updatedContent);

    try {
      const response = await locksApi.delete(lock.lock_id, {
        content: updatedContent,
        base_version_id: currentVersionId
      });
      setLocks((current) => current.filter((item) => item.lock_id !== lock.lock_id));
      setCurrentVersionId(response.data.version_id);
      setDocumentData((current) => ({
        ...current,
        content: updatedContent,
        last_version_id: response.data.version_id
      }));
      toast.success('Locked text is editable again');
    } catch (error) {
      console.error('Failed to unlock text:', error);
      toast.error(error.response?.data?.message || 'Failed to unlock text');
      await loadDocument();
      await refreshAnnotations();
    }
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
      const response = await documentsApi.addCollaborator(docId, shareEmail.trim(), sharePermission);
      setCollaborators((current) => {
        const withoutExisting = current.filter((item) => item.user_id !== response.data.user_id);
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

  const handleChangeCollaboratorPermission = async (collaboratorId, permission) => {
    try {
      const response = await documentsApi.updateCollaborator(docId, collaboratorId, permission);
      setCollaborators((current) => current.map((person) => (
        person.collaborator_id === collaboratorId ? response.data : person
      )));
      toast.success('Access updated');
    } catch (error) {
      console.error('Failed to update access:', error);
      toast.error(error.response?.data?.message || error.response?.data?.error || 'Failed to update access');
    }
  };

  const handleRemoveCollaborator = async (collaboratorId) => {
    if (!window.confirm('Remove this person from the document?')) return;

    try {
      await documentsApi.removeCollaborator(docId, collaboratorId);
      setCollaborators((current) => current.filter((person) => person.collaborator_id !== collaboratorId));
      toast.success('Access removed');
    } catch (error) {
      console.error('Failed to remove access:', error);
      toast.error(error.response?.data?.message || error.response?.data?.error || 'Failed to remove access');
    }
  };

  const handleLockEveryoneToView = async () => {
    if (!window.confirm('Set every shared person to view-only?')) return;

    try {
      const response = await documentsApi.lockCollaboratorsToView(docId);
      setCollaborators(response.data);
      toast.success('All shared users are now view-only');
    } catch (error) {
      console.error('Failed to lock access:', error);
      toast.error(error.response?.data?.message || error.response?.data?.error || 'Failed to lock access');
    }
  };

  const focusComment = (comment) => {
    const found = focusAnnotation(editorRef.current, `[data-comment-id="${comment.anchor_id}"]`);
    if (!found) {
      toast.error('That commented text is no longer visible in the editor.');
    }
  };

  const focusLock = (lock) => {
    const found = focusAnnotation(editorRef.current, `[data-lock-id="${lock.lock_id}"]`);
    if (!found) {
      toast.error('That locked text is no longer visible in the editor.');
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
            <h1>{documentData?.title}</h1>
            <div className="connection-status">
              <span className={`status-dot ${connected ? 'connected' : 'disconnected'}`}></span>
              <span>{connected ? `${activeUsers} active user${activeUsers !== 1 ? 's' : ''}` : 'Disconnected'}</span>
            </div>
          </div>

          <Toolbar
            onSave={handleManualSave}
            onSaveVersion={handleSaveVersion}
            onDownload={handleDownload}
            onAddComment={handleAddComment}
            onLockSelection={handleLockSelection}
            saving={saving}
            savingVersion={savingVersion}
            lastSaved={lastSaved ? formatRelativeTime(lastSaved) : null}
            onFormat={handleFormat}
            onShowHistory={() => navigate(`/history/${docId}`)}
            onShare={handleOpenShare}
            activeFormats={activeFormats}
            canEdit={canEdit}
            canShare={canShare}
            canLock={canLock}
          />
        </div>

        <div className="editor-workspace">
          <div className="editor-container">
            <div
              ref={editorRef}
              className={`document-editor ${!canEdit ? 'read-only' : ''}`}
              contentEditable={canEdit}
              suppressContentEditableWarning={true}
              data-placeholder="Start typing..."
              spellCheck={false}
              onBeforeInput={() => moveCaretOutOfAnnotation(editorRef.current)}
              onInput={handleContentChange}
              onMouseUp={handleCursorChange}
              onKeyUp={handleCursorChange}
            />

            {!canEdit && (
              <div className="view-only-banner">
                You have view access. Ask an owner for edit permission to make changes.
              </div>
            )}

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

          <aside className="annotation-sidebar">
            <section className="annotation-panel">
              <div className="annotation-panel-header">
                <h2>Selected Text Comments</h2>
                <span>{comments.length}</span>
              </div>
              {comments.length === 0 ? (
                <p className="annotation-empty">Select text and use Comment to attach feedback.</p>
              ) : (
                comments.map((comment) => (
                  <article key={comment.comment_id} className="annotation-card">
                    <button
                      type="button"
                      className="annotation-quote"
                      onClick={() => focusComment(comment)}
                    >
                      "{comment.selected_text}"
                    </button>
                    <p>{comment.body}</p>
                    <div className="annotation-meta">
                      <span>{comment.user_name || 'Unknown user'}</span>
                      <button
                        type="button"
                        className="annotation-delete"
                        onClick={() => handleDeleteComment(comment)}
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                ))
              )}
            </section>

            <section className="annotation-panel">
              <div className="annotation-panel-header">
                <h2>Locked Text</h2>
                <span>{locks.length}</span>
              </div>
              {locks.length === 0 ? (
                <p className="annotation-empty">
                  {canLock
                    ? 'Select text and use Lock Text to make it immutable for everyone.'
                    : 'The owner has not locked any text yet.'}
                </p>
              ) : (
                locks.map((lock) => (
                  <article key={lock.lock_id} className="annotation-card lock-card">
                    <button
                      type="button"
                      className="annotation-quote"
                      onClick={() => focusLock(lock)}
                    >
                      "{lock.selected_text}"
                    </button>
                    <div className="annotation-meta">
                      <span>{lock.created_by_name || 'Owner lock'}</span>
                      {canLock && (
                        <button
                          type="button"
                          className="annotation-delete"
                          onClick={() => handleUnlockText(lock)}
                        >
                          Unlock
                        </button>
                      )}
                    </div>
                  </article>
                ))
              )}
            </section>
          </aside>
        </div>

        {showShareModal && (
          <div className="modal-overlay" onClick={() => setShowShareModal(false)}>
            <div className="share-modal" onClick={(e) => e.stopPropagation()}>
              <div className="share-modal-header">
                <h2>Share and Access</h2>
                <button className="modal-close" onClick={() => setShowShareModal(false)}>
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

              {canShare && collaborators.length > 0 && (
                <button
                  type="button"
                  className="lock-view-btn"
                  onClick={handleLockEveryoneToView}
                >
                  Set everyone to view-only
                </button>
              )}

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
                      {canShare ? (
                        <div className="access-actions">
                          <select
                            value={person.permission}
                            onChange={(e) => handleChangeCollaboratorPermission(
                              person.collaborator_id,
                              e.target.value
                            )}
                          >
                            <option value="view">Can view</option>
                            <option value="edit">Can edit</option>
                            <option value="owner">Owner</option>
                          </select>
                          <button
                            type="button"
                            className="remove-access-btn"
                            onClick={() => handleRemoveCollaborator(person.collaborator_id)}
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <span className="permission-badge">{person.permission}</span>
                      )}
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

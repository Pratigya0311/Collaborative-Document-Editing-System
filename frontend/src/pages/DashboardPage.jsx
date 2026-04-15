import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import { documentsApi } from '../api/documents';
import { FiPlus, FiEdit2, FiTrash2, FiClock } from 'react-icons/fi';
import { formatRelativeTime } from '../lib/utils';
import Spinner from '../components/common/Spinner';
import toast from 'react-hot-toast';
import './DashboardPage.css';

const DashboardPage = () => {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [creating, setCreating] = useState(false);
  
  useEffect(() => {
    loadDocuments();
  }, []);
  
  const loadDocuments = async () => {
    try {
      const response = await documentsApi.getAll();
      setDocuments(response.data);
    } catch (error) {
      console.error('Failed to load documents:', error);
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };
  
  const handleCreateDocument = async (e) => {
    e.preventDefault();
    if (!newDocTitle.trim()) return;
    
    setCreating(true);
    try {
      const response = await documentsApi.create({
        title: newDocTitle,
        content: ''
      });
      
      toast.success('Document created successfully');
      setShowCreateModal(false);
      setNewDocTitle('');
      
      // Navigate to editor
      navigate(`/editor/${response.data.doc_id}`);
    } catch (error) {
      console.error('Failed to create document:', error);
      toast.error('Failed to create document');
    } finally {
      setCreating(false);
    }
  };
  
  const handleDeleteDocument = async (docId, title) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"?`)) {
      return;
    }
    
    try {
      await documentsApi.delete(docId);
      toast.success('Document deleted successfully');
      setDocuments(documents.filter(doc => doc.doc_id !== docId));
    } catch (error) {
      console.error('Failed to delete document:', error);
      toast.error('Failed to delete document');
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
      <div className="dashboard-page">
        <div className="dashboard-header">
          <h1>My Documents</h1>
          <button 
            className="create-doc-btn"
            onClick={() => setShowCreateModal(true)}
          >
            <FiPlus />
            <span>New Document</span>
          </button>
        </div>
        
        {documents.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📄</div>
            <h3>No documents yet</h3>
            <p>Create your first document to get started!</p>
            <button 
              className="create-first-btn"
              onClick={() => setShowCreateModal(true)}
            >
              <FiPlus />
              <span>Create Document</span>
            </button>
          </div>
        ) : (
          <div className="documents-grid">
            {documents.map(doc => (
              <div key={doc.doc_id} className="document-card">
                <div className="document-card-header">
                  <h3>{doc.title}</h3>
                  <div className="document-actions">
                    <button
                      className="action-btn"
                      onClick={() => navigate(`/editor/${doc.doc_id}`)}
                      title="Edit"
                    >
                      <FiEdit2 />
                    </button>
                    <button
                      className="action-btn delete"
                      onClick={() => handleDeleteDocument(doc.doc_id, doc.title)}
                      title="Delete"
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                </div>
                
                <div className="document-preview">
                  {doc.content ? (
                    <p>{doc.content.substring(0, 150)}...</p>
                  ) : (
                    <p className="empty-preview">Empty document</p>
                  )}
                </div>
                
                <div className="document-footer">
                  <div className="document-meta">
                    <FiClock />
                    <span>Updated {formatRelativeTime(doc.updated_at)}</span>
                  </div>
                  <button
                    className="history-link"
                    onClick={() => navigate(`/history/${doc.doc_id}`)}
                  >
                    View History
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Create Document Modal */}
        {showCreateModal && (
          <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Create New Document</h2>
                <button 
                  className="modal-close"
                  onClick={() => setShowCreateModal(false)}
                >
                  ×
                </button>
              </div>
              
              <form onSubmit={handleCreateDocument}>
                <div className="form-group">
                  <label htmlFor="title">Document Title</label>
                  <input
                    type="text"
                    id="title"
                    value={newDocTitle}
                    onChange={(e) => setNewDocTitle(e.target.value)}
                    placeholder="Enter document title"
                    autoFocus
                    required
                  />
                </div>
                
                <div className="modal-actions">
                  <button
                    type="button"
                    className="cancel-btn"
                    onClick={() => setShowCreateModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="create-btn"
                    disabled={creating || !newDocTitle.trim()}
                  >
                    {creating ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default DashboardPage;
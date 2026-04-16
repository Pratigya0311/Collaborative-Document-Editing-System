import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import { versionsApi, documentsApi } from '../api/documents';
import { FiArrowLeft, FiRotateCcw, FiEye, FiTrash2 } from 'react-icons/fi';
import { formatDateTime } from '../lib/utils';
import Spinner from '../components/common/Spinner';
import toast from 'react-hot-toast';
import './VersionHistoryPage.css';

const VersionHistoryPage = () => {
  const { docId } = useParams();
  const navigate = useNavigate();
  
  const [document, setDocument] = useState(null);
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState(false);

  const getSavedVersionLabel = (index) => {
    const count = versions.length - index;
    return `Saved Version ${count}`;
  };
  
  useEffect(() => {
    loadData();
  }, [docId]);
  
  const loadData = async () => {
    try {
      const [docResponse, versionsResponse] = await Promise.all([
        documentsApi.getById(docId),
        versionsApi.getHistory(docId)
      ]);
      
      setDocument(docResponse.data);
      setVersions(versionsResponse.data.versions);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load version history');
    } finally {
      setLoading(false);
    }
  };
  
  const handleRestore = async (versionId) => {
    if (!window.confirm('Are you sure you want to restore this version?')) {
      return;
    }
    
    setRestoring(true);
    try {
      await versionsApi.rollback(docId, versionId);
      toast.success('Document restored successfully');
      navigate(`/editor/${docId}`);
    } catch (error) {
      console.error('Failed to restore version:', error);
      toast.error('Failed to restore version');
    } finally {
      setRestoring(false);
    }
  };
  
  const handleViewVersion = (versionId) => {
    navigate(`/history/${docId}/view/${versionId}`);
  };

  const handleDeleteSavedVersion = async (versionId) => {
    if (!window.confirm('Delete this saved version from history for everyone?')) {
      return;
    }

    try {
      await versionsApi.deleteVersion(versionId);
      setVersions((current) => current.filter((version) => version.version_id !== versionId));
      toast.success('Saved version deleted');
    } catch (error) {
      console.error('Failed to delete saved version:', error);
      toast.error(error.response?.data?.message || 'Failed to delete saved version');
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
      <div className="history-page">
        <div className="history-header">
          <button className="back-btn" onClick={() => navigate(`/editor/${docId}`)}>
            <FiArrowLeft />
            <span>Back to Editor</span>
          </button>
          
          <h1>Saved Versions - {document?.title}</h1>
        </div>
        
        <div className="versions-list">
          {document && (
            <div className="version-item current-version-item">
              <div className="version-info">
                <div className="version-number">
                  Current Version
                  <span className="current-badge">Working Copy</span>
                </div>

                <div className="version-meta">
                  <span>Edited by: {document.owner_name || 'Current user'}</span>
                  <span>Date: {formatDateTime(document.updated_at)}</span>
                  <span className="change-summary">Current document state</span>
                </div>
              </div>

              <div className="version-actions">
                  <button
                    className="view-btn"
                    onClick={() => handleViewVersion('current')}
                  >
                  <FiEye />
                  <span>View</span>
                </button>
              </div>
            </div>
          )}

          {versions.length === 0 ? (
            <div className="empty-state">
              <p>No saved versions yet. Use Save Version from the editor to create a rollback point.</p>
            </div>
          ) : (
            versions.map((version, index) => (
              <div key={version.version_id} className="version-item">
                <div className="version-info">
                  <div className="version-number">
                    {getSavedVersionLabel(index)}
                    {index === 0 && <span className="current-badge">Current</span>}
                  </div>
                  
                  <div className="version-meta">
                    <span>Edited by: {version.editor_name}</span>
                    <span>Date: {formatDateTime(version.timestamp)}</span>
                    {version.change_summary && (
                      <span className="change-summary">
                        Message: {version.change_summary}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="version-actions">
                  <button
                    className="view-btn"
                    onClick={() => handleViewVersion(version.version_id)}
                  >
                    <FiEye />
                    <span>View</span>
                  </button>

                  <button
                    className="restore-btn"
                    onClick={() => handleRestore(version.version_id)}
                    disabled={restoring}
                  >
                    <FiRotateCcw />
                    <span>Restore</span>
                  </button>

                  {document?.is_real_owner && (
                    <button
                      className="delete-version-btn"
                      onClick={() => handleDeleteSavedVersion(version.version_id)}
                    >
                      <FiTrash2 />
                      <span>Delete</span>
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
        
      </div>
    </DashboardLayout>
  );
};

export default VersionHistoryPage;

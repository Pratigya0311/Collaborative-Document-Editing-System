import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import { versionsApi, documentsApi } from '../api/documents';
import { FiArrowLeft, FiRotateCcw, FiEye } from 'react-icons/fi';
import { formatDateTime } from '../lib/utils';
import VersionDiffViewer from '../components/editor/VersionDiffViewer';
import Spinner from '../components/common/Spinner';
import toast from 'react-hot-toast';
import './VersionHistoryPage.css';

const VersionHistoryPage = () => {
  const { docId } = useParams();
  const navigate = useNavigate();
  
  const [document, setDocument] = useState(null);
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [showDiffViewer, setShowDiffViewer] = useState(false);
  const [restoring, setRestoring] = useState(false);
  
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
  
  const handleViewVersion = (version) => {
    setSelectedVersion(version);
    setShowDiffViewer(true);
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
          
          <h1>Version History - {document?.title}</h1>
        </div>
        
        <div className="versions-list">
          {versions.length === 0 ? (
            <div className="empty-state">
              <p>No version history available</p>
            </div>
          ) : (
            versions.map((version, index) => (
              <div key={version.version_id} className="version-item">
                <div className="version-info">
                  <div className="version-number">
                    Version {version.version_number}
                    {index === 0 && <span className="current-badge">Current</span>}
                  </div>
                  
                  <div className="version-meta">
                    <span>Edited by: {version.editor_name}</span>
                    <span>Date: {formatDateTime(version.timestamp)}</span>
                    {version.change_summary && (
                      <span className="change-summary">
                        Summary: {version.change_summary}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="version-actions">
                  <button
                    className="view-btn"
                    onClick={() => handleViewVersion(version)}
                  >
                    <FiEye />
                    <span>View</span>
                  </button>
                  
                  {index !== 0 && (
                    <button
                      className="restore-btn"
                      onClick={() => handleRestore(version.version_id)}
                      disabled={restoring}
                    >
                      <FiRotateCcw />
                      <span>Restore</span>
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
        
        {/* Version Diff Viewer Modal */}
        {showDiffViewer && selectedVersion && (
          <>
            <div className="modal-overlay" onClick={() => setShowDiffViewer(false)} />
            <VersionDiffViewer
              docId={docId}
              versionId={selectedVersion.version_id}
              onClose={() => {
                setShowDiffViewer(false);
                setSelectedVersion(null);
              }}
            />
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default VersionHistoryPage;
import React, { useEffect, useState } from 'react';
import { versionsApi } from '../../api/documents';
import Spinner from '../common/Spinner';
import './VersionDiffViewer.css';

const VersionDiffViewer = ({ docId, versionId, onClose, initialVersion = null, fullPage = false, versionLabel = 'Saved Version' }) => {
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(null);

  useEffect(() => {
    const loadVersion = async () => {
      if (versionId === 'current') {
        setVersion(initialVersion);
        setLoading(false);
        return;
      }

      try {
        const response = await versionsApi.getVersion(versionId);
        setVersion(response.data);
      } catch (error) {
        console.error('Failed to load version:', error);
      } finally {
        setLoading(false);
      }
    };

    setLoading(true);
    loadVersion();
  }, [docId, versionId, initialVersion]);

  if (loading) return <Spinner />;
  if (!version) return <div>Version not found</div>;

  return (
    <div className={`version-diff-viewer ${fullPage ? 'full-page' : ''}`}>
      <div className="diff-header">
        <h3>{versionLabel}</h3>
        {onClose && <button className="close-btn" onClick={onClose}>x</button>}
      </div>

      <div className="diff-content">
        <div className="version-content">
          <pre>{version.content}</pre>
        </div>
      </div>

      <div className="diff-footer">
        <div className="version-meta">
          <span>Edited by: {version.editor_name}</span>
          <span>Date: {new Date(version.timestamp).toLocaleString()}</span>
          {version.change_summary && (
            <span>Message: {version.change_summary}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default VersionDiffViewer;

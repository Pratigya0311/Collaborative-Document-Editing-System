import React, { useState, useEffect } from 'react';
import { versionsApi } from '../../api/documents';
import diffEngine from '../../lib/diffEngine';
import Spinner from '../common/Spinner';
import './VersionDiffViewer.css';

const VersionDiffViewer = ({ docId, versionId, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(null);
  const [diffData, setDiffData] = useState(null);
  const [compareVersionId, setCompareVersionId] = useState(null);
  const [versions, setVersions] = useState([]);
  
  useEffect(() => {
    loadVersionData();
    loadVersionList();
  }, [docId, versionId]);
  
  const loadVersionData = async () => {
    try {
      const response = await versionsApi.getVersion(versionId);
      setVersion(response.data);
      
      if (compareVersionId) {
        const diffResponse = await versionsApi.getDiff(versionId, compareVersionId);
        const formattedDiff = diffEngine.formatDiffForDisplay(diffResponse.data.diff);
        setDiffData(formattedDiff);
      }
    } catch (error) {
      console.error('Failed to load version:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const loadVersionList = async () => {
    try {
      const response = await versionsApi.getHistory(docId, 1, 50);
      setVersions(response.data.versions);
    } catch (error) {
      console.error('Failed to load versions:', error);
    }
  };
  
  const handleCompareChange = (e) => {
    const newCompareId = parseInt(e.target.value);
    setCompareVersionId(newCompareId);
    if (newCompareId) {
      loadDiff(versionId, newCompareId);
    } else {
      setDiffData(null);
    }
  };
  
  const loadDiff = async (v1, v2) => {
    try {
      const response = await versionsApi.getDiff(v1, v2);
      const formattedDiff = diffEngine.formatDiffForDisplay(response.data.diff);
      setDiffData(formattedDiff);
    } catch (error) {
      console.error('Failed to load diff:', error);
    }
  };
  
  if (loading) return <Spinner />;
  if (!version) return <div>Version not found</div>;
  
  return (
    <div className="version-diff-viewer">
      <div className="diff-header">
        <h3>Version {version.version_number}</h3>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>
      
      <div className="diff-controls">
        <label>Compare with:</label>
        <select value={compareVersionId || ''} onChange={handleCompareChange}>
          <option value="">Select version...</option>
          {versions.map(v => (
            <option key={v.version_id} value={v.version_id}>
              Version {v.version_number} - {new Date(v.timestamp).toLocaleString()}
            </option>
          ))}
        </select>
      </div>
      
      <div className="diff-content">
        {diffData ? (
          <div className="diff-lines">
            {diffData.map((diff, index) => (
              <div key={index} className={`diff-line diff-${diff.type}`}>
                {diff.text.split('\n').map((line, i) => (
                  <div key={i} className="diff-text">
                    {line || ' '}
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="version-content">
            <pre>{version.content}</pre>
          </div>
        )}
      </div>
      
      <div className="diff-footer">
        <div className="version-meta">
          <span>Edited by: {version.editor_name}</span>
          <span>Date: {new Date(version.timestamp).toLocaleString()}</span>
          {version.change_summary && (
            <span>Summary: {version.change_summary}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default VersionDiffViewer;
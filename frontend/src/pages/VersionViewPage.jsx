import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import Spinner from '../components/common/Spinner';
import VersionDiffViewer from '../components/editor/VersionDiffViewer';
import { documentsApi, versionsApi } from '../api/documents';
import './VersionHistoryPage.css';

const VersionViewPage = () => {
  const { docId, versionId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [document, setDocument] = useState(null);
  const [versions, setVersions] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [docResponse, versionsResponse] = await Promise.all([
          documentsApi.getById(docId),
          versionsApi.getHistory(docId),
        ]);
        setDocument(docResponse.data);
        setVersions(versionsResponse.data.versions);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [docId]);

  const getSavedVersionLabel = (targetVersionId) => {
    if (targetVersionId === 'current') return 'Current Version';
    const index = versions.findIndex((entry) => String(entry.version_id) === String(targetVersionId));
    if (index === -1) return 'Saved Version';
    return `Saved Version ${versions.length - index}`;
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

  const initialVersion = versionId === 'current' ? {
    version_id: 'current',
    content: document?.content || '',
    editor_name: document?.owner_name || 'Current user',
    timestamp: document?.updated_at,
    change_summary: 'Current document state',
  } : null;

  return (
    <DashboardLayout>
      <div className="history-page">
        <div className="history-header">
          <button className="back-btn" onClick={() => navigate(`/history/${docId}`)}>
            Back to History
          </button>
        </div>
        <VersionDiffViewer
          docId={docId}
          versionId={versionId}
          initialVersion={initialVersion}
          fullPage={true}
          versionLabel={getSavedVersionLabel(versionId)}
        />
      </div>
    </DashboardLayout>
  );
};

export default VersionViewPage;

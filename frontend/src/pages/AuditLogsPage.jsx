import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiActivity, FiClock, FiFileText, FiUser } from 'react-icons/fi';
import DashboardLayout from '../components/layout/DashboardLayout';
import Spinner from '../components/common/Spinner';
import { logsApi } from '../api/documents';
import { formatDateTime } from '../lib/utils';
import toast from 'react-hot-toast';
import './AuditLogsPage.css';

const OPERATION_LABELS = {
  INSERT: 'Document created',
  UPDATE: 'Document updated',
  MERGE: 'Changes merged',
  SAVE_VERSION: 'Version saved',
  DELETE: 'Document deleted',
  LEAVE_DOCUMENT: 'Left shared document',
  SHARE: 'Document shared',
  ACCESS_UPDATE: 'Access changed',
  ACCESS_REMOVE: 'Access removed',
  ACCESS_LOCK_VIEW: 'Access set to view-only',
  COMMENT_ADD: 'Comment added',
  COMMENT_DELETE: 'Comment deleted',
  LOCK_ADD: 'Text locked',
  LOCK_REMOVE: 'Text unlocked',
  DELETE_SAVED_VERSION: 'Saved version deleted'
};

const getOperationLabel = (operation) => (
  OPERATION_LABELS[operation] || operation.replaceAll('_', ' ').toLowerCase()
);

const getActorName = (log) => log.user_name || log.user_email || 'Unknown user';
const getDocumentName = (log) => log.document_title || `Document ${log.doc_id}`;

const getLogDescription = (log) => {
  const metadata = log.metadata || {};
  const actor = getActorName(log);
  const documentName = getDocumentName(log);

  switch (log.operation) {
    case 'INSERT':
      return `${actor} created "${documentName}".`;
    case 'UPDATE':
      return metadata.is_saved_version
        ? `${actor} saved "${documentName}" as a named version.`
        : `${actor} auto-saved changes in "${documentName}".`;
    case 'MERGE':
      return `${actor}'s changes were merged into "${documentName}".`;
    case 'SAVE_VERSION':
      return `${actor} saved a rollback point for "${documentName}".`;
    case 'DELETE':
      return metadata.scope === 'global'
        ? `${actor} deleted "${documentName}" for everyone.`
        : `${actor} removed "${documentName}".`;
    case 'LEAVE_DOCUMENT':
      return `${actor} removed "${documentName}" from their account.`;
    case 'SHARE':
      return `${actor} shared "${documentName}" with ${metadata.shared_with || 'another user'} as ${metadata.permission || 'edit'} access.`;
    case 'ACCESS_UPDATE':
      return `${actor} changed a collaborator on "${documentName}" to ${metadata.permission || 'a new'} access.`;
    case 'ACCESS_REMOVE':
      return `${actor} removed a collaborator from "${documentName}".`;
    case 'ACCESS_LOCK_VIEW':
      return `${actor} changed ${metadata.affected_collaborators || 0} collaborator(s) on "${documentName}" to view-only.`;
    case 'COMMENT_ADD':
      return `${actor} commented on "${metadata.selected_text || 'selected text'}" in "${documentName}".`;
    case 'COMMENT_DELETE':
      return `${actor} deleted a comment from "${documentName}".`;
    case 'LOCK_ADD':
      return `${actor} locked "${metadata.selected_text || 'selected text'}" in "${documentName}".`;
    case 'LOCK_REMOVE':
      return `${actor} unlocked text in "${documentName}".`;
    case 'DELETE_SAVED_VERSION':
      return `${actor} deleted a saved version of "${documentName}".`;
    default:
      return `${actor} performed an action on "${documentName}".`;
  }
};

const AuditLogsPage = () => {
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLogs = async () => {
      try {
        const response = await logsApi.getRecent(10);
        setLogs(response.data);
      } catch (error) {
        console.error('Failed to load logs:', error);
        toast.error('Failed to load audit logs');
      } finally {
        setLoading(false);
      }
    };

    loadLogs();
  }, []);

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
      <div className="logs-page">
        <div className="logs-header">
          <button className="back-btn" onClick={() => navigate(-1)}>
            <FiArrowLeft />
            <span>Back</span>
          </button>
          <div>
            <h1>Recent Audit Logs</h1>
            <p>Recent meaningful actions across your accessible documents.</p>
          </div>
        </div>

        <div className="logs-list">
          {logs.length === 0 ? (
            <div className="logs-empty">
              <FiActivity />
              <p>No audit logs found yet.</p>
            </div>
          ) : (
            logs.map((log) => (
              <article key={log.log_id} className="log-card">
                <div className="log-card-top">
                  <span className="log-operation">{getOperationLabel(log.operation)}</span>
                  <span className="log-time">
                    <FiClock />
                    {formatDateTime(log.timestamp)}
                  </span>
                </div>

                <div className="log-main">
                  <div className="log-detail">
                    <FiFileText />
                    <span>{getDocumentName(log)}</span>
                  </div>
                  <div className="log-detail">
                    <FiUser />
                    <span>{getActorName(log)}</span>
                  </div>
                </div>

                <p className="log-description">{getLogDescription(log)}</p>
              </article>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AuditLogsPage;

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiActivity, FiClock, FiFileText, FiUser } from 'react-icons/fi';
import DashboardLayout from '../components/layout/DashboardLayout';
import Spinner from '../components/common/Spinner';
import { logsApi } from '../api/documents';
import { formatDateTime } from '../lib/utils';
import toast from 'react-hot-toast';
import './AuditLogsPage.css';

const AuditLogsPage = () => {
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLogs = async () => {
      try {
        const response = await logsApi.getRecent(5);
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
            <p>Last 5 recorded actions across your accessible documents.</p>
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
                  <span className="log-operation">{log.operation}</span>
                  <span className="log-time">
                    <FiClock />
                    {formatDateTime(log.timestamp)}
                  </span>
                </div>

                <div className="log-main">
                  <div className="log-detail">
                    <FiFileText />
                    <span>{log.document_title || `Document ${log.doc_id}`}</span>
                  </div>
                  <div className="log-detail">
                    <FiUser />
                    <span>{log.user_name || 'Unknown user'}</span>
                  </div>
                </div>

                {log.metadata && (
                  <pre className="log-metadata">{JSON.stringify(log.metadata, null, 2)}</pre>
                )}
              </article>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AuditLogsPage;

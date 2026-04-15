import React from 'react';
import { FiAlertCircle } from 'react-icons/fi';
import './ErrorAlert.css';

const ErrorAlert = ({ message, onDismiss }) => {
  return (
    <div className="error-alert">
      <FiAlertCircle className="error-icon" />
      <span className="error-message">{message}</span>
      {onDismiss && (
        <button className="error-dismiss" onClick={onDismiss}>×</button>
      )}
    </div>
  );
};

export default ErrorAlert;
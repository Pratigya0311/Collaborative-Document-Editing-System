import React from 'react';
import Navbar from '../common/Navbar';
import './DashboardLayout.css';

const DashboardLayout = ({ children }) => {
  return (
    <div className="dashboard-layout">
      <Navbar />
      <main className="dashboard-main">
        <div className="dashboard-container">
          {children}
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
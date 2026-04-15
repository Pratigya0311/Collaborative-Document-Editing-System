import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { FiLogOut, FiFileText, FiUser } from 'react-icons/fi';
import './Navbar.css';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const handleLogout = () => {
    logout();
    navigate('/login');
  };
  
  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Link to="/dashboard" className="navbar-logo">
          <FiFileText className="logo-icon" />
          <span>CollabDocs</span>
        </Link>
      </div>
      
      <div className="navbar-menu">
        <Link to="/dashboard" className="nav-link">Dashboard</Link>
      </div>
      
      <div className="navbar-user">
        <div className="user-info">
          <FiUser className="user-icon" />
          <span className="user-name">{user?.name || 'User'}</span>
        </div>
        <button className="logout-btn" onClick={handleLogout}>
          <FiLogOut />
          <span>Logout</span>
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
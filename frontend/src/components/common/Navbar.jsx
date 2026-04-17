import React, { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { FiActivity, FiChevronDown, FiLogOut, FiFileText, FiGrid, FiUser } from 'react-icons/fi';
import './Navbar.css';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);
  
  const handleLogout = () => {
    const shouldLogout = window.confirm('Are you sure you want to logout?');
    if (!shouldLogout) return;

    logout();
    navigate('/login');
  };
  
  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <NavLink to="/dashboard" className="navbar-logo">
          <FiFileText className="logo-icon" />
          <span>CollabDocs</span>
        </NavLink>
      </div>
      
      <div className="navbar-menu">
        <NavLink to="/dashboard" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <FiGrid />
          <span>Dashboard</span>
        </NavLink>
        <NavLink to="/logs" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <FiActivity />
          <span>Logs</span>
        </NavLink>
      </div>
      
      <div className="navbar-user" ref={profileMenuRef}>
        <button
          className={`profile-btn ${showProfileMenu ? 'open' : ''}`}
          onClick={() => setShowProfileMenu((current) => !current)}
          type="button"
        >
          <span className="profile-avatar">
            <FiUser className="user-icon" />
          </span>
          <span className="user-name">{user?.name || 'User'}</span>
          <FiChevronDown className="profile-caret" />
        </button>

        {showProfileMenu && (
          <div className="profile-menu">
            <div className="profile-summary">
              <span className="profile-label">Signed in as</span>
              <strong>{user?.name || 'User'}</strong>
              {user?.email && <span className="profile-email">{user.email}</span>}
            </div>
            <button className="logout-btn" onClick={handleLogout} type="button">
              <FiLogOut />
              <span>Logout</span>
            </button>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;

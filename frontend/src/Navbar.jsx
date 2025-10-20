import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx'; 
import './Navbar.css'; 

function Navbar() {
  const { user, isLoading, logout } = useAuth();
  const navigate = useNavigate();
  // ... (handleLogout)

  const handleLogout = () => {
    logout();
    navigate('/'); 
  };

  return (
    <nav className="navbar">
      <div className="navbar-container"> 
        <div className="navbar-brand">
          <Link to="/">MindCare</Link> 
        </div>
        <ul className="navbar-links">
          <li><Link to="/podcast">Podcast</Link></li>
          <li><Link to="/ai-chat">คุย AI</Link></li>
          
          {/* NEW: Show admin link only for admins */}
          {user && user.role === 'admin' && (
            <>
              <li><Link to="/admin/users">จัดการผู้ใช้</Link></li>
              <li><Link to="/admin/consult">จัดการปรึกษา</Link></li>
            </>
          )}
          {user && user.role === 'doctor' && (
            <li><Link to="/doctor/dashboard">จัดการนัดหมาย (หมอ)</Link></li>
          )}

          <li><Link to="/consult">ปรึกษาหมอ</Link></li>
    
          {/* NEW: Handle loading state */}
          {isLoading ? (
            <li><span>Loading...</span></li>
          ) : user ? (
            <li>
              <button onClick={handleLogout} className="navbar-button logout-button">
                ออกจากระบบ ({user.username})
              </button>
            </li>
          ) : (
            <li><Link to="/login" className="navbar-button">เข้าสู่ระบบ</Link></li>
          )}
        </ul>
      </div>
    </nav>
  );
}

export default Navbar;


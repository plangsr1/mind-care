// src/App.jsx
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Navbar from './Navbar.jsx';
import './App.css';
import AIChat from './AIChat.jsx'; 
import LoginPage from './LoginPage.jsx';
import RegisterPage from './RegisterPage.jsx';
import ConsultPage from './ConsultPage.jsx';
// Import the new components
import AdminRoute from './AdminRoute.jsx';
import UserManagementPage from './UserManagementPage.jsx';
import AdminConsultPage from './AdminConsultPage.jsx';
import DoctorRoute from './DoctorRoute.jsx';
import DoctorDashboard from './DoctorDashboard.jsx';
// --- เพิ่ม 2 บรรทัดนี้ ---
import PodcastPage from './PodcastPage.jsx';       // 1. Import หน้าหลัก
import PodcastDetailPage from './PodcastDetailPage.jsx'; // 2. Import หน้าเล่น
import PaymentPage from './PaymentPage.jsx';

// ... (Home, Consult components)
function Home() { 
    return (
        <div className="main-content">
          <h1>ยินดีต้อนรับสู่ MindCare</h1>
          <p>เลือกบริการจากเมนูด้านบน</p>
        </div>
      );
}
// 🔴 ลบฟังก์ชัน Podcast() ตัวเก่านี้ทิ้งไป
/*
function Podcast() { 
    return <div className="main-content"><h1>หน้า Podcast</h1><p>เนื้อหาจะมาเร็วๆ นี้...</p></div>;
}
*/
function Consult() { 
    return <div className="main-content"><h1>หน้าปรึกษาหมอ</h1><p>เนื้อหาจะมาเร็วๆ นี้...</p></div>;
}


function App() {
  return (
    <div className="App">
      <Navbar />
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Home />} />
        <Route path="/ai-chat" element={<AIChat />} />
        
        {/* --- อัปเดต 2 บรรทัดนี้ --- */}
        <Route path="/podcast" element={<PodcastPage />} />         {/* 1. แก้ไข Route นี้ */}
        <Route path="/podcast/:id" element={<PodcastDetailPage />} /> {/* 2. เพิ่ม Route นี้ */}
        
        <Route path="/consult" element={<ConsultPage />} />
        <Route path="/payment/:appointmentId" element={<PaymentPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        
        {/* Admin-Only Route */}
        <Route 
          path="/admin/users" 
          element={
            <AdminRoute>
              <UserManagementPage />
            </AdminRoute>
          } 
        />
        <Route 
          path="/admin/consult" 
          element={
            <AdminRoute>
              <AdminConsultPage />
            </AdminRoute>
          } 
        />
        <Route 
          path="/doctor/dashboard" 
          element={
            <DoctorRoute>
              <DoctorDashboard />
            </DoctorRoute>
          } 
        />
      </Routes>
    </div>
  );
}

export default App;
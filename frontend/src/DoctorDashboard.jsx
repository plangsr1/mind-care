import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext.jsx';
import './AdminConsultPage.css'; // 💡 เราใช้ CSS ของหน้า Admin ไปเลย

function DoctorDashboard() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { token } = useAuth();

  useEffect(() => {
    const fetchDoctorAppointments = async () => {
      if (!token) return;
      try {
        setLoading(true);
        // 1. 💡 ดึงคิว "ของฉัน" (หมอ)
        const res = await axios.get('http://localhost:3001/api/appointments/my-doctor', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setAppointments(res.data.data);
      } catch (err) {
        setError(err.response?.data?.error || 'ไม่สามารถดึงข้อมูลการนัดหมายได้');
      } finally {
        setLoading(false);
      }
    };
    fetchDoctorAppointments();
  }, [token]);

  // 2. 💡 ฟังก์ชันอัปเดตสถานะ (เวอร์ชันหมอ)
  const handleStatusChange = (appointmentId, newStatus) => {
    axios.put(
      `http://localhost:3001/api/appointments/${appointmentId}/status-doctor`, // 💡 เรียก API ของหมอ
      { status: newStatus },
      { headers: { Authorization: `Bearer ${token}` } }
    )
    .then(response => {
      // อัปเดตหน้าจอ
      setAppointments(prevAppointments => {
        if (!Array.isArray(prevAppointments)) return [];
        return prevAppointments.map(appt =>
          appt.id === appointmentId
            ? { ...appt, status: newStatus }
            : appt
        );
      });
    })
    .catch(err => {
      console.error("Error updating status:", err);
      setError(err.response?.data?.error || "ไม่สามารถอัปเดตสถานะได้");
    });
  };

  if (loading) return <div>กำลังโหลดข้อมูล...</div>;

  return (
    <div className="admin-page-container">
      <h2>จัดการนัดหมาย (สำหรับผู้เชี่ยวชาญ)</h2>
      {error && <p className="error-message">{error}</p>}

      <section className="admin-section">
        <h3>การนัดหมายของคุณ</h3>
        
        {appointments.length === 0 ? (
          <p>ยังไม่มีการนัดหมาย</p>
        ) : (
          <table className="admin-table appointments-table">
            <thead>
              <tr>
                <th>ผู้ใช้งาน (คนไข้)</th>
                <th>เวลาที่ขอ</th>
                <th>อาการเบื้องต้น</th>
                <th>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map(appt => (
                <tr key={appt.id}>
                  <td>{appt.userName}</td>
                  <td>{new Date(appt.requestedTime).toLocaleString()}</td>
                  <td>{appt.reason || '-'}</td>
                  <td>
                    <select
                      value={appt.status}
                      className={`status-select status-${appt.status}`}
                      onChange={(e) => handleStatusChange(appt.id, e.target.value)}
                    >
                      <option value="pending">รอการยืนยัน</option>
                      <option value="confirmed">ยืนยันแล้ว</option>
                      <option value="cancelled">ยกเลิก</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

export default DoctorDashboard;
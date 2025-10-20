// src/ConsultPage.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext.jsx';
import './ConsultPage.css'; // เราจะสร้างไฟล์ CSS นี้
import { useNavigate } from 'react-router-dom';

function ConsultPage() {
  const [specialists, setSpecialists] = useState([]);
  const [myAppointments, setMyAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { user, token } = useAuth(); // ดึง user และ token
  const navigate = useNavigate();

  // State สำหรับ Modal (หน้าต่างจองคิว)
  const [showModal, setShowModal] = useState(false);
  const [selectedSpecialist, setSelectedSpecialist] = useState(null);
  
  // State สำหรับ Form
  const [reason, setReason] = useState('');
  const [requestTime, setRequestTime] = useState('');
  const [formError, setFormError] = useState('');

  // ดึงข้อมูลหมอ และ คิวของฉัน
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // 1. ดึงรายชื่อหมอ
        const specRes = await axios.get('http://localhost:3001/api/specialists');
        setSpecialists(specRes.data.data);

        // 2. ถ้า Login แล้ว, ดึงคิวของฉัน
        if (token) {
          const apptRes = await axios.get('http://localhost:3001/api/my-appointments', {
            headers: { Authorization: `Bearer ${token}` }
          });
          setMyAppointments(apptRes.data.data);
        }
      } catch (err) {
        setError('ไม่สามารถดึงข้อมูลได้');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token]); // ดึงใหม่เมื่อ token เปลี่ยน (เช่น เพิ่ง Login)

  // --- ฟังก์ชันจัดการ Modal ---
  const handleOpenModal = (specialist) => {
    setSelectedSpecialist(specialist);
    setRequestTime(''); // ล้างค่าเก่า
    setReason('');
    setFormError('');
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedSpecialist(null);
  };

  // --- ฟังก์ชันส่งฟอร์มจองคิว ---
const handleSubmitBooking = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!requestTime || !selectedSpecialist) {
      setFormError('กรุณาเลือกวันและเวลา');
      return;
    }

    try {
      // 1. 💡 ส่งคำขอ (API นี้จะคืนค่าข้อมูลนัดหมายใหม่กลับมา)
      const res = await axios.post(
        'http://localhost:3001/api/appointments',
        {
          specialistId: selectedSpecialist.id,
          reason: reason,
          requestedTime: requestTime,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // 2. 💡 (นี่คือส่วนที่แก้)
      // เพิ่มคิวใหม่ (res.data.data) เข้าไปใน State 'myAppointments' ทันที
      if (res.data && res.data.data) {
        setMyAppointments(prevAppointments => [res.data.data, ...prevAppointments]);
      }

      // 3. ปิด Modal
      handleCloseModal();

    } catch (err) {
      setFormError(err.response?.data?.error || 'การจองล้มเหลว โปรดลองอีกครั้ง');
    }
  };


  return (
    <div className="consult-container">
      <h2>บริการปรึกษาผู้เชี่ยวชาญ (จำลอง)</h2>

      {/* --- 1. กล่องคำเตือน (สำคัญที่สุด) --- */}
      <div className="disclaimer-box">
        <h3>ข้อควรทราบและคำเตือนฉุกเฉิน</h3>
        <p>
          นี่คือ **ระบบจำลองเพื่อการศึกษาเท่านั้น** ไม่ใช่บริการทางการแพทย์จริง
          การนัดหมายในหน้านี้จะไม่ได้รับการตอบรับจากผู้เชี่ยวชาญจริง
        </p>
        <p className="emergency">
          หากคุณอยู่ในภาวะฉุกเฉินทางอารมณ์หรือต้องการความช่วยเหลือเร่งด่วน<br />
          กรุณาติดต่อ **สายด่วนสุขภาพจิต 1323** ตลอด 24 ชั่วโมง
        </p>
      </div>

      {loading && <p>กำลังโหลด...</p>}
      {error && <p className="error-message">{error}</p>}

      {/* --- 2. ส่วนแสดงคิวของฉัน (ถ้า Login) --- */}
      {user && (
        <section className="my-appointments">
          <h2>การนัดหมายของฉัน</h2>
          {/* ... (โค้ดแสดง myAppointments) ... */}
            {myAppointments.map(appt => (
              <li key={appt.id}>
                {/* ... (ข้อมูลนัดหมาย) ... */}
                <div className="appt-status">
  <strong>สถานะ:</strong> 
  
  {/* 1. นี่คือส่วนที่ขาดไป (สำหรับคิวใหม่) */}
  {appt.status === 'pending' && (
    <span className="status-pending">รอการยืนยัน</span>
  )}

  {/* 2. นี่คือส่วนที่คุณมีอยู่แล้ว */}
  {appt.status === 'confirmed' && appt.paymentStatus === 'unpaid' && (
    <>
      <span className="status-confirmed">ยืนยันแล้ว (รอชำระเงิน)</span>
      <button 
        className="pay-btn" 
        onClick={() => navigate(`/payment/${appt.id}`)}
      >
        ชำระเงิน
      </button>
    </>
  )}

  {/* 3. นี่คือส่วนที่ขาดไป (ถ้าจ่ายเงินแล้ว) */}
  {appt.status === 'confirmed' && appt.paymentStatus === 'paid' && (
    <span className="status-paid">ชำระเงินเรียบร้อย</span>
  )}

  {/* 4. นี่คือส่วนที่ขาดไป (ถ้ายกเลิก) */}
  {appt.status === 'cancelled' && (
    <span className="status-cancelled">ยกเลิก</span>
  )}
</div>
              </li>
            ))}
        </section>
      )}

      {/* --- 3. ส่วนแสดงรายชื่อหมอ --- */}
      <div className="specialists-list">
        <h3>เลือกผู้เชี่ยวชาญที่คุณต้องการปรึกษา</h3>
        <div className="specialist-grid">
          {specialists.map((spec) => (
            <div key={spec.id} className="specialist-card">
              <img src={spec.photoUrl} alt={spec.name} className="specialist-photo" />
              <h4>{spec.name}</h4>
              <p className="spec-title">{spec.title}</p>
              <p className="spec-specialty">เชี่ยวชาญ: {spec.specialty}</p>
              <p className="spec-desc">{spec.description}</p>
              {user ? (
                <button onClick={() => handleOpenModal(spec)} className="book-btn">
                  จองคิวนัดหมาย
                </button>
              ) : (
                <p className="login-prompt">
                  กรุณา <a href="/login">เข้าสู่ระบบ</a> เพื่อจองคิว
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* --- 4. Modal (หน้าต่าง Pop-up) สำหรับจองคิว --- */}
      {showModal && selectedSpecialist && (
        <div className="modal-backdrop" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleSubmitBooking}>
              <h3>นัดหมายคุณ {selectedSpecialist.name}</h3>
              <div className="input-group">
                <label>อาการเบื้องต้น (ไม่บังคับ)</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="เช่น รู้สึกกังวล, นอนไม่หลับ..."
                />
              </div>
              <div className="input-group">
                <label>เลือกวันและเวลาที่สะดวก</label>
                <input
                  type="datetime-local"
                  value={requestTime}
                  onChange={(e) => setRequestTime(e.target.value)}
                  required
                />
              </div>
              {formError && <p className="error-message">{formError}</p>}
              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={handleCloseModal}>
                  ยกเลิก
                </button>
                <button type="submit" className="submit-btn">
                  ส่งคำขอ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default ConsultPage;
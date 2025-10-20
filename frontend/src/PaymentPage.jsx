// src/PaymentPage.jsx
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from './AuthContext.jsx';
import './PaymentPage.css'; // (สร้างไฟล์ CSS นี้)

// 💡 ตั้งค่า Public Key ให้ Omise.js
window.Omise.setPublicKey(import.meta.env.VITE_OMISE_PUBLIC_KEY);

function PaymentPage() {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();

  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expMonth, setExpMonth] = useState('');
  const [expYear, setExpYear] = useState('');
  const [cvv, setCvv] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isLoading) return;

    setIsLoading(true);
    setMessage(null);

    // 1. 💡 สร้าง Token จากข้อมูลบัตร
    window.Omise.createToken('card', {
      'name': cardName,
      'number': cardNumber.replace(/\s/g, ''), // ลบช่องว่าง
      'expiration_month': expMonth,
      'expiration_year': expYear,
      'security_code': cvv
    }, (statusCode, response) => {
        if (statusCode === 200) {
          // 2. 💡 ได้ Token (response.id) -> ส่งไป Backend
          const omiseToken = response.id;
          payWithToken(omiseToken);
        } else {
          // 3. 💡 ถ้าสร้าง Token ไม่สำเร็จ (เช่น กรอกบัตรผิด)
          setMessage(response.message || 'ข้อมูลบัตรเครดิตไม่ถูกต้อง');
          setIsLoading(false);
        }
    });
  };

  // ฟังก์ชันสำหรับยิง API ไป Backend
  const payWithToken = async (omiseToken) => {
    try {
      const res = await axios.post(
        `http://localhost:3001/api/appointments/${appointmentId}/pay-with-omise`,
        { omiseToken },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // 4. 💡 จัดการผลลัพธ์จาก Backend
      if (res.data.status === 'successful') {
        // จ่ายสำเร็จ (ไม่มี 3D Secure)
        setMessage('ชำระเงินสำเร็จ!');
        setTimeout(() => navigate('/consult'), 2000);

      } else if (res.data.status === 'pending' && res.data.authorize_uri) {
        // ต้องทำ 3D Secure -> พาไปหน้าธนาคาร
        window.location.href = res.data.authorize_uri;

      } else {
        setMessage(res.data.error || 'การชำระเงินล้มเหลว');
        setIsLoading(false);
      }
    } catch (err) {
      setMessage(err.response?.data?.error || 'เกิดข้อผิดพลาดในการเชื่อมต่อ');
      setIsLoading(false);
    }
  };

  return (
    <div className="payment-container">
      <form id="payment-form" onSubmit={handleSubmit}>
        <h2>ชำระเงิน (ID: {appointmentId})</h2>

        <div className="input-group">
          <label>ชื่อบนบัตร</label>
          <input type="text" value={cardName} onChange={(e) => setCardName(e.target.value)} required />
        </div>
        <div className="input-group">
          <label>หมายเลขบัตร</label>
          <input type="text" value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} required />
        </div>
        <div className="input-row">
          <div className="input-group">
            <label>เดือนหมดอายุ (MM)</label>
            <input type="number" value={expMonth} onChange={(e) => setExpMonth(e.target.value)} required />
          </div>
          <div className="input-group">
            <label>ปีหมดอายุ (YYYY)</label>
            <input type="number" value={expYear} onChange={(e) => setExpYear(e.target.value)} required />
          </div>
          <div className="input-group">
            <label>CVV</label>
            <input type="number" value={cvv} onChange={(e) => setCvv(e.target.value)} required />
          </div>
        </div>

        <button disabled={isLoading} id="submit" className="submit-btn">
          {isLoading ? "กำลังประมวลผล..." : "ชำระเงิน"}
        </button>

        {message && <div id="payment-message" style={{color: message.includes('สำเร็จ') ? 'green' : 'red'}}>{message}</div>}
      </form>
    </div>
  );
}

export default PaymentPage;
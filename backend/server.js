// d:\mind-care\backend\server.js

// --- Core Setup ---
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { CohereClientV2 } = require('cohere-ai');
const omise = require('omise')({ // 💡 ต้องมี
    'secretKey': process.env.OMISE_SECRET_KEY
});

// --- New Imports for Auth & DB ---
const db = require('./database.js'); // Import the database connection
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer'); 
const path = require('path');     
const fs = require('fs');

// --- Express App Setup ---
const app = express();
const PORT = process.env.PORT || 3001; 
app.use(cors()); 

// --- 💡 (สำคัญ) Webhook ต้องอยู่ก่อน express.json() ---
// API นี้ Omise จะเรียกมา
app.post('/api/omise-webhook', express.json(), (req, res) => {
    const event = req.body;
    try {
        if (event.object === 'event' && event.key === 'charge.complete') {
            const charge = event.data;
            if (charge.status === 'successful') {
                const appointmentId = charge.metadata.appointmentId;
                const chargeId = charge.id;
                
                console.log(`Webhook: Payment Succeeded for Appointment ID: ${appointmentId}`);
                // อัปเดต Database ของเราว่า "จ่ายแล้ว"
                const sql = `UPDATE appointments SET paymentStatus = 'paid' WHERE id = ? AND omiseChargeId = ?`;
                db.run(sql, [appointmentId, chargeId], (err) => {
                    if(err) console.error("Webhook: Failed to update DB:", err);
                    else console.log(`Webhook: Appointment ${appointmentId} marked as PAID.`);
                });
            }
        }
    } catch (err) {
        console.error("Webhook processing error:", err);
    }
    res.status(200).send("OK");
});
// --- สิ้นสุด Webhook ---

app.use(express.json()); // 💡 express.json() ต้องอยู่หลัง Webhook
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let dest;
    if (file.fieldname === 'mediaFile') {
      dest = path.join(__dirname, 'public/uploads/media');
    } else if (file.fieldname === 'thumbnailFile') {
      dest = path.join(__dirname, 'public/uploads/thumbnails');
    }
    fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

// --- Cohere AI Setup ---
const cohere = new CohereClientV2({
  token: process.env.COHERE_API_KEY,
});

const systemPreamble = `
  คุณคือ "MindCare AI" ผู้ช่วย AI ที่มีความเห็นอกเห็นใจและให้การสนับสนุน... (เหมือนเดิม)
`;

// --- Middleware ---

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) return res.status(401).json({ error: 'Missing token' });

  jwt.verify(token, process.env.JWT_SECRET || 'your_default_secret_key', (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user; 
    next();
  });
}

function isAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admins only.' });
  }
  next();
}

const isDoctor = (req, res, next) => {
    if (req.user && req.user.role === 'doctor') {
        next();
    } else {
        res.status(403).json({ error: "Access forbidden: Doctor role required." });
    }
};

// --- API ROUTES ---

// 1. AI Chat Route
app.post('/api/chat', async (req, res) => {
  try {
    const userMessageText = req.body.message;
    if (!userMessageText) {
      return res.status(400).json({ error: 'Message is required' });
    }
    const response = await cohere.chat({
      model: "command-a-03-2025",
      messages: [
        { role: "system", content: systemPreamble }, 
        { role: "user", content: userMessageText } 
      ],
    });
    const aiReply = response.message.content[0].text;
    res.json({ reply: aiReply });
  } catch (error) {
    console.error('Error processing chat:', error);
    res.status(500).json({ error: 'Failed to get response from AI' });
  }
});

// 2. Auth Routes
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required." });
    }
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const sql = 'INSERT INTO users (username, password) VALUES (?, ?)';
        db.run(sql, [username, hashedPassword], function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(409).json({ error: "Username already exists." });
                }
                return res.status(500).json({ error: "Database error during registration." });
            }
            res.status(201).json({ message: "User created successfully.", userId: this.lastID });
        });
    } catch (error) {
        res.status(500).json({ error: "Server error during registration." });
    }
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required." });
    }
    const sql = 'SELECT * FROM users WHERE username = ?';
    db.get(sql, [username], async (err, user) => {
        if (err) return res.status(500).json({ error: "Database error during login." });
        if (!user) return res.status(401).json({ error: "Invalid credentials." });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ error: "Invalid credentials." });
        
        const tokenPayload = { id: user.id, username: user.username, role: user.role };
        const token = jwt.sign(
            tokenPayload,
            process.env.JWT_SECRET || 'your_default_secret_key',
            { expiresIn: '1h' } 
        );
        res.json({ message: "Login successful.", token: token });
    });
});

// 3. User Management Routes (Admin)
app.get('/api/users', authenticateToken, isAdmin, (req, res) => {
    const sql = "SELECT id, username, role FROM users";
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ "error": err.message });
        res.json({ "message": "success", "data": rows });
    });
});

// 💡 (แก้ไข) นี่คือเวอร์ชันที่ถูกต้อง (ไม่มี Logic สร้าง specialist อัตโนมัติ)
app.put('/api/users/:id/role', authenticateToken, isAdmin, (req, res) => {
    const { role } = req.body;
    const userId = req.params.id;

    if (!['user', 'admin', 'doctor'].includes(role)) {
        return res.status(400).json({ error: "Invalid role" });
    }
    const updateRoleSql = `UPDATE users SET role = ? WHERE id = ?`;
    
    db.run(updateRoleSql, [role, userId], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: "User not found" });
        
        res.json({ message: "User role updated." });
    });
});

app.delete('/api/users/:id', authenticateToken, isAdmin, (req, res) => {
  const userId = req.params.id;
  const sql = 'DELETE FROM users WHERE id = ?';
  db.run(sql, [userId], function(err) {
    if (err) return res.status(500).json({ error: 'Failed to delete user.' });
    if (this.changes === 0) return res.status(404).json({ error: 'User not found.' });
    res.json({ message: 'User deleted successfully.' });
  });
});

// 4. Podcast Routes (Admin + Public)
app.get('/api/podcasts', (req, res) => {
    const sql = "SELECT * FROM podcasts ORDER BY id DESC"; 
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ "error": err.message });
        res.json({ "data": rows });
    });
});

app.get('/api/podcasts/:id', (req, res) => {
    const sql = "SELECT * FROM podcasts WHERE id = ?";
    db.get(sql, [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ "error": err.message });
        if (!row) return res.status(404).json({ "error": "Podcast not found." });
        res.json({ "data": row });
    });
});

app.post('/api/podcasts', authenticateToken, isAdmin, 
  upload.fields([ 
    { name: 'mediaFile', maxCount: 1 },
    { name: 'thumbnailFile', maxCount: 1 }
  ]), 
  async (req, res) => {
    const { title, description, type, youtubeUrl, thumbnailUrl: thumbUrlText } = req.body;
    let finalUrl = '', finalThumbnailUrl = '';
    
    if (type === 'youtube') {
      finalUrl = youtubeUrl;
      finalThumbnailUrl = thumbUrlText; 
    } else if (type === 'upload') {
      if (req.files.mediaFile) finalUrl = `http://localhost:3001/uploads/media/${req.files.mediaFile[0].filename}`;
      if (req.files.thumbnailFile) finalThumbnailUrl = `http://localhost:3001/uploads/thumbnails/${req.files.thumbnailFile[0].filename}`;
    } else {
      return res.status(400).json({ error: "Invalid podcast type." });
    }

    const sql = `INSERT INTO podcasts (title, description, type, url, thumbnailUrl) VALUES (?, ?, ?, ?, ?)`;
    const params = [title, description, type, finalUrl, finalThumbnailUrl];

    db.run(sql, params, function(err) {
      if (err) return res.status(500).json({ "error": err.message });
      res.status(201).json({ "data": { id: this.lastID, ...req.body, url: finalUrl, thumbnailUrl: finalThumbnailUrl } });
    });
  }
);

app.delete('/api/podcasts/:id', authenticateToken, isAdmin, (req, res) => {
    const id = req.params.id;
    db.get("SELECT type, url, thumbnailUrl FROM podcasts WHERE id = ?", [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: "Podcast not found." });

        if (row.type === 'upload') {
            try {
                if (row.url) {
                    const mediaPath = path.join(__dirname, 'public', new URL(row.url).pathname);
                    if (fs.existsSync(mediaPath)) fs.unlinkSync(mediaPath);
                }
                if (row.thumbnailUrl) {
                    const thumbPath = path.join(__dirname, 'public', new URL(row.thumbnailUrl).pathname);
                    if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
                }
            } catch (e) { console.error("Error deleting files:", e); }
        }
        db.run("DELETE FROM podcasts WHERE id = ?", [id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ error: "Podcast not found." });
            res.json({ message: "Podcast deleted successfully." });
        });
    });
});

// 5. Specialist Routes (Admin + Public)

// 💡 (แก้ไข) อัปเกรดให้ JOIN User เพื่อใช้ใน Admin Panel
app.get('/api/specialists', (req, res) => {
    const sql = `
        SELECT s.*, u.username AS linkedUsername 
        FROM specialists s
        LEFT JOIN users u ON s.userId = u.id
        ORDER BY s.name
    `;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
});

app.get('/api/users/doctors-available', authenticateToken, isAdmin, (req, res) => {
    const sql = `
        SELECT u.id, u.username 
        FROM users u
        LEFT JOIN specialists s ON u.id = s.userId
        WHERE u.role = 'doctor' AND s.id IS NULL
    `;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
});

app.post('/api/specialists', authenticateToken, isAdmin, (req, res) => {
    const { name, title, specialty, description, photoUrl, userId } = req.body;
    if (!name || !title) {
        return res.status(400).json({ error: "Name and title are required." });
    }
    const finalUserId = (userId === '' || userId === undefined) ? null : userId;
    const sql = `INSERT INTO specialists (name, title, specialty, description, photoUrl, userId) 
                 VALUES (?, ?, ?, ?, ?, ?)`;
    db.run(sql, [name, title, specialty, description, photoUrl, finalUserId], function (err) {
        if (err) {
            if (err.message.includes("UNIQUE constraint failed")) {
                 return res.status(409).json({ error: "User นี้ถูกเชื่อมโยงกับโปรไฟล์อื่นแล้ว" });
            }
            return res.status(500).json({ error: err.message });
        }
        const newSpecId = this.lastID;
        db.get(`SELECT s.*, u.username AS linkedUsername 
                FROM specialists s 
                LEFT JOIN users u ON s.userId = u.id 
                WHERE s.id = ?`, [newSpecId], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ message: "Specialist created.", data: row });
        });
    });
});

app.put('/api/specialists/:id', authenticateToken, isAdmin, (req, res) => {
    const { id } = req.params;
    const { name, title, specialty, description, photoUrl, userId } = req.body;
    if (!name || !title) {
        return res.status(400).json({ error: "Name and title are required." });
    }
    const finalUserId = (userId === '' || userId === undefined) ? null : userId;
    const sql = `UPDATE specialists SET 
                    name = ?, title = ?, specialty = ?, 
                    description = ?, photoUrl = ?, userId = ?
                 WHERE id = ?`;
    db.run(sql, [name, title, specialty, description, photoUrl, finalUserId, id], function (err) {
        if (err) {
            if (err.message.includes("UNIQUE constraint failed")) {
                return res.status(409).json({ error: "User นี้ถูกเชื่อมโยงกับโปรไฟล์อื่นแล้ว" });
            }
            return res.status(500).json({ error: err.message });
        }
        if (this.changes === 0) return res.status(404).json({ error: "Specialist not found" });
        
        db.get(`SELECT s.*, u.username AS linkedUsername 
                FROM specialists s 
                LEFT JOIN users u ON s.userId = u.id 
                WHERE s.id = ?`, [id], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: "Specialist updated.", data: row });
        });
    });
});

app.delete('/api/specialists/:id', authenticateToken, isAdmin, (req, res) => {
    const { id } = req.params;
    const sql = `DELETE FROM specialists WHERE id = ?`;
    db.run(sql, [id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: "Specialist not found" });
        res.json({ message: "Specialist profile deleted." });
    });
});

// 6. Appointment Routes (User, Admin, Doctor)

// 💡 (แก้ไข) นี่คือเวอร์ชันที่ถูกต้อง (จัดลำดับ Callback ใหม่)
app.post('/api/appointments', authenticateToken, (req, res) => {
    const { specialistId, reason, requestedTime } = req.body;
    const userId = req.user.id; 

    if (!specialistId || !requestedTime) {
        return res.status(400).json({ error: "Specialist and time are required." });
    }

    // 1. ค้นหาราคาของหมอก่อน
    db.get(`SELECT price FROM specialists WHERE id = ?`, [specialistId], (err, specialist) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!specialist) return res.status(404).json({ error: "Specialist not found." });

        const amount = specialist.price; // ได้ราคามาแล้ว

        // 2. บันทึกนัดหมาย (พร้อมราคา)
        const sql = `INSERT INTO appointments (userId, specialistId, reason, requestedTime, amount) 
                     VALUES (?, ?, ?, ?, ?)`;

        // 3. ทั้งหมดต้องอยู่ใน callback ของ db.run
        db.run(sql, [userId, specialistId, reason, requestedTime, amount], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            
            const newAppointmentId = this.lastID; // ID ของคิวที่เพิ่งจอง

            // 4. ดึงข้อมูลนัดหมายใหม่ (พร้อมชื่อหมอ) เพื่อส่งกลับไป
            const newApptSql = `
                SELECT a.*, s.name AS specialistName 
                FROM appointments a
                JOIN specialists s ON a.specialistId = s.id
                WHERE a.id = ?
            `;
            
            db.get(newApptSql, [newAppointmentId], (err, newApptRow) => {
                if (err) {
                    return res.status(500).json({ error: "Booking created, but failed to fetch new row." });
                }
                
                // 5. (ส่วนของการแจ้งเตือนหมอ)
                try {
                    db.get(`SELECT userId FROM specialists WHERE id = ?`, [specialistId], (err, spec) => {
                        if (spec && spec.userId) {
                            db.run(`INSERT INTO notifications (userId, message, linkTo) VALUES (?, ?, ?)`,
                                [spec.userId, `คุณมีคำขอนัดหมายใหม่ (ID: ${newAppointmentId})`, `/doctor/dashboard`]
                            );
                        }
                    });
                } catch (notifyError) {
                    console.error("Failed to create notification:", notifyError);
                }
                
                // 6. ส่งข้อมูลคิวใหม่กลับไปให้ React
                res.status(201).json({ message: "Booking request submitted.", data: newApptRow });
            });
        }); // สิ้นสุด callback ของ db.run
    }); // สิ้นสุด callback ของ db.get
});

// 💡 (แก้ไข) นี่คือเวอร์ชันที่ถูกต้อง (SELECT a.*)
app.get('/api/my-appointments', authenticateToken, (req, res) => {
    const userId = req.user.id;
    
    // 💡 ต้อง SELECT a.* เพื่อให้ได้ a.paymentStatus มาด้วย
    const sql = `
        SELECT 
            a.*, 
            s.name AS specialistName, 
            s.title AS specialistTitle
        FROM appointments a
        JOIN specialists s ON a.specialistId = s.id
        WHERE a.userId = ?
        ORDER BY a.createdAt DESC
    `;
    db.all(sql, [userId], (err, rows) => {
        if (err) {
            console.error("Error fetching my-appointments:", err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json({ data: rows });
    });
});

app.get('/api/appointments/all', authenticateToken, isAdmin, (req, res) => {
    const sql = `
        SELECT 
            a.id, a.reason, a.requestedTime, a.status, a.createdAt,
            u.username AS userName,
            s.name AS specialistName
        FROM appointments a
        JOIN users u ON a.userId = u.id
        JOIN specialists s ON a.specialistId = s.id
        ORDER BY a.createdAt DESC
    `;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
});

app.put('/api/appointments/:id/status', authenticateToken, isAdmin, (req, res) => {
    const { status } = req.body;
    const appointmentId = req.params.id;

    if (!['pending', 'confirmed', 'cancelled'].includes(status)) {
        return res.status(400).json({ error: "Invalid status value." });
    }
    const updateSql = `UPDATE appointments SET status = ? WHERE id = ?`;

    db.run(updateSql, [status, appointmentId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: "Appointment not found" });

        if (status === 'confirmed') {
            try {
                db.get(`SELECT specialistId FROM appointments WHERE id = ?`, [appointmentId], (err, appt) => {
                    if (err || !appt) return; 
                    db.get(`SELECT userId FROM specialists WHERE id = ?`, [appt.specialistId], (err, spec) => {
                        if (err || !spec || !spec.userId) return; 
                        const doctorUserId = spec.userId;
                        const message = `คุณมีนัดหมาย (ID: ${appointmentId}) ที่ได้รับการยืนยันจากแอดมินแล้ว`;
                        db.run(`INSERT INTO notifications (userId, message, linkTo) VALUES (?, ?, ?)`,
                            [doctorUserId, message, `/doctor/dashboard`]
                        );
                    });
                });
            } catch (notifyError) { console.error("Error queueing notification:", notifyError); }
        }
        res.json({ message: "Appointment status updated." });
    });
});

app.get('/api/appointments/my-doctor', authenticateToken, isDoctor, (req, res) => {
    const doctorUserId = req.user.id;
    db.get(`SELECT id FROM specialists WHERE userId = ?`, [doctorUserId], (err, specialist) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!specialist) {
            return res.status(404).json({ error: "ไม่พบโปรไฟล์ผู้เชี่ยวชาญที่เชื่อมกับบัญชีนี้" });
        }
        const specialistId = specialist.id;
        const sql = `
            SELECT a.*, u.username AS userName
            FROM appointments a
            JOIN users u ON a.userId = u.id
            WHERE a.specialistId = ?
            ORDER BY a.createdAt DESC
        `;
        db.all(sql, [specialistId], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ data: rows });
        });
    });
});

app.put('/api/appointments/:id/status-doctor', authenticateToken, isDoctor, (req, res) => {
    const doctorUserId = req.user.id;
    const appointmentId = req.params.id;
    const { status } = req.body;

    if (!['pending', 'confirmed', 'cancelled'].includes(status)) {
        return res.status(400).json({ error: "Invalid status value." });
    }
    db.get(`SELECT id FROM specialists WHERE userId = ?`, [doctorUserId], (err, specialist) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!specialist) return res.status(403).json({ error: "Forbidden: No specialist profile." });
        
        const specialistId = specialist.id;
        db.get(`SELECT specialistId FROM appointments WHERE id = ?`, [appointmentId], (err, appt) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!appt) return res.status(404).json({ error: "Appointment not found." });
            if (appt.specialistId !== specialistId) {
                return res.status(403).json({ error: "Forbidden: You cannot update this appointment." });
            }
            const updateSql = `UPDATE appointments SET status = ? WHERE id = ?`;
            db.run(updateSql, [status, appointmentId], function(err) {
                if (err) return res.status(500).json({ error: err.message });
                if (this.changes === 0) return res.status(404).json({ error: "Appointment update failed." });
                res.json({ message: "Appointment status updated by doctor." });
            });
        });
    });
});

// 7. Notification Routes (Doctor/User)
// 💡 (เพิ่ม) API ที่หายไป
app.get('/api/notifications/my', authenticateToken, (req, res) => {
    const userId = req.user.id; 
    const sql = `
        SELECT * FROM notifications 
        WHERE userId = ? AND isRead = 0 
        ORDER BY createdAt DESC
    `;
    db.all(sql, [userId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
});

app.post('/api/notifications/:id/read', authenticateToken, (req, res) => {
    const notifyId = req.params.id;
    const userId = req.user.id;
    const sql = `UPDATE notifications SET isRead = 1 WHERE id = ? AND userId = ?`;
    db.run(sql, [notifyId, userId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Notification marked as read." });
    });
});

// 8. Payment Routes (Omise)
// 💡 (เพิ่ม) API ที่หายไป
app.post('/api/appointments/:id/pay-with-omise', authenticateToken, async (req, res) => {
    const { id: appointmentId } = req.params;
    const { omiseToken } = req.body; 
    const userId = req.user.id;

    if (!omiseToken) {
        return res.status(400).json({ error: "Omise token is required." });
    }

    try {
        const sql = `SELECT * FROM appointments WHERE id = ? AND userId = ?`;
        db.get(sql, [appointmentId, userId], async (err, appt) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!appt) return res.status(404).json({ error: "Appointment not found or not yours." });
            if (appt.status !== 'confirmed') return res.status(400).json({ error: "นัดหมายนี้ยังไม่ได้รับการยืนยัน" });
            if (appt.paymentStatus === 'paid') return res.status(400).json({ error: "นัดหมายนี้ชำระเงินแล้ว" });

            const amountInSatang = appt.amount * 100; // Omise ใช้หน่วยสตางค์

            const charge = await omise.charges.create({
                amount: amountInSatang,
                currency: 'thb',
                card: omiseToken, 
                metadata: { 
                    appointmentId: appt.id,
                    userId: appt.userId
                },
                return_uri: `http://localhost:5173/consult` // 💡 เปลี่ยนเป็น URL หน้าเว็บของคุณ
            });

            db.run(`UPDATE appointments SET omiseChargeId = ? WHERE id = ?`, [charge.id, appt.id]);

            if (charge.status === 'successful') {
                db.run(`UPDATE appointments SET paymentStatus = 'paid' WHERE id = ?`, [appt.id]);
                res.json({ status: 'successful', message: 'ชำระเงินสำเร็จ' });
            
            } else if (charge.authorize_uri) {
                // ต้องทำ 3D Secure
                res.json({ status: 'pending', authorize_uri: charge.authorize_uri });
            
            } else {
                res.status(400).json({ error: charge.failure_message || 'การชำระเงินล้มเหลว' });
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});


// --- Start Server ---
app.listen(PORT, () => {
  console.log(`Backend server is running 🚀 on http://localhost:${PORT}`);
});
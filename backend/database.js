// database.js
const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("./mindcare.db", (err) => {
  if (err) {
    console.error("Error opening database", err.message);
  } else {
    console.log("Connected to the SQLite database.");
    createTables();
  }
});

function createTables() {
  // Table for users (เหมือนเดิม)
  const createUserTableSql = `
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'user' 
    );`;

  // --- อัปเดตตาราง Podcasts ---
  const dropPodcastTableSql = `DROP TABLE IF EXISTS podcasts;`;

  const createPodcastTableSql = `
    CREATE TABLE IF NOT EXISTS podcasts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        type TEXT NOT NULL, 
        url TEXT NOT NULL,       
        thumbnailUrl TEXT 
    );`;

  // 1. ตารางเก็บโปรไฟล์หมอ (Specialists)
  const createSpecialistTableSql = ` 
  CREATE TABLE IF NOT EXISTS specialists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      title TEXT NOT NULL, 
      specialty TEXT,
      description TEXT,
      photoUrl TEXT,
      userId INTEGER REFERENCES users(id) UNIQUE,
      price INTEGER DEFAULT 1000
  );`;

  // 2. ตารางเก็บการนัดหมาย
  const createAppointmentsTableSql = `
    CREATE TABLE IF NOT EXISTS appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,       
        specialistId INTEGER NOT NULL, 
        reason TEXT,
        requestedTime TEXT NOT NULL,
        status TEXT DEFAULT 'pending', 
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        amount INTEGER,
        paymentStatus TEXT DEFAULT 'unpaid',
        omiseChargeId TEXT,
        FOREIGN KEY (userId) REFERENCES users (id),
        FOREIGN KEY (specialistId) REFERENCES specialists (id)
    );`;

  db.serialize(() => {
    db.run(createUserTableSql, (err) => {
      if (err) console.error("Error creating users table", err.message);
      else console.log("Users table is ready.");
    });

    // รัน Drop ก่อน แล้วค่อย Create
    db.run(dropPodcastTableSql, (err) => {
      if (err) console.error("Error dropping old podcasts table", err.message);

      db.run(createPodcastTableSql, (err) => {
        if (err)
          console.error("Error creating new podcasts table", err.message);
        else console.log("Podcasts table is ready.");
      });
    });

    db.run(createSpecialistTableSql, (err) => {
      if (err) console.error("Error creating specialists table", err.message);
      else {
        console.log("Specialists table is ready.");
        // เพิ่มข้อมูลหมอจำลอง (Seed data)
        const seedSql = `INSERT INTO specialists (name, title, specialty, description, photoUrl)
                          SELECT 'ดร. ใจดี มีเมตตา', 'จิตแพทย์', 'ความวิตกกังวล, ภาวะซึมเศร้า', 'ผู้เชี่ยวชาญด้านการบำบัดความคิดและพฤติกรรม (CBT) ประสบการณ์ 15 ปี', 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=500&auto=format&fit=crop&q=60'
                          WHERE NOT EXISTS (SELECT 1 FROM specialists WHERE name = 'ดร. ใจดี มีเมตตา');`;
        db.run(seedSql);
        const seedSql2 = `INSERT INTO specialists (name, title, specialty, description, photoUrl)
                          SELECT 'คุณ ปรึกษา อุ่นใจ', 'นักจิตบำบัด', 'ความสัมพันธ์, การจัดการความเครียด', 'เชี่ยวชาญการบำบัดแบบคู่รักและการรับฟัง เน้นสร้างพื้นที่ปลอดภัยในการพูดคุย', 'https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=500&auto=format&fit=crop&q=60'
                          WHERE NOT EXISTS (SELECT 1 FROM specialists WHERE name = 'คุณ ปรึกษา อุ่นใจ');`;
        db.run(seedSql2);
      }
    });

    db.run(createAppointmentsTableSql, (err) => {
      if (err) console.error("Error creating appointments table", err.message);
      else console.log("Appointments table is ready.");
    });
    const createNotificationTableSql = `
  CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL REFERENCES users(id),
      message TEXT NOT NULL,
      linkTo TEXT,
      isRead INTEGER DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );`;

    db.run(createNotificationTableSql, (err) => {
      if (err) console.error("Error creating notifications table", err.message);
      else console.log("Notifications table is ready.");
    });
  });
}

module.exports = db;
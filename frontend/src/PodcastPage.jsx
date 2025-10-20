// src/PodcastPage.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { useAuth } from "./AuthContext.jsx";
import "./PodcastPage.css"; // อย่าลืมไฟล์ CSS นี้

function PodcastPage() {
  const [podcasts, setPodcasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { user, token } = useAuth(); // ดึง user และ token มาเช็คสิทธิ์

  // State สำหรับฟอร์มเพิ่ม Podcast
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [podcastType, setPodcastType] = useState("youtube");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [mediaFile, setMediaFile] = useState(null);
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [submitError, setSubmitError] = useState("");

  // ดึงข้อมูล Podcast ทั้งหมด
  useEffect(() => {
    const fetchPodcasts = async () => {
      try {
        const response = await axios.get("http://localhost:3001/api/podcasts");
        setPodcasts(response.data.data);
      } catch (err) {
        setError("ไม่สามารถดึงข้อมูล Podcast ได้");
      } finally {
        setLoading(false);
      }
    };
    fetchPodcasts();
  }, []);

  // ฟังก์ชันส่งฟอร์มเพิ่ม Podcast
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError("");
    const formData = new FormData();
    formData.append("title", title);
    formData.append("description", description);
    formData.append("type", podcastType);

    if (podcastType === "youtube") {
      formData.append("youtubeUrl", youtubeUrl);
      formData.append("thumbnailUrl", thumbnailUrl);
    } else {
      if (mediaFile) formData.append("mediaFile", mediaFile);
      if (thumbnailFile) formData.append("thumbnailFile", thumbnailFile);
    }

    try {
      const response = await axios.post(
        "http://localhost:3001/api/podcasts",
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );

      setPodcasts([response.data.data, ...podcasts]); // เพิ่มอันใหม่ล่าสุดไว้บนสุด
      setShowForm(false);
      setTitle("");
      setDescription("");
      setYoutubeUrl("");
      setThumbnailUrl("");
      setMediaFile(null);
      setThumbnailFile(null);
    } catch (err) {
      setSubmitError("เพิ่ม Podcast ล้มเหลว (อาจต้องเป็น Admin เท่านั้น)");
    }
  };

  // --- ฟังก์ชันใหม่: สำหรับลบ Podcast ---
  const handleDelete = async (e, podcastId) => {
    // 1. หยุดไม่ให้ Link ทำงาน (จะได้ไม่เด้งไปหน้า Detail)
    e.stopPropagation();
    e.preventDefault();

    if (window.confirm("คุณแน่ใจหรือไม่ที่จะลบ Podcast นี้?")) {
      try {
        await axios.delete(`http://localhost:3001/api/podcasts/${podcastId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        
        // 2. ลบออกจาก State ทันที
        setPodcasts(podcasts.filter((p) => p.id !== podcastId));
      } catch (err) {
        alert("ลบ Podcast ล้มเหลว");
      }
    }
  };


  if (loading) return <div className="podcast-container"><p>กำลังโหลด...</p></div>;
  if (error) return <div className="podcast-container"><p className="error-message">{error}</p></div>;

  return (
    <div className="podcast-container">
      <h2>MindCare Podcasts</h2>

      {/* ปุ่มเปิด/ปิด ฟอร์มเพิ่ม Podcast */}
      {user && user.role === "admin" && (
        <button className="toggle-form-btn" onClick={() => setShowForm(!showForm)}>
          {showForm ? "ซ่อนฟอร์ม" : "เพิ่ม Podcast ใหม่ +"}
        </button>
      )}

      {/* ฟอร์มเพิ่ม Podcast (ที่คุณเรียกว่า 'ปุ่มอัปโหลด') */}
      {user && user.role === "admin" && showForm && (
        <form className="admin-podcast-form" onSubmit={handleSubmit}>
          <h3>เพิ่ม Podcast ใหม่</h3>
          {submitError && <p className="error-message">{submitError}</p>}
          <div className="input-group">
            <label>ประเภท:</label>
            <select value={podcastType} onChange={(e) => setPodcastType(e.target.value)}>
              <option value="youtube">ลิงก์ YouTube</option>
              <option value="upload">อัปโหลดไฟล์</option>
            </select>
          </div>
          <div className="input-group">
            <label>ชื่อคลิป:</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="input-group">
            <label>รายละเอียด:</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          {podcastType === "youtube" ? (
            <>
              <div className="input-group">
                <label>ลิงก์ YouTube (URLเต็ม):</label>
                <input type="text" value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} placeholder="เช่น https://www.youtube.com/watch?v=..." />
              </div>
              <div className="input-group">
                <label>ลิงก์รูปปก (URL):</label>
                <input type="text" value={thumbnailUrl} onChange={(e) => setThumbnailUrl(e.target.value)} placeholder="เช่น https://img.youtube.com/vi/.../0.jpg" />
              </div>
            </>
          ) : (
            <>
              <div className="input-group">
                <label>ไฟล์วิดีโอ/เสียง:</label>
                <input type="file" onChange={(e) => setMediaFile(e.target.files[0])} accept="video/*,audio/*" />
              </div>
              <div className="input-group">
                <label>ไฟล์รูปปก:</label>
                <input type="file" onChange={(e) => setThumbnailFile(e.target.files[0])} accept="image/*" />
              </div>
            </>
          )}
          <button type="submit" className="submit-btn">บันทึก Podcast</button>
        </form>
      )}

      {/* ตารางแสดง Podcast ทั้งหมด */}
      <div className="podcast-grid">
        {podcasts.map((podcast) => (
          <Link to={`/podcast/${podcast.id}`} key={podcast.id} className="podcast-card">
            
            {/* --- ปุ่มลบ (ใหม่!) --- */}
            {user && user.role === 'admin' && (
              <button 
                className="delete-podcast-btn" 
                onClick={(e) => handleDelete(e, podcast.id)}
              >
                X
              </button>
            )}
            
            <img src={podcast.thumbnailUrl} alt={podcast.title} className="podcast-thumbnail" />
            <div className="podcast-info">
              <h3 className="podcast-title">{podcast.title}</h3>
              <p className="podcast-description">{podcast.description.substring(0, 100)}...</p>
              <span className={`podcast-type ${podcast.type}`}>
                {podcast.type === 'youtube' ? 'YouTube' : 'Uploaded'}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default PodcastPage;
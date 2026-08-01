const express = require('express');
const router = express.Router();
const db = require('../db');
const { hashPassword, verifyPassword } = require('../utils/password');
const { isValidUsername, isValidPassword } = require('../utils/validate');

router.post('/register', (req, res) => {
  const { username, password, displayName } = req.body || {};

  if (!isValidUsername(username)) {
    return res.status(400).json({ error: 'ชื่อผู้ใช้ต้องมี 3-20 ตัวอักษร (a-z, 0-9, _) เท่านั้น' });
  }
  if (!isValidPassword(password)) {
    return res.status(400).json({ error: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(409).json({ error: 'ชื่อผู้ใช้นี้ถูกใช้งานแล้ว' });
  }

  const { hash, salt } = hashPassword(password);
  const name = (displayName || username).toString().slice(0, 50);

  const info = db.prepare(
    'INSERT INTO users (username, password_hash, password_salt, display_name, is_guest) VALUES (?, ?, ?, ?, 0)'
  ).run(username, hash, salt, name);

  req.session.userId = info.lastInsertRowid;
  res.json({ id: info.lastInsertRowid, username, displayName: name, isGuest: false });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !verifyPassword(password, user.password_salt, user.password_hash)) {
    return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
  }

  req.session.userId = user.id;
  res.json({ id: user.id, username: user.username, displayName: user.display_name, isGuest: !!user.is_guest });
});

router.post('/guest', (req, res) => {
  const guestName = 'guest_' + Math.random().toString(36).slice(2, 10);
  const { hash, salt } = hashPassword(Math.random().toString(36));

  const info = db.prepare(
    'INSERT INTO users (username, password_hash, password_salt, display_name, is_guest) VALUES (?, ?, ?, ?, 1)'
  ).run(guestName, hash, salt, 'ผู้เยี่ยมชม');

  req.session.userId = info.lastInsertRowid;
  res.json({ id: info.lastInsertRowid, username: guestName, displayName: 'ผู้เยี่ยมชม', isGuest: true });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

router.get('/me', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'ยังไม่ได้เข้าสู่ระบบ' });
  const user = db.prepare('SELECT id, username, display_name, is_guest FROM users WHERE id = ?').get(req.session.userId);
  if (!user) return res.status(401).json({ error: 'ยังไม่ได้เข้าสู่ระบบ' });
  res.json({ id: user.id, username: user.username, displayName: user.display_name, isGuest: !!user.is_guest });
});

module.exports = router;

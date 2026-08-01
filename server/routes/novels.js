const express = require('express');
const router = express.Router();
const db = require('../db');
const requireAuth = require('../middleware/requireAuth');
const { cleanText } = require('../utils/validate');

const GRADIENTS = [
  'linear-gradient(135deg,#6d5bd0,#8f7ff0)',
  'linear-gradient(135deg,#e0785a,#f0a58c)',
  'linear-gradient(135deg,#4a5568,#718096)',
  'linear-gradient(135deg,#2f855a,#68d391)',
  'linear-gradient(135deg,#b83280,#ed64a6)',
];

function randomGradient() {
  return GRADIENTS[Math.floor(Math.random() * GRADIENTS.length)];
}

// List current user's novels, with chapter counts
router.get('/', requireAuth, (req, res) => {
  const novels = db.prepare(`
    SELECT n.*, COUNT(c.id) as chapter_count, MAX(c.updated_at) as last_chapter_update
    FROM novels n
    LEFT JOIN chapters c ON c.novel_id = n.id
    WHERE n.user_id = ?
    GROUP BY n.id
    ORDER BY n.updated_at DESC
  `).all(req.session.userId);
  res.json(novels);
});

// Get one novel (with chapter list) if owned by user
router.get('/:id', requireAuth, (req, res) => {
  const novel = db.prepare('SELECT * FROM novels WHERE id = ? AND user_id = ?').get(req.params.id, req.session.userId);
  if (!novel) return res.status(404).json({ error: 'ไม่พบนิยาย' });

  const chapters = db.prepare(
    'SELECT id, chapter_number, title, word_count, updated_at FROM chapters WHERE novel_id = ? ORDER BY chapter_number ASC'
  ).all(novel.id);

  res.json({ ...novel, chapters });
});

// Create novel
router.post('/', requireAuth, (req, res) => {
  const title = cleanText(req.body?.title, 200).trim();
  const genre = cleanText(req.body?.genre, 50).trim();
  if (!title) return res.status(400).json({ error: 'กรุณาระบุชื่อนิยาย' });

  const info = db.prepare(
    'INSERT INTO novels (user_id, title, genre, cover_gradient) VALUES (?, ?, ?, ?)'
  ).run(req.session.userId, title, genre, randomGradient());

  const novel = db.prepare('SELECT * FROM novels WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(novel);
});

// Update novel meta
router.put('/:id', requireAuth, (req, res) => {
  const novel = db.prepare('SELECT * FROM novels WHERE id = ? AND user_id = ?').get(req.params.id, req.session.userId);
  if (!novel) return res.status(404).json({ error: 'ไม่พบนิยาย' });

  const title = req.body?.title !== undefined ? cleanText(req.body.title, 200).trim() : novel.title;
  const genre = req.body?.genre !== undefined ? cleanText(req.body.genre, 50).trim() : novel.genre;
  const status = req.body?.status !== undefined ? cleanText(req.body.status, 20).trim() : novel.status;

  db.prepare(
    "UPDATE novels SET title = ?, genre = ?, status = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(title, genre, status, novel.id);

  res.json(db.prepare('SELECT * FROM novels WHERE id = ?').get(novel.id));
});

// Delete novel
router.delete('/:id', requireAuth, (req, res) => {
  const novel = db.prepare('SELECT * FROM novels WHERE id = ? AND user_id = ?').get(req.params.id, req.session.userId);
  if (!novel) return res.status(404).json({ error: 'ไม่พบนิยาย' });
  db.prepare('DELETE FROM novels WHERE id = ?').run(novel.id);
  res.json({ ok: true });
});

module.exports = router;

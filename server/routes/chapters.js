const express = require('express');
const router = express.Router();
const db = require('../db');
const requireAuth = require('../middleware/requireAuth');
const { cleanText } = require('../utils/validate');

function countWords(text) {
  const trimmed = (text || '').trim();
  if (!trimmed) return 0;
  // Works reasonably for Thai (char-dense) and space-separated languages alike
  return trimmed.split(/\s+/).length;
}

function ownsNovel(novelId, userId) {
  return db.prepare('SELECT id FROM novels WHERE id = ? AND user_id = ?').get(novelId, userId);
}

// List chapters for a novel
router.get('/novels/:novelId/chapters', requireAuth, (req, res) => {
  if (!ownsNovel(req.params.novelId, req.session.userId)) return res.status(404).json({ error: 'ไม่พบนิยาย' });
  const chapters = db.prepare(
    'SELECT id, chapter_number, title, word_count, updated_at FROM chapters WHERE novel_id = ? ORDER BY chapter_number ASC'
  ).all(req.params.novelId);
  res.json(chapters);
});

// Get single chapter (with full content) — used by both editor and reader
router.get('/chapters/:id', requireAuth, (req, res) => {
  const chapter = db.prepare('SELECT * FROM chapters WHERE id = ?').get(req.params.id);
  if (!chapter) return res.status(404).json({ error: 'ไม่พบตอน' });
  if (!ownsNovel(chapter.novel_id, req.session.userId)) return res.status(404).json({ error: 'ไม่พบตอน' });
  res.json(chapter);
});

// Create new chapter
router.post('/novels/:novelId/chapters', requireAuth, (req, res) => {
  if (!ownsNovel(req.params.novelId, req.session.userId)) return res.status(404).json({ error: 'ไม่พบนิยาย' });

  const maxRow = db.prepare('SELECT MAX(chapter_number) as maxNum FROM chapters WHERE novel_id = ?').get(req.params.novelId);
  const nextNum = (maxRow.maxNum || 0) + 1;

  const title = cleanText(req.body?.title, 200).trim() || `ตอนที่ ${nextNum}`;
  const content = cleanText(req.body?.content, 200000);
  const wordCount = countWords(content);

  const info = db.prepare(
    'INSERT INTO chapters (novel_id, chapter_number, title, content, word_count) VALUES (?, ?, ?, ?, ?)'
  ).run(req.params.novelId, nextNum, title, content, wordCount);

  db.prepare("UPDATE novels SET updated_at = datetime('now') WHERE id = ?").run(req.params.novelId);

  res.status(201).json(db.prepare('SELECT * FROM chapters WHERE id = ?').get(info.lastInsertRowid));
});

// Update chapter (autosave target)
router.put('/chapters/:id', requireAuth, (req, res) => {
  const chapter = db.prepare('SELECT * FROM chapters WHERE id = ?').get(req.params.id);
  if (!chapter) return res.status(404).json({ error: 'ไม่พบตอน' });
  if (!ownsNovel(chapter.novel_id, req.session.userId)) return res.status(404).json({ error: 'ไม่พบตอน' });

  const title = req.body?.title !== undefined ? cleanText(req.body.title, 200).trim() : chapter.title;
  const content = req.body?.content !== undefined ? cleanText(req.body.content, 200000) : chapter.content;
  const wordCount = countWords(content);

  db.prepare(
    "UPDATE chapters SET title = ?, content = ?, word_count = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(title, content, wordCount, chapter.id);

  db.prepare("UPDATE novels SET updated_at = datetime('now') WHERE id = ?").run(chapter.novel_id);

  res.json(db.prepare('SELECT * FROM chapters WHERE id = ?').get(chapter.id));
});

// Delete chapter
router.delete('/chapters/:id', requireAuth, (req, res) => {
  const chapter = db.prepare('SELECT * FROM chapters WHERE id = ?').get(req.params.id);
  if (!chapter) return res.status(404).json({ error: 'ไม่พบตอน' });
  if (!ownsNovel(chapter.novel_id, req.session.userId)) return res.status(404).json({ error: 'ไม่พบตอน' });

  db.prepare('DELETE FROM chapters WHERE id = ?').run(chapter.id);
  res.json({ ok: true });
});

module.exports = router;

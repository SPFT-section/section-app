const express = require('express');
const router = express.Router();
const db = require('../db');
const requireAuth = require('../middleware/requireAuth');

router.put('/:novelId', requireAuth, (req, res) => {
  const novel = db.prepare('SELECT id FROM novels WHERE id = ?').get(req.params.novelId);
  if (!novel) return res.status(404).json({ error: 'ไม่พบนิยาย' });

  const chapterId = req.body?.chapterId || null;
  const percent = Math.max(0, Math.min(100, parseInt(req.body?.percent, 10) || 0));

  db.prepare(`
    INSERT INTO reading_progress (user_id, novel_id, chapter_id, percent, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(user_id, novel_id) DO UPDATE SET
      chapter_id = excluded.chapter_id,
      percent = excluded.percent,
      updated_at = datetime('now')
  `).run(req.session.userId, req.params.novelId, chapterId, percent);

  res.json({ ok: true });
});

router.get('/:novelId', requireAuth, (req, res) => {
  const progress = db.prepare(
    'SELECT * FROM reading_progress WHERE user_id = ? AND novel_id = ?'
  ).get(req.session.userId, req.params.novelId);
  res.json(progress || { percent: 0, chapter_id: null });
});

module.exports = router;

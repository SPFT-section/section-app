require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');

const authRoutes = require('./routes/auth');
const novelRoutes = require('./routes/novels');
const chapterRoutes = require('./routes/chapters');
const progressRoutes = require('./routes/progress');

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

app.set('trust proxy', 1);
app.use(express.json({ limit: '2mb' }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
  },
}));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/novels', novelRoutes);
app.use('/api', chapterRoutes); // /api/novels/:novelId/chapters, /api/chapters/:id
app.use('/api/progress', progressRoutes);

// Static frontend
app.use(express.static(path.join(__dirname, '..', 'public')));

// SPA-style fallback for page routes (client-side router handles the rest)
app.get(['/', '/library', '/reader', '/editor', '/login'], (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'เกิดข้อผิดพลาดบางอย่าง' });
});

app.listen(PORT, () => {
  console.log(`SECTiON server running on http://localhost:${PORT}`);
});

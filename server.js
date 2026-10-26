// Точка входа: сессии, статика, API, журнал действий.
const express = require('express');
const session = require('express-session');
const path = require('path');
const { load, save } = require('./db');
const { currentUser, activeRole } = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '2mb' }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'orencode-2026-demo-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 8 }
}));

// Журнал действий: все изменения (POST/PUT/PATCH/DELETE) с успешным ответом.
app.use((req, res, next) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  res.on('finish', () => {
    if (res.statusCode >= 400) return;
    try {
      const db = load();
      const user = currentUser(req);
      db.auditLog.unshift({
        id: 'log_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        at: new Date().toISOString().slice(0, 19),
        userId: user ? user.id : null,
        login: user ? user.login : 'гость',
        action: req.method.toLowerCase(),
        entity: req.path.split('/').filter(Boolean).slice(1, 3).join('/') || req.path,
        entityId: null,
        details: req.method + ' ' + req.originalUrl + (user ? ' (' + activeRole(req) + ')' : '')
      });
      if (db.auditLog.length > 500) db.auditLog.length = 500;
      save();
    } catch (e) {
      console.error('audit:', e.message);
    }
  });
  next();
});

app.use('/api', require('./routes/auth'));
app.use('/api', require('./routes/users'));
app.use('/api', require('./routes/dashboard'));
app.use('/api', require('./routes/competitions'));
app.use('/api', require('./routes/applications'));
app.use('/api', require('./routes/ranks'));
app.use('/api', require('./routes/judges'));
app.use('/api', require('./routes/rating'));
app.use('/api', require('./routes/reports'));
app.use('/api', require('./routes/notifications'));
app.use('/api', require('./routes/audit'));
app.use('/api', require('./routes/settings'));
app.use('/api', require('./routes/links'));
app.use('/api', require('./routes/public'));

app.use(express.static(path.join(__dirname, 'public')));

// Неизвестный API — честный 404, остальное отдаёт приложение.
app.all('/api/*', (req, res) => res.status(404).json({ error: 'Раздел API не найден' }));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Ошибки — в JSON, чтобы фронт показал нормальный текст.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Ошибка сервера' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('Платформа ФСП Оренбургской области: http://localhost:' + PORT);
  console.log('Демо-аккаунты: federation / athlete / trainer / judge / multi / ministry, пароль demo123');
});

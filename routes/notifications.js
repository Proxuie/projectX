// Уведомления.
const express = require('express');
const { load, save } = require('../db');
const { requireAuth, currentUser } = require('../auth');

const router = express.Router();

router.get('/notifications', requireAuth, (req, res) => {
  const db = load();
  const user = currentUser(req);
  const list = db.notifications
    .filter((n) => n.userId === user.id)
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  res.json({
    unread: list.filter((n) => !n.read).length,
    items: list
  });
});

router.post('/notifications/:id/read', requireAuth, (req, res) => {
  const db = load();
  const user = currentUser(req);
  const n = db.notifications.find((x) => x.id === req.params.id && x.userId === user.id);
  if (!n) return res.status(404).json({ error: 'Уведомление не найдено' });
  n.read = true;
  save();
  res.json({ ok: true });
});

router.post('/notifications/read-all', requireAuth, (req, res) => {
  const db = load();
  const user = currentUser(req);
  for (const n of db.notifications) {
    if (n.userId === user.id) n.read = true;
  }
  save();
  res.json({ ok: true });
});

module.exports = router;

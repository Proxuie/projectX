// Журнал действий — только федерация.
const express = require('express');
const { load } = require('../db');
const { requireAuth, activeRole } = require('../auth');

const router = express.Router();

router.get('/audit', requireAuth, (req, res) => {
  if (activeRole(req) !== 'federation') return res.status(403).json({ error: 'Только федерация' });
  const db = load();
  const limit = Math.min(Number(req.query.limit) || 200, 500);
  res.json(db.auditLog.slice(0, limit));
});

module.exports = router;

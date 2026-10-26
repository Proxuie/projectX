// Настройки федерации.
const express = require('express');
const { load, save } = require('../db');
const { requireAuth, activeRole } = require('../auth');

const router = express.Router();

router.get('/settings', requireAuth, (req, res) => {
  const db = load();
  res.json({
    settings: db.settings,
    competitionTypes: db.dictionaries.competitionTypes
  });
});

router.put('/settings', requireAuth, (req, res) => {
  if (activeRole(req) !== 'federation') return res.status(403).json({ error: 'Только федерация' });

  const db = load();
  const b = req.body || {};

  if (b.ratingPoints) {
    for (const level of Object.keys(b.ratingPoints)) {
      const row = b.ratingPoints[level];
      if (Array.isArray(row)) {
        db.settings.ratingPoints[level] = row.map((x) => Number(x) || 0);
      }
    }
  }
  if (b.stabilityCoeff !== undefined) db.settings.stabilityCoeff = Number(b.stabilityCoeff) || 1.2;
  if (b.rankValidityYears !== undefined) db.settings.rankValidityYears = Number(b.rankValidityYears) || 2;
  if (b.judgeCategoryValidityYears !== undefined) db.settings.judgeCategoryValidityYears = Number(b.judgeCategoryValidityYears) || 4;
  if (b.premiyaDeadline) db.settings.premiyaDeadline = String(b.premiyaDeadline);
  if (Array.isArray(b.rankRules)) db.settings.rankRules = b.rankRules;

  if (Array.isArray(b.competitionTypes)) {
    db.dictionaries.competitionTypes = b.competitionTypes.filter((t) => t && t.name);
  }

  save();
  res.json({ ok: true, settings: db.settings });
});

module.exports = router;

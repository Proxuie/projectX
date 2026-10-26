// Публичная часть: навигатор и проверка справки.
const express = require('express');
const { load } = require('../db');
const { iso, levelName, typeName } = require('../utils');

const router = express.Router();

router.get('/public/landing', (req, res) => {
  const db = load();
  const today = iso();

  const upcoming = db.competitions
    .filter((c) => c.status !== 'draft' && c.startDate >= today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .slice(0, 6)
    .map((c) => {
      const disc = db.dictionaries.disciplines.find((d) => d.code === c.discipline);
      return {
        id: c.id,
        title: c.title,
        disciplineName: disc ? disc.name : c.discipline,
        levelName: levelName(c.level),
        typeName: typeName(c.typeId),
        startDate: c.startDate,
        place: c.place,
        format: c.format,
        status: c.status
      };
    });

  res.json({
    disciplines: db.dictionaries.disciplines,
    organizations: db.organizations.map((o) => ({
      id: o.id,
      name: o.name,
      type: o.type,
      municipality: o.municipality
    })),
    upcoming,
    stats: {
      athletes: db.users.filter((u) => u.roles.includes('athlete')).length,
      competitions: db.competitions.filter((c) => c.status === 'finished').length,
      organizations: db.organizations.length,
      judges: db.users.filter((u) => u.roles.includes('judge')).length
    }
  });
});

// Публичная проверка справки по коду с QR.
router.get('/verify/:code', (req, res) => {
  const db = load();
  const cert = db.certificates.find((c) => c.verifyCode === req.params.code);
  if (!cert) return res.status(404).json({ error: 'Справка не найдена' });

  const athlete = db.users.find((u) => u.id === cert.athleteId);
  const comp = db.competitions.find((c) => c.id === cert.competitionId);
  const result = db.results.find((r) => r.id === cert.resultId);

  res.json({
    valid: true,
    number: cert.number,
    fio: athlete ? athlete.fio : '—',
    competition: comp ? comp.title : '—',
    date: comp ? comp.startDate : '',
    place: result ? result.place : null,
    points: result ? result.points : null,
    issuedAt: cert.createdAt,
    status: 'действительна'
  });
});

module.exports = router;

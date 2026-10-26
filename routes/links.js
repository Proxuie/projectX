// Привязка спортсменов к тренерам.
const express = require('express');
const { load, save, nextId } = require('../db');
const { requireAuth, currentUser, activeRole } = require('../auth');
const { iso, notify } = require('../utils');

const router = express.Router();

function enrich(l) {
  const db = load();
  const trainer = db.users.find((u) => u.id === l.trainerId);
  const athlete = db.users.find((u) => u.id === l.athleteId);
  return {
    ...l,
    trainerFio: trainer ? trainer.fio : '—',
    athleteFio: athlete ? athlete.fio : '—'
  };
}

router.get('/trainer-links', requireAuth, (req, res) => {
  const db = load();
  const user = currentUser(req);
  const role = activeRole(req);

  let list = db.trainerLinks.slice();
  if (role === 'trainer') list = list.filter((l) => l.trainerId === user.id);
  else if (role === 'athlete') list = list.filter((l) => l.athleteId === user.id);
  else if (role === 'federation' || role === 'ministry') { /* всё */ }
  else return res.status(403).json({ error: 'Нет доступа' });

  res.json(list.map(enrich));
});

router.post('/trainer-links', requireAuth, (req, res) => {
  if (activeRole(req) !== 'trainer') return res.status(403).json({ error: 'Только тренер' });

  const db = load();
  const user = currentUser(req);
  const b = req.body || {};

  const athlete = db.users.find((u) => u.id === b.athleteId);
  if (!athlete || !athlete.roles.includes('athlete')) {
    return res.status(400).json({ error: 'Спортсмен не найден' });
  }
  if (!b.discipline) return res.status(400).json({ error: 'Укажите дисциплину' });

  const exists = db.trainerLinks.find((l) =>
    l.trainerId === user.id && l.athleteId === athlete.id && l.status !== 'ended');
  if (exists) return res.status(400).json({ error: 'Связь уже существует' });

  const link = {
    id: nextId('tl'),
    trainerId: user.id,
    athleteId: athlete.id,
    discipline: b.discipline,
    status: 'pending',
    history: [{ status: 'pending', date: iso(), by: user.id }]
  };
  db.trainerLinks.push(link);

  notify(athlete.id, 'Запрос на привязку тренера',
    user.fio + ' просит привязать вас по дисциплине. Подтвердите в профиле.', '#/profile');

  save();
  res.json(enrich(link));
});

router.post('/trainer-links/:id/confirm', requireAuth, (req, res) => {
  const db = load();
  const user = currentUser(req);
  const link = db.trainerLinks.find((l) => l.id === req.params.id);
  if (!link) return res.status(404).json({ error: 'Связь не найдена' });
  if (link.athleteId !== user.id) return res.status(403).json({ error: 'Подтверждает только спортсмен' });
  if (link.status !== 'pending') return res.status(400).json({ error: 'Запрос уже обработан' });

  link.status = 'active';
  link.history.push({ status: 'active', date: iso(), by: user.id });

  notify(link.trainerId, 'Привязка подтверждена', user.fio + ' подтвердил(а) привязку.', '#/my-athletes');
  save();
  res.json(enrich(link));
});

router.post('/trainer-links/:id/decline', requireAuth, (req, res) => {
  const db = load();
  const user = currentUser(req);
  const link = db.trainerLinks.find((l) => l.id === req.params.id);
  if (!link) return res.status(404).json({ error: 'Связь не найдена' });
  if (link.athleteId !== user.id && link.trainerId !== user.id) {
    return res.status(403).json({ error: 'Нет доступа' });
  }

  link.status = 'ended';
  link.history.push({ status: 'ended', date: iso(), by: user.id });
  save();
  res.json({ ok: true });
});

module.exports = router;

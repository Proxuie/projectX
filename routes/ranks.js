// Разряды: заявки, присвоение, контроль сроков.
const express = require('express');
const { load, save, nextId } = require('../db');
const { requireAuth, currentUser, activeRole } = require('../auth');
const { iso, daysLeft, notify, orgName } = require('../utils');

const router = express.Router();

function enrich(a) {
  const db = load();
  const athlete = db.users.find((u) => u.id === a.athleteId);
  const comp = db.competitions.find((c) => c.id === a.competitionId);
  const result = db.results.find((r) => r.id === a.resultId);
  return {
    ...a,
    fio: athlete ? athlete.fio : '—',
    organizationName: athlete ? orgName(athlete.organizationId) : '—',
    competitionTitle: comp ? comp.title : '—',
    competitionDate: comp ? comp.startDate : '',
    place: result ? result.place : null,
    currentRank: athlete && athlete.rank ? athlete.rank.title : '—',
    daysLeft: a.validUntil ? daysLeft(a.validUntil) : null
  };
}

function federationUsers() {
  return load().users.filter((u) => u.roles.includes('federation'));
}

router.get('/ranks/applications', requireAuth, (req, res) => {
  const db = load();
  const user = currentUser(req);
  const role = activeRole(req);

  let list = db.rankApplications.slice();

  if (role === 'athlete') {
    list = list.filter((a) => a.athleteId === user.id);
  } else if (role === 'trainer') {
    const ids = db.trainerLinks.filter((l) => l.trainerId === user.id).map((l) => l.athleteId);
    list = list.filter((a) => ids.includes(a.athleteId));
  } else if (!['federation', 'ministry'].includes(role)) {
    return res.status(403).json({ error: 'Нет доступа' });
  }

  if (req.query.status) list = list.filter((a) => a.status === req.query.status);
  list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  res.json(list.map(enrich));
});

router.post('/ranks/applications', requireAuth, (req, res) => {
  const db = load();
  const user = currentUser(req);
  const role = activeRole(req);
  const b = req.body || {};

  if (!['athlete', 'trainer'].includes(role)) {
    return res.status(403).json({ error: 'Заявку подаёт спортсмен или тренер' });
  }

  const athleteId = role === 'trainer' ? b.athleteId : user.id;
  const athlete = db.users.find((u) => u.id === athleteId);
  if (!athlete) return res.status(400).json({ error: 'Спортсмен не найден' });

  if (role === 'trainer') {
    const link = db.trainerLinks.find((l) =>
      l.trainerId === user.id && l.athleteId === athleteId && l.status === 'active');
    if (!link) return res.status(403).json({ error: 'Спортсмен не привязан к вам' });
  }

  if (!b.requestedRank) return res.status(400).json({ error: 'Укажите разряд' });
  if (!b.competitionId || !b.resultId) {
    return res.status(400).json({ error: 'Нужны соревнование и результат' });
  }

  const result = db.results.find((r) => r.id === b.resultId);
  if (!result || result.athleteId !== athleteId) {
    return res.status(400).json({ error: 'Результат не принадлежит спортсмену' });
  }

  const pending = db.rankApplications.find((a) => a.athleteId === athleteId && a.status === 'pending');
  if (pending) return res.status(400).json({ error: 'У спортсмена уже есть заявка на рассмотрении' });

  const app = {
    id: nextId('ra'),
    athleteId,
    requestedRank: b.requestedRank,
    competitionId: b.competitionId,
    resultId: b.resultId,
    status: 'pending',
    comment: null,
    createdAt: iso(),
    decidedAt: null,
    decidedBy: null,
    orderNumber: null,
    validUntil: null
  };
  db.rankApplications.push(app);

  for (const fed of federationUsers()) {
    notify(fed.id, 'Заявка на разряд', athlete.fio + ' — ' + b.requestedRank + '.', '#/ranks');
  }

  save();
  res.json(enrich(app));
});

router.post('/ranks/applications/:id/approve', requireAuth, (req, res) => {
  const db = load();
  if (activeRole(req) !== 'federation') return res.status(403).json({ error: 'Только федерация' });

  const app = db.rankApplications.find((a) => a.id === req.params.id);
  if (!app) return res.status(404).json({ error: 'Заявка не найдена' });
  if (app.status !== 'pending') return res.status(400).json({ error: 'Заявка уже рассмотрена' });

  const b = req.body || {};
  const years = db.settings.rankValidityYears || 2;
  const validUntil = b.validUntil || (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + years);
    return iso(d);
  })();

  app.status = 'approved';
  app.decidedAt = iso();
  app.decidedBy = currentUser(req).id;
  app.orderNumber = b.orderNumber || ('№ ' + Math.floor(Math.random() * 200 + 1) + '-р');
  app.validUntil = validUntil;

  const athlete = db.users.find((u) => u.id === app.athleteId);
  if (athlete) {
    athlete.rank = {
      title: app.requestedRank,
      date: app.decidedAt,
      orderNumber: app.orderNumber,
      validUntil
    };
  }

  notify(app.athleteId, 'Разряд присвоен',
    'Присвоен разряд «' + app.requestedRank + '». Приказ ' + app.orderNumber + '.', '#/my-rank');

  save();
  res.json(enrich(app));
});

router.post('/ranks/applications/:id/reject', requireAuth, (req, res) => {
  const db = load();
  if (activeRole(req) !== 'federation') return res.status(403).json({ error: 'Только федерация' });

  const app = db.rankApplications.find((a) => a.id === req.params.id);
  if (!app) return res.status(404).json({ error: 'Заявка не найдена' });
  if (app.status !== 'pending') return res.status(400).json({ error: 'Заявка уже рассмотрена' });

  app.status = 'rejected';
  app.decidedAt = iso();
  app.comment = (req.body || {}).comment || 'Без комментария';

  notify(app.athleteId, 'Заявка на разряд отклонена', app.comment, '#/my-rank');

  save();
  res.json(enrich(app));
});

// Спортсмены с истекающими или истёкшими разрядами.
router.get('/ranks/expiring', requireAuth, (req, res) => {
  const role = activeRole(req);
  if (!['federation', 'ministry', 'trainer'].includes(role)) {
    return res.status(403).json({ error: 'Нет доступа' });
  }

  const db = load();
  const me = currentUser(req);
  let athletes = db.users.filter((u) => u.roles.includes('athlete') && u.rank);

  if (role === 'trainer') {
    const ids = db.trainerLinks.filter((l) => l.trainerId === me.id && l.status === 'active').map((l) => l.athleteId);
    athletes = athletes.filter((u) => ids.includes(u.id));
  }

  const list = athletes
    .map((u) => ({
      athleteId: u.id,
      fio: u.fio,
      organizationName: orgName(u.organizationId),
      rank: u.rank.title,
      validUntil: u.rank.validUntil,
      daysLeft: daysLeft(u.rank.validUntil)
    }))
    .filter((x) => x.daysLeft !== null && x.daysLeft <= 30)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  res.json(list);
});

module.exports = router;

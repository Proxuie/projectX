// Заявки на соревнования.
const express = require('express');
const { load, save, nextId } = require('../db');
const { requireAuth, currentUser, activeRole } = require('../auth');
const { iso, ageAt, orgName, notify, daysLeft } = require('../utils');

const router = express.Router();

function enrich(a) {
  const db = load();
  const comp = db.competitions.find((c) => c.id === a.competitionId);
  const athlete = db.users.find((u) => u.id === a.athleteId);
  const sub = db.users.find((u) => u.id === a.submittedBy);
  const disc = comp ? db.dictionaries.disciplines.find((d) => d.code === comp.discipline) : null;
  return {
    ...a,
    competitionTitle: comp ? comp.title : '—',
    competitionDate: comp ? comp.startDate : '',
    disciplineName: disc ? disc.name : '',
    fio: athlete ? athlete.fio : '—',
    age: athlete ? ageAt(athlete.birthDate) : null,
    organizationName: athlete ? orgName(athlete.organizationId) : '—',
    submittedByName: sub ? sub.fio : '—',
    daysLeft: comp ? daysLeft(comp.startDate) : null
  };
}

function federationUsers() {
  return load().users.filter((u) => u.roles.includes('federation'));
}

router.get('/applications', requireAuth, (req, res) => {
  const db = load();
  const user = currentUser(req);
  const role = activeRole(req);

  let list = db.applications.slice();

  if (role === 'athlete') {
    list = list.filter((a) => a.athleteId === user.id);
  } else if (role === 'trainer') {
    const ids = db.trainerLinks.filter((l) => l.trainerId === user.id).map((l) => l.athleteId);
    list = list.filter((a) => ids.includes(a.athleteId) || a.submittedBy === user.id);
  } else if (!['federation', 'ministry'].includes(role)) {
    return res.status(403).json({ error: 'Нет доступа' });
  }

  if (req.query.status) list = list.filter((a) => a.status === req.query.status);
  if (req.query.competitionId) list = list.filter((a) => a.competitionId === req.query.competitionId);
  if (req.query.athleteId) list = list.filter((a) => a.athleteId === req.query.athleteId);

  list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  res.json(list.map(enrich));
});

router.post('/applications', requireAuth, (req, res) => {
  const db = load();
  const user = currentUser(req);
  const role = activeRole(req);
  const b = req.body || {};

  if (!['athlete', 'trainer'].includes(role)) {
    return res.status(403).json({ error: 'Заявку подаёт спортсмен или тренер' });
  }

  const comp = db.competitions.find((c) => c.id === b.competitionId);
  if (!comp) return res.status(404).json({ error: 'Соревнование не найдено' });
  if (comp.status !== 'registration') {
    return res.status(400).json({ error: 'Приём заявок на это соревнование не открыт' });
  }
  if (daysLeft(comp.applicationDeadline) < 0) {
    return res.status(400).json({ error: 'Срок подачи заявок истёк' });
  }

  const athleteId = role === 'trainer' ? b.athleteId : user.id;
  const athlete = db.users.find((u) => u.id === athleteId);
  if (!athlete || !athlete.roles.includes('athlete')) {
    return res.status(400).json({ error: 'Спортсмен не найден' });
  }

  if (role === 'trainer') {
    const link = db.trainerLinks.find((l) =>
      l.trainerId === user.id && l.athleteId === athleteId && l.status === 'active');
    if (!link) return res.status(403).json({ error: 'Спортсмен не привязан к вам' });
  }

  const exists = db.applications.find((a) => a.competitionId === comp.id && a.athleteId === athleteId &&
    a.status !== 'rejected' && a.status !== 'withdrawn');
  if (exists) return res.status(400).json({ error: 'Заявка уже подана' });

  const group = db.dictionaries.ageGroups.find((g) => g.code === comp.ageGroup);
  if (group) {
    const age = ageAt(athlete.birthDate, comp.startDate);
    if (age < group.from || age > group.to) {
      return res.status(400).json({ error: 'Спортсмен не проходит по возрастной группе (возраст: ' + age + ')' });
    }
  }

  const app = {
    id: nextId('app'),
    competitionId: comp.id,
    athleteId,
    submittedBy: user.id,
    status: 'pending',
    comment: null,
    createdAt: iso(),
    decidedAt: null
  };
  db.applications.push(app);

  for (const fed of federationUsers()) {
    notify(fed.id, 'Новая заявка на соревнование',
      athlete.fio + ' подал(а) заявку на «' + comp.title + '».', '#/applications');
  }

  save();
  res.json(enrich(app));
});

router.post('/applications/:id/approve', requireAuth, (req, res) => {
  const db = load();
  if (activeRole(req) !== 'federation') return res.status(403).json({ error: 'Только федерация' });

  const app = db.applications.find((a) => a.id === req.params.id);
  if (!app) return res.status(404).json({ error: 'Заявка не найдена' });
  if (app.status !== 'pending') return res.status(400).json({ error: 'Заявка уже рассмотрена' });

  app.status = 'approved';
  app.decidedAt = iso();
  app.comment = (req.body || {}).comment || null;

  const comp = db.competitions.find((c) => c.id === app.competitionId);
  notify(app.athleteId, 'Заявка одобрена',
    'Заявка на «' + (comp ? comp.title : '') + '» одобрена.', '#/my-applications');
  if (app.submittedBy !== app.athleteId) {
    notify(app.submittedBy, 'Заявка одобрена', 'Заявка вашего спортсмена одобрена.', '#/trainer-applications');
  }

  save();
  res.json(enrich(app));
});

router.post('/applications/:id/reject', requireAuth, (req, res) => {
  const db = load();
  if (activeRole(req) !== 'federation') return res.status(403).json({ error: 'Только федерация' });

  const app = db.applications.find((a) => a.id === req.params.id);
  if (!app) return res.status(404).json({ error: 'Заявка не найдена' });
  if (app.status !== 'pending') return res.status(400).json({ error: 'Заявка уже рассмотрена' });

  app.status = 'rejected';
  app.decidedAt = iso();
  app.comment = (req.body || {}).comment || 'Без комментария';

  const comp = db.competitions.find((c) => c.id === app.competitionId);
  notify(app.athleteId, 'Заявка отклонена',
    'Заявка на «' + (comp ? comp.title : '') + '» отклонена: ' + app.comment, '#/my-applications');

  save();
  res.json(enrich(app));
});

router.delete('/applications/:id', requireAuth, (req, res) => {
  const db = load();
  const user = currentUser(req);
  const app = db.applications.find((a) => a.id === req.params.id);
  if (!app) return res.status(404).json({ error: 'Заявка не найдена' });
  if (app.athleteId !== user.id || app.status !== 'pending') {
    return res.status(403).json({ error: 'Отозвать можно только свою заявку на рассмотрении' });
  }
  app.status = 'withdrawn';
  save();
  res.json({ ok: true });
});

module.exports = router;

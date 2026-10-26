// Реестр пользователей и организаций.
const express = require('express');
const bcrypt = require('bcryptjs');
const { load, save, nextId } = require('../db');
const { currentUser, activeRole, requireAuth, publicUser } = require('../auth');
const { iso, ageAt, orgName } = require('../utils');

const router = express.Router();

function enrich(u) {
  const db = load();
  return {
    ...publicUser(u),
    organizationName: u.organizationId ? orgName(u.organizationId) : '—',
    age: ageAt(u.birthDate),
    rankDaysLeft: u.rank ? require('../utils').daysLeft(u.rank.validUntil) : null,
    categoryDaysLeft: u.judgeCategory ? require('../utils').daysLeft(u.judgeCategory.validUntil) : null,
    disciplinesNames: u.disciplines.map((code) => {
      const d = db.dictionaries.disciplines.find((x) => x.code === code);
      return d ? d.name : code;
    })
  };
}

router.get('/users', requireAuth, (req, res) => {
  const role = activeRole(req);
  if (!['federation', 'ministry', 'trainer', 'judge'].includes(role)) {
    return res.status(403).json({ error: 'Нет доступа' });
  }

  const db = load();
  let list = db.users.slice();

  const q = String(req.query.q || '').trim().toLowerCase();
  const roleFilter = req.query.role;
  const discipline = req.query.discipline;
  const org = req.query.org;
  const rank = req.query.rank;
  const age = req.query.age;
  const municipality = req.query.municipality;

  if (roleFilter) list = list.filter((u) => u.roles.includes(roleFilter));
  if (q) list = list.filter((u) => (u.fio + ' ' + u.login + ' ' + (u.email || '')).toLowerCase().includes(q));
  if (discipline) list = list.filter((u) => u.disciplines.includes(discipline));
  if (org) list = list.filter((u) => u.organizationId === org);
  if (rank) list = list.filter((u) => u.rank && u.rank.title === rank);
  if (municipality) list = list.filter((u) => u.municipality === municipality);

  if (age) {
    const group = db.dictionaries.ageGroups.find((g) => g.code === age);
    if (group) list = list.filter((u) => {
      const a = ageAt(u.birthDate);
      return a >= group.from && a <= group.to;
    });
  }

  list.sort((a, b) => a.fio.localeCompare(b.fio));
  res.json(list.map(enrich));
});

router.get('/users/:id', requireAuth, (req, res) => {
  const db = load();
  const user = db.users.find((u) => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

  const links = db.trainerLinks.filter((l) => l.athleteId === user.id || l.trainerId === user.id);
  const trainers = links
    .filter((l) => l.athleteId === user.id)
    .map((l) => {
      const t = db.users.find((x) => x.id === l.trainerId);
      return { linkId: l.id, trainerId: l.trainerId, fio: t ? t.fio : '—', discipline: l.discipline, status: l.status };
    });

  const results = db.results
    .filter((r) => r.athleteId === user.id)
    .map((r) => {
      const c = db.competitions.find((x) => x.id === r.competitionId);
      return {
        id: r.id,
        competitionId: r.competitionId,
        title: c ? c.title : '—',
        date: c ? c.startDate : '',
        discipline: c ? c.discipline : '',
        place: r.place,
        points: r.points,
        protocolId: r.protocolId
      };
    });

  const rankApplications = db.rankApplications.filter((a) => a.athleteId === user.id);
  const certificates = db.certificates.filter((c) => c.athleteId === user.id);

  res.json({
    ...enrich(user),
    trainers,
    results,
    rankApplications,
    certificates,
    links
  });
});

router.post('/users', requireAuth, (req, res) => {
  if (activeRole(req) !== 'federation') return res.status(403).json({ error: 'Только федерация' });

  const b = req.body || {};
  if (!b.fio || !b.login) return res.status(400).json({ error: 'Нужны ФИО и логин' });

  const db = load();
  if (db.users.some((u) => u.login === b.login)) return res.status(400).json({ error: 'Логин занят' });

  const user = {
    id: nextId('u'),
    login: String(b.login).trim().toLowerCase(),
    passHash: bcrypt.hashSync(b.password || 'demo123', 8),
    fio: b.fio,
    birthDate: b.birthDate || '2000-01-01',
    gender: b.gender === 'f' ? 'f' : 'm',
    municipality: b.municipality || '',
    organizationId: b.organizationId || null,
    disciplines: b.disciplines || [],
    startYear: b.startYear || new Date().getFullYear(),
    roles: Array.isArray(b.roles) && b.roles.length ? b.roles : ['athlete'],
    activeRole: (b.roles && b.roles[0]) || 'athlete',
    phone: b.phone || '',
    email: b.email || '',
    status: 'active',
    disqualifiedUntil: null,
    consent: b.consent || { pdp: true, date: iso(), guardianFio: null, guardianConsent: false },
    rusada: b.rusada || { passed: false, date: null, certUrl: null },
    rank: b.rank || null,
    judgeCategory: b.judgeCategory || null,
    createdAt: iso()
  };

  db.users.push(user);
  save();
  res.json(enrich(user));
});

router.put('/users/:id', requireAuth, (req, res) => {
  const db = load();
  const user = db.users.find((u) => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

  const role = activeRole(req);
  const me = currentUser(req);
  const isSelf = me.id === user.id;

  if (role !== 'federation' && !isSelf) {
    return res.status(403).json({ error: 'Можно редактировать только свой профиль' });
  }

  const b = req.body || {};
  const allowedForFederation = ['fio', 'birthDate', 'gender', 'municipality', 'organizationId',
    'disciplines', 'startYear', 'roles', 'phone', 'email', 'status', 'disqualifiedUntil',
    'rank', 'judgeCategory', 'consent', 'rusada'];
  const allowedForSelf = ['fio', 'municipality', 'phone', 'email', 'disciplines', 'startYear', 'rusada'];

  const allowed = role === 'federation' ? allowedForFederation : allowedForSelf;
  for (const key of allowed) {
    if (b[key] !== undefined) user[key] = b[key];
  }

  if (role === 'federation' && Array.isArray(b.roles) && b.roles.length) {
    user.roles = b.roles;
    if (!user.roles.includes(user.activeRole)) user.activeRole = user.roles[0];
  }

  save();
  res.json(enrich(user));
});

router.get('/organizations', requireAuth, (req, res) => {
  const db = load();
  const list = db.organizations.map((o) => ({
    ...o,
    athletesCount: db.users.filter((u) => u.organizationId === o.id && u.roles.includes('athlete')).length
  }));
  res.json(list);
});

router.post('/organizations', requireAuth, (req, res) => {
  if (activeRole(req) !== 'federation') return res.status(403).json({ error: 'Только федерация' });
  const b = req.body || {};
  if (!b.name) return res.status(400).json({ error: 'Укажите название' });

  const db = load();
  const org = {
    id: nextId('org'),
    name: b.name,
    type: b.type || 'клуб',
    license: b.license || '',
    municipality: b.municipality || '',
    programs: b.programs || []
  };
  db.organizations.push(org);
  save();
  res.json(org);
});

router.put('/organizations/:id', requireAuth, (req, res) => {
  if (activeRole(req) !== 'federation') return res.status(403).json({ error: 'Только федерация' });
  const db = load();
  const org = db.organizations.find((o) => o.id === req.params.id);
  if (!org) return res.status(404).json({ error: 'Организация не найдена' });

  const b = req.body || {};
  for (const key of ['name', 'type', 'license', 'municipality', 'programs']) {
    if (b[key] !== undefined) org[key] = b[key];
  }
  save();
  res.json(org);
});

module.exports = router;

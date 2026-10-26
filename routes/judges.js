// Судьи: реестр, назначения, судейские категории.
const express = require('express');
const { load, save, nextId } = require('../db');
const { requireAuth, currentUser, activeRole } = require('../auth');
const { iso, daysLeft, notify } = require('../utils');

const router = express.Router();

router.get('/judges', requireAuth, (req, res) => {
  const role = activeRole(req);
  if (!['federation', 'ministry'].includes(role)) return res.status(403).json({ error: 'Нет доступа' });

  const db = load();
  const list = db.users
    .filter((u) => u.roles.includes('judge'))
    .map((u) => ({
      id: u.id,
      fio: u.fio,
      municipality: u.municipality,
      category: u.judgeCategory ? u.judgeCategory.title : '—',
      validUntil: u.judgeCategory ? u.judgeCategory.validUntil : null,
      daysLeft: u.judgeCategory ? daysLeft(u.judgeCategory.validUntil) : null,
      assignments: db.judgeAssignments.filter((a) => a.judgeId === u.id).length,
      competitions: db.judgeAssignments.filter((a) => {
        if (a.judgeId !== u.id) return false;
        const c = db.competitions.find((x) => x.id === a.competitionId);
        return c && c.status === 'finished';
      }).length
    }))
    .sort((a, b) => a.fio.localeCompare(b.fio));

  res.json(list);
});

router.get('/judges/assignments', requireAuth, (req, res) => {
  const db = load();
  let list = db.judgeAssignments.slice();
  if (req.query.competitionId) list = list.filter((a) => a.competitionId === req.query.competitionId);
  if (req.query.judgeId) list = list.filter((a) => a.judgeId === req.query.judgeId);

  res.json(list.map((a) => {
    const c = db.competitions.find((x) => x.id === a.competitionId);
    const j = db.users.find((x) => x.id === a.judgeId);
    return {
      ...a,
      competitionTitle: c ? c.title : '—',
      competitionDate: c ? c.startDate : '',
      competitionStatus: c ? c.status : '',
      judgeFio: j ? j.fio : '—'
    };
  }));
});

router.post('/judges/assignments', requireAuth, (req, res) => {
  if (activeRole(req) !== 'federation') return res.status(403).json({ error: 'Только федерация' });
  const b = req.body || {};

  const db = load();
  const comp = db.competitions.find((c) => c.id === b.competitionId);
  const judge = db.users.find((u) => u.id === b.judgeId);
  if (!comp) return res.status(404).json({ error: 'Соревнование не найдено' });
  if (!judge || !judge.roles.includes('judge')) return res.status(400).json({ error: 'Судья не найден' });

  const exists = db.judgeAssignments.find((a) => a.competitionId === comp.id && a.judgeId === judge.id);
  if (exists) return res.status(400).json({ error: 'Судья уже назначен на это соревнование' });

  const assignment = {
    id: nextId('ja'),
    competitionId: comp.id,
    judgeId: judge.id,
    position: b.position || 'судья'
  };
  db.judgeAssignments.push(assignment);

  notify(judge.id, 'Назначение на соревнование',
    'Вы назначены на «' + comp.title + '» в должности «' + assignment.position + '».', '#/assignments');

  save();
  res.json(assignment);
});

router.delete('/judges/assignments/:id', requireAuth, (req, res) => {
  if (activeRole(req) !== 'federation') return res.status(403).json({ error: 'Только федерация' });
  const db = load();
  const before = db.judgeAssignments.length;
  db.judgeAssignments = db.judgeAssignments.filter((a) => a.id !== req.params.id);
  if (db.judgeAssignments.length === before) return res.status(404).json({ error: 'Назначение не найдено' });
  save();
  res.json({ ok: true });
});

router.get('/judges/category-applications', requireAuth, (req, res) => {
  const db = load();
  const user = currentUser(req);
  const role = activeRole(req);

  let list = db.judgeCategoryApplications.slice();
  if (role === 'judge') list = list.filter((a) => a.judgeId === user.id);
  else if (!['federation', 'ministry'].includes(role)) return res.status(403).json({ error: 'Нет доступа' });

  res.json(list.map((a) => {
    const j = db.users.find((u) => u.id === a.judgeId);
    return {
      ...a,
      fio: j ? j.fio : '—',
      currentCategory: j && j.judgeCategory ? j.judgeCategory.title : '—',
      currentValidUntil: j && j.judgeCategory ? j.judgeCategory.validUntil : null,
      daysLeft: a.validUntil ? daysLeft(a.validUntil) : null
    };
  }));
});

router.post('/judges/category-applications', requireAuth, (req, res) => {
  if (activeRole(req) !== 'judge') return res.status(403).json({ error: 'Только судья' });
  const b = req.body || {};
  if (!b.requestedCategory) return res.status(400).json({ error: 'Укажите категорию' });

  const db = load();
  const user = currentUser(req);
  const pending = db.judgeCategoryApplications.find((a) => a.judgeId === user.id && a.status === 'pending');
  if (pending) return res.status(400).json({ error: 'Заявка уже на рассмотрении' });

  const app = {
    id: nextId('jca'),
    judgeId: user.id,
    requestedCategory: b.requestedCategory,
    status: 'pending',
    comment: null,
    createdAt: iso(),
    decidedAt: null,
    validUntil: null
  };
  db.judgeCategoryApplications.push(app);

  for (const fed of db.users.filter((u) => u.roles.includes('federation'))) {
    notify(fed.id, 'Заявка на судейскую категорию', user.fio + ' — ' + b.requestedCategory + '.', '#/judges');
  }

  save();
  res.json(app);
});

router.post('/judges/category-applications/:id/approve', requireAuth, (req, res) => {
  const db = load();
  if (activeRole(req) !== 'federation') return res.status(403).json({ error: 'Только федерация' });

  const app = db.judgeCategoryApplications.find((a) => a.id === req.params.id);
  if (!app) return res.status(404).json({ error: 'Заявка не найдена' });
  if (app.status !== 'pending') return res.status(400).json({ error: 'Заявка уже рассмотрена' });

  const years = db.settings.judgeCategoryValidityYears || 4;
  const b = req.body || {};
  const validUntil = b.validUntil || (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + years);
    return iso(d);
  })();

  app.status = 'approved';
  app.decidedAt = iso();
  app.validUntil = validUntil;

  const judge = db.users.find((u) => u.id === app.judgeId);
  if (judge) judge.judgeCategory = { title: app.requestedCategory, validUntil };

  notify(app.judgeId, 'Категория присвоена',
    'Присвоена судейская категория «' + app.requestedCategory + '».', '#/judge-category');

  save();
  res.json(app);
});

router.post('/judges/category-applications/:id/reject', requireAuth, (req, res) => {
  const db = load();
  if (activeRole(req) !== 'federation') return res.status(403).json({ error: 'Только федерация' });

  const app = db.judgeCategoryApplications.find((a) => a.id === req.params.id);
  if (!app) return res.status(404).json({ error: 'Заявка не найдена' });
  if (app.status !== 'pending') return res.status(400).json({ error: 'Заявка уже рассмотрена' });

  app.status = 'rejected';
  app.decidedAt = iso();
  app.comment = (req.body || {}).comment || 'Без комментария';

  notify(app.judgeId, 'Заявка на категорию отклонена', app.comment, '#/judge-category');

  save();
  res.json(app);
});

module.exports = router;

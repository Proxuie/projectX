// Календарь соревнований, результаты, протоколы.
const express = require('express');
const { load, save, nextId } = require('../db');
const { requireAuth, requireRole, currentUser, activeRole } = require('../auth');
const { wrap, iso, ageAt, daysLeft, levelName, typeName, orgName, notify } = require('../utils');

const router = express.Router();

const STATUSES = ['draft', 'published', 'registration', 'closed', 'finished'];

function esc(s) {
  return String(s === undefined || s === null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function brief(c) {
  const db = load();
  const apps = db.applications.filter((a) => a.competitionId === c.id);
  const disc = db.dictionaries.disciplines.find((d) => d.code === c.discipline);
  return {
    ...c,
    disciplineName: disc ? disc.name : c.discipline,
    levelName: levelName(c.level),
    typeName: typeName(c.typeId),
    applicationsCount: apps.length,
    approvedCount: apps.filter((a) => a.status === 'approved').length,
    daysLeft: daysLeft(c.startDate),
    protocol: (() => {
      const p = db.protocols.find((x) => x.competitionId === c.id);
      return p ? { id: p.id, status: p.status } : null;
    })()
  };
}

router.get('/competitions', requireAuth, (req, res) => {
  const db = load();
  let list = db.competitions.slice();

  if (req.query.discipline) list = list.filter((c) => c.discipline === req.query.discipline);
  if (req.query.status) list = list.filter((c) => c.status === req.query.status);
  if (req.query.level) list = list.filter((c) => c.level === req.query.level);
  if (req.query.year) list = list.filter((c) => String(c.startDate).slice(0, 4) === String(req.query.year));
  if (req.query.q) {
    const q = String(req.query.q).toLowerCase();
    list = list.filter((c) => c.title.toLowerCase().includes(q));
  }

  const role = activeRole(req);
  if (role === 'athlete' || role === 'trainer') {
    list = list.filter((c) => c.status !== 'draft');
  }

  list.sort((a, b) => b.startDate.localeCompare(a.startDate));
  res.json(list.map(brief));
});

router.post('/competitions', requireRole('federation'), (req, res) => {
  const b = req.body || {};
  if (!b.title || !b.discipline || !b.startDate) {
    return res.status(400).json({ error: 'Нужны название, дисциплина и дата начала' });
  }
  if (!STATUSES.includes(b.status || 'draft')) {
    return res.status(400).json({ error: 'Неизвестный статус' });
  }

  const db = load();
  let deadline = b.applicationDeadline;
  if (!deadline) {
    const d = new Date(b.startDate);
    d.setDate(d.getDate() - 7);
    deadline = d.toISOString().slice(0, 10);
  }

  const comp = {
    id: nextId('c'),
    title: b.title,
    discipline: b.discipline,
    level: b.level || 'regional',
    typeId: b.typeId || 'ct_2',
    ageGroup: b.ageGroup || '14-17',
    gender: b.gender || 'any',
    startDate: b.startDate,
    endDate: b.endDate || b.startDate,
    place: b.place || '',
    format: b.format || 'offline',
    status: b.status || 'draft',
    regulationUrl: b.regulationUrl || null,
    calendarPlan: b.calendarPlan || null,
    calendarNumber: b.calendarNumber || null,
    applicationDeadline: deadline,
    createdBy: currentUser(req).id,
    createdAt: iso()
  };

  db.competitions.push(comp);
  save();
  res.json(brief(comp));
});

router.get('/competitions/:id', requireAuth, (req, res) => {
  const db = load();
  const comp = db.competitions.find((c) => c.id === req.params.id);
  if (!comp) return res.status(404).json({ error: 'Соревнование не найдено' });

  const user = currentUser(req);
  const apps = db.applications.filter((a) => a.competitionId === comp.id);
  const myApp = apps.find((a) => a.athleteId === user.id);
  const protocol = db.protocols.find((p) => p.competitionId === comp.id);
  const judges = db.judgeAssignments
    .filter((a) => a.competitionId === comp.id)
    .map((a) => {
      const j = db.users.find((u) => u.id === a.judgeId);
      return { id: a.id, judgeId: a.judgeId, position: a.position, fio: j ? j.fio : '—' };
    });

  const group = db.dictionaries.ageGroups.find((g) => g.code === comp.ageGroup);
  const fitsAge = group
    ? (() => { const a = ageAt(user.birthDate, comp.startDate); return a >= group.from && a <= group.to; })()
    : true;

  res.json({
    ...brief(comp),
    myApplication: myApp || null,
    fitsAge,
    judges,
    protocolId: protocol ? protocol.id : null,
    protocolStatus: protocol ? protocol.status : null
  });
});

router.put('/competitions/:id', requireRole('federation'), (req, res) => {
  const db = load();
  const comp = db.competitions.find((c) => c.id === req.params.id);
  if (!comp) return res.status(404).json({ error: 'Соревнование не найдено' });

  const b = req.body || {};
  const fields = ['title', 'discipline', 'level', 'typeId', 'ageGroup', 'gender', 'startDate',
    'endDate', 'place', 'format', 'regulationUrl', 'calendarPlan', 'calendarNumber', 'applicationDeadline'];
  for (const key of fields) {
    if (b[key] !== undefined) comp[key] = b[key];
  }

  save();
  res.json(brief(comp));
});

router.post('/competitions/:id/status', requireRole('federation'), (req, res) => {
  const db = load();
  const comp = db.competitions.find((c) => c.id === req.params.id);
  if (!comp) return res.status(404).json({ error: 'Соревнование не найдено' });

  const status = String((req.body || {}).status || '');
  if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Неизвестный статус' });

  comp.status = status;
  if (status === 'registration') {
    const athletes = db.users.filter((u) => u.roles.includes('athlete'));
    for (const a of athletes) {
      if (a.disciplines.includes(comp.discipline)) {
        notify(a.id, 'Открыта регистрация', 'Соревнование «' + comp.title + '» принимает заявки.', '#/calendar');
      }
    }
  }

  save();
  res.json(brief(comp));
});

// Публикация положения: простая HTML-страница по данным соревнования.
router.get('/competitions/:id/regulation', (req, res) => {
  const db = load();
  const comp = db.competitions.find((c) => c.id === req.params.id);
  if (!comp) return res.status(404).send('Соревнование не найдено');

  const disc = db.dictionaries.disciplines.find((d) => d.code === comp.discipline);
  const html = '<!doctype html><html lang="ru"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>Положение — ' + esc(comp.title) + '</title>' +
    '<style>body{font-family:Georgia,serif;max-width:760px;margin:32px auto;padding:0 16px;line-height:1.6;color:#1b1c21}' +
    'h1{font-size:22px;line-height:1.3}h2{font-size:16px;margin-top:24px}ul{padding-left:20px}' +
    '.muted{color:#666}.sign{margin-top:40px}</style></head><body>' +
    '<p class="muted">Региональное отделение ФСП Оренбургской области</p>' +
    '<h1>' + esc(comp.title) + '</h1>' +
    '<h2>Общие сведения</h2><ul>' +
    '<li>Дисциплина: ' + esc(disc ? disc.name : comp.discipline) + '</li>' +
    '<li>Уровень: ' + esc(levelName(comp.level)) + '</li>' +
    '<li>Тип: ' + esc(typeName(comp.typeId)) + '</li>' +
    '<li>Возрастная группа: ' + esc(comp.ageGroup) + '</li>' +
    '<li>Даты проведения: ' + esc(comp.startDate) + (comp.endDate !== comp.startDate ? ' — ' + esc(comp.endDate) : '') + '</li>' +
    '<li>Место: ' + esc(comp.place) + '</li>' +
    '<li>Формат: ' + esc(comp.format === 'online' ? 'онлайн' : comp.format === 'mixed' ? 'смешанный' : 'очно') + '</li>' +
    '<li>Приём заявок до: ' + esc(comp.applicationDeadline) + '</li>' +
    '</ul>' +
    '<h2>Порядок проведения</h2><p>Соревнование проводится в соответствии с правилами вида спорта «спортивное программирование». ' +
    'Участники подают заявки через платформу ФСП Оренбургской области. Состав участников утверждается федерацией.</p>' +
    '<h2>Определение результатов</h2><p>Результаты вносятся федерацией по итогам выступления. ' +
    'Протокол формируется автоматически и публикуется на платформе.</p>' +
    '<p class="sign">Главный судья ______________________</p>' +
    '</body></html>';

  res.type('html').send(html);
});

router.get('/competitions/:id/applications', requireAuth, (req, res) => {
  const db = load();
  const list = db.applications
    .filter((a) => a.competitionId === req.params.id)
    .map((a) => {
      const u = db.users.find((x) => x.id === a.athleteId);
      const sub = db.users.find((x) => x.id === a.submittedBy);
      return {
        ...a,
        fio: u ? u.fio : '—',
        birthDate: u ? u.birthDate : '',
        age: u ? ageAt(u.birthDate) : null,
        organizationName: u ? orgName(u.organizationId) : '—',
        submittedByName: sub ? sub.fio : '—'
      };
    });
  res.json(list);
});

router.get('/competitions/:id/results', requireAuth, (req, res) => {
  const db = load();
  const list = db.results
    .filter((r) => r.competitionId === req.params.id)
    .map((r) => {
      const u = db.users.find((x) => x.id === r.athleteId);
      return { ...r, fio: u ? u.fio : '—', organizationName: u ? orgName(u.organizationId) : '—' };
    });
  list.sort((a, b) => (a.place || 99) - (b.place || 99));
  res.json(list);
});

router.post('/competitions/:id/results', requireRole('federation'), (req, res) => {
  const db = load();
  const comp = db.competitions.find((c) => c.id === req.params.id);
  if (!comp) return res.status(404).json({ error: 'Соревнование не найдено' });

  const rows = Array.isArray((req.body || {}).rows) ? req.body.rows : [];
  const table = db.settings.ratingPoints[comp.level] || [];

  for (const row of rows) {
    if (!row.athleteId) continue;
    const place = Number(row.place) || null;
    const points = row.points !== undefined && row.points !== null && row.points !== ''
      ? Number(row.points)
      : (place && table[place - 1]) || 0;

    let result = db.results.find((r) => r.competitionId === comp.id && r.athleteId === row.athleteId);
    if (!result) {
      result = {
        id: nextId('r'),
        competitionId: comp.id,
        athleteId: row.athleteId,
        place,
        points,
        protocolId: null
      };
      db.results.push(result);
    } else {
      result.place = place;
      result.points = points;
    }
  }

  save();
  res.json({ ok: true, count: rows.length });
});

router.post('/competitions/:id/protocol', requireRole('federation'), (req, res) => {
  const db = load();
  const comp = db.competitions.find((c) => c.id === req.params.id);
  if (!comp) return res.status(404).json({ error: 'Соревнование не найдено' });

  const approved = db.applications.filter((a) => a.competitionId === comp.id && a.status === 'approved');
  if (approved.length === 0) {
    return res.status(400).json({ error: 'Нет одобренных заявок — протокол формировать не из чего' });
  }

  const results = db.results.filter((r) => r.competitionId === comp.id);
  if (results.length === 0) {
    return res.status(400).json({ error: 'Сначала внесите результаты' });
  }

  const rows = approved.map((a) => {
    const u = db.users.find((x) => x.id === a.athleteId);
    const r = results.find((x) => x.athleteId === a.athleteId);
    return {
      athleteId: a.athleteId,
      fio: u ? u.fio : '—',
      organization: u ? orgName(u.organizationId) : '—',
      place: r ? r.place : null,
      points: r ? r.points : 0
    };
  });

  rows.sort((a, b) => {
    const pa = a.place === null ? 999 : a.place;
    const pb = b.place === null ? 999 : b.place;
    if (pa !== pb) return pa - pb;
    if (b.points !== a.points) return b.points - a.points;
    return a.fio.localeCompare(b.fio);
  });

  // Места по порядку, если федерация их не проставила
  rows.forEach((row, i) => {
    row.line = i + 1;
  });

  const old = db.protocols.find((p) => p.competitionId === comp.id);
  if (old) {
    db.protocols = db.protocols.filter((p) => p.id !== old.id);
  }

  const protocol = {
    id: nextId('p'),
    competitionId: comp.id,
    status: 'draft',
    rows,
    createdAt: iso(),
    publishedAt: null
  };
  db.protocols.push(protocol);
  save();

  res.json({ id: protocol.id, status: protocol.status, rows: rows.length });
});

router.get('/protocols/:id', requireAuth, (req, res) => {
  const db = load();
  const protocol = db.protocols.find((p) => p.id === req.params.id);
  if (!protocol) return res.status(404).json({ error: 'Протокол не найден' });

  const comp = db.competitions.find((c) => c.id === protocol.competitionId);
  const judges = db.judgeAssignments
    .filter((a) => a.competitionId === protocol.competitionId)
    .map((a) => {
      const j = db.users.find((u) => u.id === a.judgeId);
      return { fio: j ? j.fio : '—', position: a.position };
    });

  res.json({
    ...protocol,
    competition: comp ? brief(comp) : null,
    judges
  });
});

router.post('/protocols/:id/publish', requireRole('federation'), (req, res) => {
  const db = load();
  const protocol = db.protocols.find((p) => p.id === req.params.id);
  if (!protocol) return res.status(404).json({ error: 'Протокол не найден' });

  protocol.status = 'published';
  protocol.publishedAt = iso();

  const comp = db.competitions.find((c) => c.id === protocol.competitionId);
  if (comp) comp.status = 'finished';

  for (const row of protocol.rows) {
    const result = db.results.find((r) => r.competitionId === protocol.competitionId && r.athleteId === row.athleteId);
    if (result) result.protocolId = protocol.id;
    notify(row.athleteId, 'Опубликован протокол',
      'Протокол соревнования «' + (comp ? comp.title : '') + '» опубликован. Ваше место: ' + row.place + '.',
      '#/my-results');
  }

  save();
  res.json({ ok: true });
});

router.get('/protocols/:id/docx', requireAuth, wrap(async (req, res) => {
  const db = load();
  const protocol = db.protocols.find((p) => p.id === req.params.id);
  if (!protocol) return res.status(404).json({ error: 'Протокол не найден' });

  const comp = db.competitions.find((c) => c.id === protocol.competitionId);
  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType } = require('docx');

  const rows = [
    new TableRow({
      tableHeader: true,
      children: ['№', 'ФИО', 'Организация', 'Место', 'Баллы'].map((text) => new TableCell({
        width: { size: text === 'ФИО' ? 40 : 15, type: WidthType.PERCENTAGE },
        children: [new Paragraph({ children: [new TextRun({ text, bold: true })] })]
      }))
    })
  ];

  for (const row of protocol.rows) {
    rows.push(new TableRow({
      children: [
        String(row.line),
        row.fio,
        row.organization,
        row.place === null ? '—' : String(row.place),
        String(row.points)
      ].map((text, i) => new TableCell({
        width: { size: i === 1 ? 40 : 15, type: WidthType.PERCENTAGE },
        children: [new Paragraph(String(text))]
      }))
    }));
  }

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'ПРОТОКОЛ', bold: true, size: 28 })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: comp ? comp.title : '', size: 24 })] }),
        new Paragraph({ text: '' }),
        new Paragraph({ children: [new TextRun({ text: 'Дата: ' + (comp ? comp.startDate : '') + '    Место: ' + (comp ? comp.place : '') })] }),
        new Paragraph({ text: '' }),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }),
        new Paragraph({ text: '' }),
        new Paragraph({ children: [new TextRun({ text: 'Главный судья ______________________' })] }),
        new Paragraph({ children: [new TextRun({ text: 'Секретарь ______________________' })] })
      ]
    }]
  });

  const buffer = await Packer.toBuffer(doc);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', 'attachment; filename="protocol-' + protocol.id + '.docx"');
  res.send(buffer);
}));

module.exports = router;

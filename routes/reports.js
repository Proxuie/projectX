// Отчёты, выгрузки, справки.
const express = require('express');
const ExcelJS = require('exceljs');
const QRCode = require('qrcode');
const { load, save, nextId } = require('../db');
const { requireAuth, currentUser, activeRole } = require('../auth');
const { wrap, iso, ageAt, orgName, ratingFor, pointsFor, levelName } = require('../utils');

const router = express.Router();

function styleHeader(ws) {
  const row = ws.getRow(1);
  row.font = { bold: true };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDEDED' } };
  row.commit();
}

function sendXlsx(res, wb, name) {
  return wb.xlsx.writeBuffer().then((buffer) => {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="' + name + '"');
    res.send(Buffer.from(buffer));
  });
}

// ---------- Численность занимающихся ----------

router.get('/reports/headcount.xlsx', requireAuth, wrap(async (req, res) => {
  if (!['federation', 'ministry'].includes(activeRole(req))) {
    return res.status(403).json({ error: 'Нет доступа' });
  }

  const db = load();
  const season = db.settings.season || new Date().getFullYear();
  let years = String(req.query.years || '').split(',').map(Number).filter(Boolean);
  if (years.length === 0) years = [season - 2, season - 1, season];
  years.sort((a, b) => a - b);

  const athletes = db.users.filter((u) => u.roles.includes('athlete'));
  const byYear = years.map((y) => ({
    year: y,
    list: athletes.filter((a) => Number(a.startYear) <= y)
  }));

  const wb = new ExcelJS.Workbook();
  wb.creator = 'ФСП Оренбургской области';

  const ws = wb.addWorksheet('Сводка');
  ws.columns = [
    { header: 'Год', key: 'year', width: 10 },
    { header: 'Занимающихся', key: 'total', width: 18 }
  ];
  for (const row of byYear) ws.addRow({ year: row.year, total: row.list.length });
  styleHeader(ws);

  const wsOrg = wb.addWorksheet('Организации');
  wsOrg.columns = [
    { header: 'Год', width: 10 },
    { header: 'Организация', width: 55 },
    { header: 'Количество', width: 14 }
  ];
  for (const row of byYear) {
    for (const org of db.organizations) {
      wsOrg.addRow([row.year, org.name, row.list.filter((a) => a.organizationId === org.id).length]);
    }
  }
  styleHeader(wsOrg);

  const wsDisc = wb.addWorksheet('Дисциплины');
  wsDisc.columns = [
    { header: 'Год', width: 10 },
    { header: 'Дисциплина', width: 55 },
    { header: 'Количество', width: 14 }
  ];
  for (const row of byYear) {
    for (const disc of db.dictionaries.disciplines) {
      wsDisc.addRow([row.year, disc.name, row.list.filter((a) => a.disciplines.includes(disc.code)).length]);
    }
  }
  styleHeader(wsDisc);

  const wsAge = wb.addWorksheet('Возрастные группы');
  wsAge.columns = [
    { header: 'Год', width: 10 },
    { header: 'Возрастная группа', width: 24 },
    { header: 'Количество', width: 14 }
  ];
  for (const row of byYear) {
    for (const group of db.dictionaries.ageGroups) {
      const count = row.list.filter((a) => {
        const age = ageAt(a.birthDate, row.year + '-12-31');
        return age >= group.from && age <= group.to;
      }).length;
      wsAge.addRow([row.year, group.code, count]);
    }
  }
  styleHeader(wsAge);

  const wsMun = wb.addWorksheet('Муниципалитеты');
  wsMun.columns = [
    { header: 'Год', width: 10 },
    { header: 'Муниципалитет', width: 30 },
    { header: 'Количество', width: 14 }
  ];
  const municipalities = [...new Set(athletes.map((a) => a.municipality).filter(Boolean))].sort();
  for (const row of byYear) {
    for (const m of municipalities) {
      wsMun.addRow([row.year, m, row.list.filter((a) => a.municipality === m).length]);
    }
  }
  styleHeader(wsMun);

  ws.addRow([]);
  ws.addRow(['Отчёт сформирован: ' + iso()]);

  await sendXlsx(res, wb, 'headcount.xlsx');
}));

// ---------- Реестр спортсменов ----------

router.get('/reports/registry.xlsx', requireAuth, wrap(async (req, res) => {
  if (!['federation', 'ministry'].includes(activeRole(req))) {
    return res.status(403).json({ error: 'Нет доступа' });
  }

  const db = load();
  const athletes = db.users.filter((u) => u.roles.includes('athlete'));

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Реестр спортсменов');
  ws.columns = [
    { header: 'ФИО', width: 38 },
    { header: 'Дата рождения', width: 15 },
    { header: 'Возраст', width: 10 },
    { header: 'Муниципалитет', width: 22 },
    { header: 'Организация', width: 45 },
    { header: 'Дисциплины', width: 40 },
    { header: 'Год начала', width: 12 },
    { header: 'Разряд', width: 18 },
    { header: 'Действует до', width: 15 }
  ];

  for (const a of athletes) {
    const discs = a.disciplines.map((code) => {
      const d = db.dictionaries.disciplines.find((x) => x.code === code);
      return d ? d.name : code;
    }).join('; ');
    ws.addRow([
      a.fio,
      a.birthDate,
      ageAt(a.birthDate),
      a.municipality,
      orgName(a.organizationId),
      discs,
      a.startYear,
      a.rank ? a.rank.title : '—',
      a.rank ? a.rank.validUntil : '—'
    ]);
  }
  styleHeader(ws);

  await sendXlsx(res, wb, 'registry.xlsx');
}));

// ---------- Рейтинг ----------

router.get('/reports/rating.xlsx', requireAuth, wrap(async (req, res) => {
  if (!['federation', 'ministry'].includes(activeRole(req))) {
    return res.status(403).json({ error: 'Нет доступа' });
  }

  const db = load();
  const discipline = String(req.query.discipline || 'algo');
  const rows = ratingFor(discipline, req.query.ageGroup || null, req.query.minRank || null);
  const disc = db.dictionaries.disciplines.find((d) => d.code === discipline);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Рейтинг');
  ws.columns = [
    { header: 'Место', width: 9 },
    { header: 'ФИО', width: 38 },
    { header: 'Организация', width: 45 },
    { header: 'Возраст', width: 10 },
    { header: 'Разряд', width: 18 },
    { header: 'Сумма баллов', width: 14 },
    { header: 'Призовых', width: 10 },
    { header: 'Коэффициент', width: 12 },
    { header: 'Итог', width: 10 }
  ];

  rows.forEach((r, i) => {
    ws.addRow([i + 1, r.fio, r.organization, r.age, r.rank, r.sum, r.podiums, r.coeff, r.total]);
  });
  styleHeader(ws);

  ws.addRow([]);
  ws.addRow(['Дисциплина: ' + (disc ? disc.name : discipline) + ', сезон ' + db.settings.season]);

  await sendXlsx(res, wb, 'rating.xlsx');
}));

// ---------- Отчёт о соревнованиях спортсмена ----------

router.get('/reports/athlete/:id.docx', requireAuth, wrap(async (req, res) => {
  const db = load();
  const athlete = db.users.find((u) => u.id === req.params.id);
  if (!athlete) return res.status(404).json({ error: 'Спортсмен не найден' });

  const me = currentUser(req);
  if (activeRole(req) === 'athlete' && me.id !== athlete.id) {
    return res.status(403).json({ error: 'Можно скачать только свой отчёт' });
  }

  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType } = require('docx');

  const results = db.results
    .filter((r) => r.athleteId === athlete.id)
    .map((r) => {
      const c = db.competitions.find((x) => x.id === r.competitionId);
      return { ...r, competition: c };
    })
    .sort((a, b) => (a.competition ? a.competition.startDate : '').localeCompare(b.competition ? b.competition.startDate : ''));

  const rows = [
    new TableRow({
      tableHeader: true,
      children: ['№', 'Соревнование', 'Дата', 'Место', 'Баллы'].map((text) => new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text, bold: true })] })]
      }))
    })
  ];

  let total = 0;
  results.forEach((r, i) => {
    total += r.points || 0;
    rows.push(new TableRow({
      children: [
        String(i + 1),
        r.competition ? r.competition.title : '—',
        r.competition ? r.competition.startDate : '',
        String(r.place || '—'),
        String(r.points || 0)
      ].map((text) => new TableCell({ children: [new Paragraph(String(text))] }))
    }));
  });

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'ОТЧЁТ О СОРЕВНОВАНИЯХ', bold: true, size: 26 })] }),
        new Paragraph({ text: '' }),
        new Paragraph({ children: [new TextRun({ text: 'Спортсмен: ' + athlete.fio })] }),
        new Paragraph({ children: [new TextRun({ text: 'Дата рождения: ' + athlete.birthDate + '    Организация: ' + orgName(athlete.organizationId) })] }),
        new Paragraph({ children: [new TextRun({ text: 'Разряд: ' + (athlete.rank ? athlete.rank.title : '—') })] }),
        new Paragraph({ text: '' }),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }),
        new Paragraph({ text: '' }),
        new Paragraph({ children: [new TextRun({ text: 'Сумма баллов: ' + total })] }),
        new Paragraph({ text: '' }),
        new Paragraph({ children: [new TextRun({ text: 'Сформировано платформой ФСП Оренбургской области, ' + iso() })] })
      ]
    }]
  });

  const buffer = await Packer.toBuffer(doc);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', 'attachment; filename="athlete-report.docx"');
  res.send(buffer);
}));

// ---------- Справка о составе судейской коллегии ----------

router.get('/reports/judges/:competitionId.docx', requireAuth, wrap(async (req, res) => {
  const db = load();
  const comp = db.competitions.find((c) => c.id === req.params.competitionId);
  if (!comp) return res.status(404).json({ error: 'Соревнование не найдено' });

  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType } = require('docx');

  const list = db.judgeAssignments
    .filter((a) => a.competitionId === comp.id)
    .map((a) => {
      const j = db.users.find((u) => u.id === a.judgeId);
      return { fio: j ? j.fio : '—', position: a.position };
    });

  const rows = [
    new TableRow({
      tableHeader: true,
      children: ['№', 'ФИО', 'Должность'].map((text) => new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text, bold: true })] })]
      }))
    })
  ];

  list.forEach((j, i) => {
    rows.push(new TableRow({
      children: [String(i + 1), j.fio, j.position].map((text) => new TableCell({ children: [new Paragraph(String(text))] }))
    }));
  });

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'СПРАВКА', bold: true, size: 26 })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'о составе судейской коллегии', size: 22 })] }),
        new Paragraph({ text: '' }),
        new Paragraph({ children: [new TextRun({ text: 'Соревнование: ' + comp.title })] }),
        new Paragraph({ children: [new TextRun({ text: 'Дата: ' + comp.startDate })] }),
        new Paragraph({ text: '' }),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }),
        new Paragraph({ text: '' }),
        new Paragraph({ children: [new TextRun({ text: 'Главный судья ______________________' })] })
      ]
    }]
  });

  const buffer = await Packer.toBuffer(doc);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', 'attachment; filename="judges-panel.docx"');
  res.send(buffer);
}));

// ---------- Отчёт о соревнованиях судьи ----------

router.get('/reports/judge/:id.docx', requireAuth, wrap(async (req, res) => {
  const db = load();
  const judge = db.users.find((u) => u.id === req.params.id);
  if (!judge) return res.status(404).json({ error: 'Судья не найден' });

  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType } = require('docx');

  const list = db.judgeAssignments
    .filter((a) => a.judgeId === judge.id)
    .map((a) => {
      const c = db.competitions.find((x) => x.id === a.competitionId);
      return { title: c ? c.title : '—', date: c ? c.startDate : '', position: a.position };
    });

  const rows = [
    new TableRow({
      tableHeader: true,
      children: ['№', 'Соревнование', 'Дата', 'Должность'].map((text) => new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text, bold: true })] })]
      }))
    })
  ];

  list.forEach((j, i) => {
    rows.push(new TableRow({
      children: [String(i + 1), j.title, j.date, j.position].map((text) => new TableCell({ children: [new Paragraph(String(text))] }))
    }));
  });

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'ОТЧЁТ', bold: true, size: 26 })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'о соревнованиях, на которых работал судья', size: 22 })] }),
        new Paragraph({ text: '' }),
        new Paragraph({ children: [new TextRun({ text: 'Судья: ' + judge.fio })] }),
        new Paragraph({ children: [new TextRun({ text: 'Категория: ' + (judge.judgeCategory ? judge.judgeCategory.title : '—') })] }),
        new Paragraph({ text: '' }),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }),
        new Paragraph({ text: '' }),
        new Paragraph({ children: [new TextRun({ text: 'Сформировано платформой ФСП Оренбургской области, ' + iso() })] })
      ]
    }]
  });

  const buffer = await Packer.toBuffer(doc);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', 'attachment; filename="judge-report.docx"');
  res.send(buffer);
}));

// ---------- Справки об участии ----------

router.get('/certificates', requireAuth, (req, res) => {
  const db = load();
  const me = currentUser(req);
  const role = activeRole(req);

  let list = db.certificates.slice();
  if (role === 'athlete') list = list.filter((c) => c.athleteId === me.id);
  else if (!['federation', 'ministry'].includes(role)) {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  if (req.query.athleteId) list = list.filter((c) => c.athleteId === req.query.athleteId);

  res.json(list.map((c) => {
    const ath = db.users.find((u) => u.id === c.athleteId);
    const comp = db.competitions.find((x) => x.id === c.competitionId);
    return {
      ...c,
      fio: ath ? ath.fio : '—',
      competitionTitle: comp ? comp.title : '—',
      competitionDate: comp ? comp.startDate : ''
    };
  }));
});

router.post('/certificates', requireAuth, (req, res) => {
  const db = load();
  const me = currentUser(req);
  const role = activeRole(req);
  const b = req.body || {};

  const athleteId = role === 'athlete' ? me.id : b.athleteId;
  if (!athleteId) return res.status(400).json({ error: 'Не указан спортсмен' });
  if (role !== 'athlete' && role !== 'federation') {
    return res.status(403).json({ error: 'Нет доступа' });
  }

  const comp = db.competitions.find((c) => c.id === b.competitionId);
  if (!comp) return res.status(404).json({ error: 'Соревнование не найдено' });

  const protocol = db.protocols.find((p) => p.competitionId === comp.id && p.status === 'published');
  if (!protocol) return res.status(400).json({ error: 'Протокол соревнования ещё не опубликован' });

  const result = db.results.find((r) => r.competitionId === comp.id && r.athleteId === athleteId);
  if (!result) return res.status(400).json({ error: 'Нет результата в этом соревновании' });

  const exists = db.certificates.find((c) => c.athleteId === athleteId && c.competitionId === comp.id);
  if (exists) return res.json(exists);

  const year = new Date().getFullYear();
  const number = 'ФСП-' + year + '-' + String(db.certificates.length + 1).padStart(4, '0');
  const verifyCode = 'fsp-' + year + '-' + Math.random().toString(36).slice(2, 8);

  const cert = {
    id: nextId('cert'),
    number,
    athleteId,
    competitionId: comp.id,
    resultId: result.id,
    verifyCode,
    createdAt: iso()
  };
  db.certificates.push(cert);
  save();
  res.json(cert);
});

router.get('/certificates/:id/qr', requireAuth, wrap(async (req, res) => {
  const db = load();
  const cert = db.certificates.find((c) => c.id === req.params.id);
  if (!cert) return res.status(404).json({ error: 'Справка не найдена' });

  const url = req.protocol + '://' + req.get('host') + '/#/verify/' + cert.verifyCode;
  const dataUrl = await QRCode.toDataURL(url, { width: 220, margin: 1, color: { dark: '#1B1C21', light: '#FFFFFF' } });
  res.json({ dataUrl, url });
}));

module.exports = router;

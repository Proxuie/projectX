// Рейтинг спортсменов и сборная региона.
const express = require('express');
const { load, save, nextId } = require('../db');
const { requireAuth, requireRole, currentUser } = require('../auth');
const { wrap, iso, ratingFor, levelName } = require('../utils');

const router = express.Router();

router.get('/rating', requireAuth, (req, res) => {
  const discipline = String(req.query.discipline || 'algo');
  const season = req.query.season ? Number(req.query.season) : null;
  const db = load();

  if (season && db.settings.season !== season) {
    // Для демо рейтинг считается за текущий сезон
  }

  const rows = ratingFor(discipline, req.query.ageGroup || null, req.query.minRank || null);
  res.json({
    season: db.settings.season,
    discipline,
    coeff: db.settings.stabilityCoeff,
    rows
  });
});

router.get('/teams', requireAuth, (req, res) => {
  const db = load();
  let list = db.teams.slice();
  if (req.query.season) list = list.filter((t) => String(t.season) === String(req.query.season));
  if (req.query.discipline) list = list.filter((t) => t.discipline === req.query.discipline);

  res.json(list.map((t) => ({
    ...t,
    athletes: t.athleteIds.map((id) => {
      const u = db.users.find((x) => x.id === id);
      return { id, fio: u ? u.fio : '—', rank: u && u.rank ? u.rank.title : '—' };
    })
  })));
});

router.post('/teams', requireRole('federation'), (req, res) => {
  const b = req.body || {};
  if (!b.discipline || !Array.isArray(b.athleteIds)) {
    return res.status(400).json({ error: 'Нужны дисциплина и состав' });
  }

  const db = load();
  const season = Number(b.season) || db.settings.season;

  const old = db.teams.find((t) => t.season === season && t.discipline === b.discipline && t.ageGroup === b.ageGroup);
  if (old) db.teams = db.teams.filter((t) => t.id !== old.id);

  const team = {
    id: nextId('team'),
    season,
    discipline: b.discipline,
    ageGroup: b.ageGroup || null,
    athleteIds: b.athleteIds,
    createdAt: iso(),
    createdBy: currentUser(req).id
  };
  db.teams.push(team);
  save();
  res.json(team);
});

router.get('/teams/:id/order.docx', requireAuth, wrap(async (req, res) => {
  const db = load();
  const team = db.teams.find((t) => t.id === req.params.id);
  if (!team) return res.status(404).json({ error: 'Сборная не найдена' });

  const disc = db.dictionaries.disciplines.find((d) => d.code === team.discipline);
  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType } = require('docx');

  const rows = [
    new TableRow({
      tableHeader: true,
      children: ['№', 'ФИО', 'Разряд'].map((text) => new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text, bold: true })] })]
      }))
    })
  ];

  team.athleteIds.forEach((id, i) => {
    const u = db.users.find((x) => x.id === id);
    rows.push(new TableRow({
      children: [
        String(i + 1),
        u ? u.fio : '—',
        u && u.rank ? u.rank.title : '—'
      ].map((text) => new TableCell({ children: [new Paragraph(String(text))] }))
    }));
  });

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'ПРИКАЗ', bold: true, size: 28 })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Об утверждении состава сборной Оренбургской области', size: 22 })] }),
        new Paragraph({ text: '' }),
        new Paragraph({ children: [new TextRun({ text: 'Сезон: ' + team.season + '    Дисциплина: ' + (disc ? disc.name : team.discipline) + '    Возрастная группа: ' + (team.ageGroup || '—') })] }),
        new Paragraph({ text: '' }),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }),
        new Paragraph({ text: '' }),
        new Paragraph({ children: [new TextRun({ text: 'Утвердить состав сборной в количестве ' + team.athleteIds.length + ' человек.' })] }),
        new Paragraph({ text: '' }),
        new Paragraph({ children: [new TextRun({ text: 'Президент федерации ______________________' })] })
      ]
    }]
  });

  const buffer = await Packer.toBuffer(doc);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', 'attachment; filename="team-' + team.id + '.docx"');
  res.send(buffer);
}));

module.exports = router;

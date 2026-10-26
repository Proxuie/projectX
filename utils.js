// Общие помощники: даты, возраст, уведомления, рейтинг.
const fs = require('fs');
const path = require('path');
const { load, save, nextId, DATA_DIR } = require('./db');

function wrap(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function iso(x) {
  const d = x || new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + dd;
}

function nowIso() {
  return new Date().toISOString().slice(0, 19);
}

function ageAt(birthDate, dateStr) {
  const b = new Date(birthDate);
  const d = dateStr ? new Date(dateStr) : new Date();
  let age = d.getFullYear() - b.getFullYear();
  const m = d.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && d.getDate() < b.getDate())) age--;
  return age;
}

function daysLeft(dateStr) {
  if (!dateStr) return null;
  const a = new Date(iso() + 'T00:00:00');
  const b = new Date(dateStr + 'T00:00:00');
  return Math.round((b - a) / 86400000);
}

function findUser(id) {
  return load().users.find((u) => u.id === id) || null;
}

function orgName(id) {
  const org = load().organizations.find((o) => o.id === id);
  return org ? org.name : '—';
}

function disciplineName(code) {
  const d = load().dictionaries.disciplines.find((x) => x.code === code);
  return d ? d.name : code;
}

function levelName(level) {
  const map = {
    champ_ru: 'Чемпионат России',
    perv_ru: 'Первенство России',
    interregional: 'Межрегиональные',
    regional: 'Региональные'
  };
  return map[level] || level;
}

function typeName(id) {
  const t = load().dictionaries.competitionTypes.find((x) => x.id === id);
  return t ? t.name : '—';
}

function pointsFor(level, place) {
  const table = load().settings.ratingPoints[level] || [];
  return table[place - 1] || 0;
}

// Уведомление в кабинет + письмо-заглушка во внешний канал.
function notify(userId, title, text, link) {
  const db = load();
  const user = db.users.find((u) => u.id === userId);
  const n = {
    id: nextId('n'),
    userId,
    title,
    text,
    link: link || null,
    read: false,
    createdAt: iso(),
    channel: 'email'
  };
  db.notifications.push(n);
  if (user) {
    const line = '[' + nowIso() + '] to: ' + user.email + ' | ' + title + ' | ' + text + '\n';
    try {
      fs.appendFileSync(path.join(DATA_DIR, 'mail.log'), line, 'utf8');
    } catch (e) {
      console.error('mail.log:', e.message);
    }
  }
  save();
  return n;
}

function rankIndex(title) {
  const ranks = load().dictionaries.ranks;
  const i = ranks.indexOf(title);
  return i < 0 ? -1 : i;
}

// Рейтинг за сезон по дисциплине.
function ratingFor(discipline, ageGroup, minRank) {
  const db = load();
  const season = db.settings.season || new Date().getFullYear();
  const coeff = db.settings.stabilityCoeff || 1.2;

  const result = [];
  const athletes = db.users.filter((u) => u.roles.includes('athlete'));

  for (const athlete of athletes) {
    if (athlete.status === 'disqualified') continue;

    const age = ageAt(athlete.birthDate);
    if (ageGroup) {
      const g = db.dictionaries.ageGroups.find((x) => x.code === ageGroup);
      if (g && (age < g.from || age > g.to)) continue;
    }
    if (minRank) {
      if (rankIndex(athlete.rank ? athlete.rank.title : '') < rankIndex(minRank)) continue;
    }

    const breakdown = [];
    let sum = 0;
    let podiums = 0;

    for (const comp of db.competitions) {
      if (comp.status !== 'finished') continue;
      if (comp.discipline !== discipline) continue;
      if (String(comp.startDate).slice(0, 4) !== String(season)) continue;

      const protocol = db.protocols.find((p) => p.competitionId === comp.id && p.status === 'published');
      if (!protocol) continue;

      const row = protocol.rows.find((r) => r.athleteId === athlete.id);
      if (!row) continue;

      const points = row.points || 0;
      sum += points;
      if (row.place >= 1 && row.place <= 3) podiums++;
      breakdown.push({
        competitionId: comp.id,
        title: comp.title,
        level: comp.level,
        levelName: levelName(comp.level),
        place: row.place,
        points
      });
    }

    if (breakdown.length === 0) continue;

    const withCoeff = podiums >= 2;
    const total = Math.round(sum * (withCoeff ? coeff : 1));

    result.push({
      athleteId: athlete.id,
      fio: athlete.fio,
      organization: orgName(athlete.organizationId),
      age,
      rank: athlete.rank ? athlete.rank.title : '—',
      sum,
      podiums,
      coeff: withCoeff ? coeff : 1,
      total,
      breakdown
    });
  }

  result.sort((a, b) => b.total - a.total || a.fio.localeCompare(b.fio));
  return result;
}

module.exports = {
  wrap,
  iso,
  nowIso,
  ageAt,
  daysLeft,
  findUser,
  orgName,
  disciplineName,
  levelName,
  typeName,
  pointsFor,
  notify,
  rankIndex,
  ratingFor
};

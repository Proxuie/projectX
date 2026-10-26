// Дашборд: показатели, ближайшие события, «требует внимания», сроки.
const express = require('express');
const { load } = require('../db');
const { requireAuth, currentUser, activeRole } = require('../auth');
const { iso, daysLeft, ageAt, levelName, typeName } = require('../utils');

const router = express.Router();

function compBrief(c) {
  const db = load();
  const apps = db.applications.filter((a) => a.competitionId === c.id);
  const disc = db.dictionaries.disciplines.find((d) => d.code === c.discipline);
  return {
    id: c.id,
    title: c.title,
    discipline: c.discipline,
    disciplineName: disc ? disc.name : c.discipline,
    level: c.level,
    levelName: levelName(c.level),
    typeName: typeName(c.typeId),
    startDate: c.startDate,
    endDate: c.endDate,
    place: c.place,
    format: c.format,
    status: c.status,
    applicationDeadline: c.applicationDeadline,
    calendarPlan: c.calendarPlan,
    calendarNumber: c.calendarNumber,
    applicationsCount: apps.length,
    approvedCount: apps.filter((a) => a.status === 'approved').length,
    daysLeft: daysLeft(c.startDate)
  };
}

function fitsAge(user, competition) {
  const db = load();
  const group = db.dictionaries.ageGroups.find((g) => g.code === competition.ageGroup);
  if (!group) return true;
  const age = ageAt(user.birthDate, competition.startDate);
  return age >= group.from && age <= group.to;
}

function headcountChart() {
  const db = load();
  const athletes = db.users.filter((u) => u.roles.includes('athlete'));
  const year = new Date().getFullYear();
  const years = [year - 3, year - 2, year - 1, year];
  return years.map((y) => ({
    year: y,
    value: athletes.filter((a) => Number(a.startYear) <= y).length
  }));
}

function nextPremiyaDate() {
  const now = new Date();
  const year = now.getMonth() > 1 || (now.getMonth() === 1 && now.getDate() > 1)
    ? now.getFullYear() + 1
    : now.getFullYear();
  return year + '-02-01';
}

router.get('/dashboard', requireAuth, (req, res) => {
  const db = load();
  const user = currentUser(req);
  const role = activeRole(req);
  const today = iso();
  const unread = db.notifications.filter((n) => n.userId === user.id && !n.read).length;

  const allComps = db.competitions.filter((c) => c.status !== 'draft');
  const upcoming = allComps
    .filter((c) => c.startDate >= today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .slice(0, 5)
    .map(compBrief);

  const deadlines = [];
  for (const c of allComps) {
    if (c.status !== 'registration') continue;
    const left = daysLeft(c.applicationDeadline);
    if (left !== null && left >= 0 && left <= 14) {
      deadlines.push({
        date: c.applicationDeadline,
        title: 'Приём заявок: ' + c.title,
        daysLeft: left,
        link: '#/competitions/' + c.id
      });
    }
  }
  deadlines.push({
    date: nextPremiyaDate(),
    title: 'Ходатайства на премию Губернатора',
    daysLeft: daysLeft(nextPremiyaDate()),
    link: '#/reports'
  });

  const payload = { role, unread, upcoming, deadlines, kpis: [], attention: [], chart: [] };

  if (role === 'federation' || role === 'ministry') {
    const athletes = db.users.filter((u) => u.roles.includes('athlete'));
    const season = String(db.settings.season);
    const participants = new Set(
      db.applications
        .filter((a) => a.status === 'approved')
        .filter((a) => {
          const c = db.competitions.find((x) => x.id === a.competitionId);
          return c && String(c.startDate).slice(0, 4) === season;
        })
        .map((a) => a.athleteId)
    );

    payload.kpis = [
      { label: 'Занимающихся', value: athletes.length, hint: 'человек в реестре' },
      { label: 'Соревнований', value: db.competitions.length, hint: 'в календаре' },
      { label: 'Участников сезона', value: participants.size, hint: 'хотя бы одна заявка' },
      { label: 'Разрядов', value: athletes.filter((a) => a.rank).length, hint: 'действующих и истёкших' }
    ];

    const pendingApps = db.applications.filter((a) => a.status === 'pending').length;
    const pendingRanks = db.rankApplications.filter((a) => a.status === 'pending').length;
    const pendingCats = db.judgeCategoryApplications.filter((a) => a.status === 'pending').length;
    const expiringRanks = athletes.filter((a) => a.rank && daysLeft(a.rank.validUntil) !== null &&
      daysLeft(a.rank.validUntil) >= 0 && daysLeft(a.rank.validUntil) <= 30).length;
    const expiringCats = db.users.filter((u) => u.judgeCategory && daysLeft(u.judgeCategory.validUntil) !== null &&
      daysLeft(u.judgeCategory.validUntil) >= 0 && daysLeft(u.judgeCategory.validUntil) <= 30).length;

    payload.attention = [
      { label: 'Заявки на модерации', count: pendingApps, link: '#/applications' },
      { label: 'Заявки на разряд', count: pendingRanks, link: '#/ranks' },
      { label: 'Заявки на категорию', count: pendingCats, link: '#/judges' },
      { label: 'Истекают разряды (30 дней)', count: expiringRanks, link: '#/ranks' },
      { label: 'Истекают категории (30 дней)', count: expiringCats, link: '#/judges' }
    ];

    payload.chart = headcountChart();

    for (const a of athletes) {
      if (!a.rank) continue;
      const left = daysLeft(a.rank.validUntil);
      if (left !== null && left >= 0 && left <= 30) {
        deadlines.push({
          date: a.rank.validUntil,
          title: 'Истекает разряд: ' + a.fio,
          daysLeft: left,
          link: '#/ranks'
        });
      }
    }
  }

  if (role === 'athlete') {
    const myApps = db.applications.filter((a) => a.athleteId === user.id);
    const myResults = db.results.filter((r) => r.athleteId === user.id);
    const rankLeft = user.rank ? daysLeft(user.rank.validUntil) : null;

    payload.kpis = [
      { label: 'Мои заявки', value: myApps.length, hint: 'всего подано' },
      { label: 'Результатов', value: myResults.length, hint: 'в истории' },
      { label: 'Разряд', value: user.rank ? user.rank.title : 'нет', hint: rankLeft === null ? '' : (rankLeft >= 0 ? 'осталось дней: ' + rankLeft : 'истёк') },
      { label: 'Уведомления', value: unread, hint: 'непрочитанных' }
    ];

    if (rankLeft !== null && rankLeft >= 0 && rankLeft <= 30) {
      payload.attention.push({
        label: 'Истекает разряд через ' + rankLeft + ' дн.',
        count: 1,
        link: '#/my-rank'
      });
    }
    const rejected = myApps.filter((a) => a.status === 'rejected').length;
    if (rejected) payload.attention.push({ label: 'Отклонённые заявки', count: rejected, link: '#/my-applications' });

    payload.upcoming = upcoming.map((c) => {
      const comp = db.competitions.find((x) => x.id === c.id);
      const my = myApps.find((a) => a.competitionId === c.id);
      return { ...c, fitsAge: fitsAge(user, comp), applied: my ? my.status : null };
    });
  }

  if (role === 'trainer') {
    const links = db.trainerLinks.filter((l) => l.trainerId === user.id && l.status === 'active');
    const ids = links.map((l) => l.athleteId);
    const apps = db.applications.filter((a) => ids.includes(a.athleteId));
    const expiring = db.users.filter((u) => ids.includes(u.id) && u.rank &&
      daysLeft(u.rank.validUntil) !== null && daysLeft(u.rank.validUntil) >= 0 && daysLeft(u.rank.validUntil) <= 30);

    payload.kpis = [
      { label: 'Мои спортсмены', value: links.length, hint: 'активные привязки' },
      { label: 'Заявок подопечных', value: apps.length, hint: 'за всё время' },
      { label: 'Истекают разряды', value: expiring.length, hint: 'в ближайшие 30 дней' },
      { label: 'Уведомления', value: unread, hint: 'непрочитанных' }
    ];

    payload.attention = [
      { label: 'Заявки на модерации у подопечных', count: apps.filter((a) => a.status === 'pending').length, link: '#/trainer-applications' },
      { label: 'Разряды истекают', count: expiring.length, link: '#/trainer-ranks' }
    ];
  }

  if (role === 'judge') {
    const assignments = db.judgeAssignments.filter((a) => a.judgeId === user.id);
    const catLeft = user.judgeCategory ? daysLeft(user.judgeCategory.validUntil) : null;
    const myApp = db.judgeCategoryApplications.filter((a) => a.judgeId === user.id && a.status === 'pending');

    payload.kpis = [
      { label: 'Категория', value: user.judgeCategory ? user.judgeCategory.title : 'нет', hint: catLeft === null ? '' : (catLeft >= 0 ? 'осталось дней: ' + catLeft : 'истекла') },
      { label: 'Назначений', value: assignments.length, hint: 'за всё время' },
      { label: 'Соревнований', value: db.competitions.filter((c) => c.status === 'finished' && assignments.some((a) => a.competitionId === c.id)).length, hint: 'проведено' },
      { label: 'Уведомления', value: unread, hint: 'непрочитанных' }
    ];

    if (catLeft !== null && catLeft >= 0 && catLeft <= 30) {
      payload.attention.push({ label: 'Истекает категория через ' + catLeft + ' дн.', count: 1, link: '#/judge-category' });
    }
    if (myApp.length) payload.attention.push({ label: 'Заявка на категорию на рассмотрении', count: myApp.length, link: '#/judge-category' });

    const compIds = assignments.map((a) => a.competitionId);
    payload.upcoming = allComps
      .filter((c) => compIds.includes(c.id) && c.startDate >= today)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .map(compBrief);
  }

  deadlines.sort((a, b) => a.date.localeCompare(b.date));
  res.json(payload);
});

module.exports = router;

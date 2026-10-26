// Демонстрационные данные. Все ФИО и организации вымышлены.
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { emptyDb, save, DATA_DIR } = require('./db');

const db = emptyDb();
const counters = {};

function nid(prefix) {
  counters[prefix] = (counters[prefix] || 0) + 1;
  return prefix + '_' + counters[prefix];
}

const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);

function iso(x) {
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const dd = String(x.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + dd;
}

function d(offset) {
  const x = new Date(TODAY);
  x.setDate(x.getDate() + offset);
  return iso(x);
}

function addYears(dateStr, years) {
  const x = new Date(dateStr);
  x.setFullYear(x.getFullYear() + years);
  return iso(x);
}

function ageOf(birthDate) {
  const b = new Date(birthDate);
  let age = TODAY.getFullYear() - b.getFullYear();
  const m = TODAY.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && TODAY.getDate() < b.getDate())) age--;
  return age;
}

const PASS = bcrypt.hashSync('demo123', 8);

// ---------- справочники и настройки ----------

const DISCIPLINES = [
  { code: 'algo', name: 'Программирование алгоритмическое' },
  { code: 'product', name: 'Программирование продуктовое' },
  { code: 'security', name: 'Программирование систем информационной безопасности' },
  { code: 'ai', name: 'Программирование систем искусственного интеллекта' },
  { code: 'robotics', name: 'Программирование робототехники' },
  { code: 'uav', name: 'Программирование беспилотных авиационных систем' }
];

const AGE_GROUPS = [
  { code: '10-13', from: 10, to: 13 },
  { code: '14-17', from: 14, to: 17 },
  { code: '18-21', from: 18, to: 21 },
  { code: '22+', from: 22, to: 99 }
];

const RANKS = ['3 юношеский', '2 юношеский', '1 юношеский', '3 спортивный', '2 спортивный', '1 спортивный', 'КМС', 'МС'];
const JUDGE_CATEGORIES = ['3 категория', '2 категория', '1 категория', 'Всероссийская'];

const competitionTypes = [
  { id: 'ct_1', name: 'Чемпионат' },
  { id: 'ct_2', name: 'Первенство' },
  { id: 'ct_3', name: 'Кубок' },
  { id: 'ct_4', name: 'Кубок федерации' },
  { id: 'ct_5', name: 'Фестиваль' },
  { id: 'ct_6', name: 'Отборочные соревнования' }
];

db.dictionaries = {
  disciplines: DISCIPLINES,
  ageGroups: AGE_GROUPS,
  ranks: RANKS,
  judgeCategories: JUDGE_CATEGORIES,
  competitionTypes
};

const rankRules = [];
const levelRank = {
  regional: '3 спортивный',
  interregional: '2 спортивный',
  perv_ru: '1 спортивный',
  champ_ru: 'КМС'
};
for (const level of Object.keys(levelRank)) {
  rankRules.push({ level, minPlace: 1, maxPlace: 3, rank: levelRank[level] });
}

db.settings = {
  season: TODAY.getFullYear(),
  ratingPoints: {
    champ_ru: [100, 80, 60],
    perv_ru: [80, 60, 40],
    interregional: [60, 45, 30],
    regional: [40, 30, 20]
  },
  stabilityCoeff: 1.2,
  rankValidityYears: 2,
  judgeCategoryValidityYears: 4,
  rankRules,
  premiyaDeadline: '02-01'
};

// ---------- организации ----------

const organizations = [
  {
    id: nid('org'),
    name: 'МБОУ «Школа № 7»',
    type: 'школа',
    license: 'Л035-01234-56/00123456',
    municipality: 'г. Оренбург',
    programs: [{ stage: 'начальная подготовка', disciplines: ['algo', 'product'] }]
  },
  {
    id: nid('org'),
    name: 'ФГБОУ ВО «Оренбургский государственный университет»',
    type: 'вуз',
    license: 'Л035-01234-56/00987654',
    municipality: 'г. Оренбург',
    programs: [
      { stage: 'учебно-тренировочный этап', disciplines: ['algo', 'ai', 'security'] },
      { stage: 'совершенствование спортивного мастерства', disciplines: ['ai'] }
    ]
  },
  {
    id: nid('org'),
    name: 'СШОР «Олимп»',
    type: 'спортивная школа',
    license: 'Л035-01234-56/00555555',
    municipality: 'г. Орск',
    programs: [{ stage: 'начальная подготовка', disciplines: ['robotics', 'uav'] }]
  }
];
db.organizations = organizations;

// ---------- пользователи ----------

function createUser(opts) {
  const u = {
    id: nid('u'),
    login: opts.login,
    passHash: PASS,
    fio: opts.fio,
    birthDate: opts.birthDate,
    gender: opts.gender || 'm',
    municipality: opts.municipality || 'г. Оренбург',
    organizationId: opts.organizationId || null,
    disciplines: opts.disciplines || ['algo'],
    startYear: opts.startYear || 2021,
    roles: opts.roles,
    activeRole: opts.roles[0],
    phone: '+7 999 000-00-' + String(counters.u).padStart(2, '0'),
    email: opts.login + '@example.test',
    status: 'active',
    disqualifiedUntil: null,
    consent: opts.consent || { pdp: true, date: d(-200), guardianFio: null, guardianConsent: false },
    rusada: opts.rusada || { passed: false, date: null, certUrl: null },
    rank: opts.rank || null,
    judgeCategory: opts.judgeCategory || null,
    createdAt: d(-200)
  };
  db.users.push(u);
  return u;
}

const fed = createUser({
  login: 'federation',
  fio: 'Кузнецова Ольга Петровна',
  birthDate: '1984-02-17',
  gender: 'f',
  roles: ['federation'],
  disciplines: ['algo', 'product', 'security', 'ai', 'robotics', 'uav'],
  startYear: 2020
});
createUser({
  login: 'fed2',
  fio: 'Гаврилов Андрей Викторович',
  birthDate: '1979-11-02',
  roles: ['federation'],
  disciplines: ['algo', 'ai'],
  startYear: 2020
});
createUser({
  login: 'ministry',
  fio: 'Григорьев Павел Андреевич',
  birthDate: '1980-06-05',
  roles: ['ministry'],
  disciplines: ['algo'],
  startYear: 2020
});
const multi = createUser({
  login: 'multi',
  fio: 'Смирнов Артём Сергеевич',
  birthDate: '1999-04-21',
  roles: ['athlete', 'trainer', 'judge'],
  disciplines: ['algo', 'ai'],
  startYear: 2015,
  rank: { title: '1 спортивный', date: d(-300), orderNumber: '№ 12-р', validUntil: d(420) },
  judgeCategory: { title: '2 категория', validUntil: d(700) }
});

const trainer1 = createUser({
  login: 'trainer',
  fio: 'Петров Алексей Николаевич',
  birthDate: '1990-09-14',
  roles: ['trainer'],
  disciplines: ['algo', 'product'],
  startYear: 2016
});
const trainer2 = createUser({
  login: 'trainer2',
  fio: 'Николаева Мария Сергеевна',
  birthDate: '1993-03-08',
  gender: 'f',
  roles: ['trainer'],
  disciplines: ['security', 'ai'],
  startYear: 2017
});
const trainer3 = createUser({
  login: 'trainer3',
  fio: 'Орлов Виктор Павлович',
  birthDate: '1987-12-30',
  roles: ['trainer'],
  disciplines: ['robotics', 'uav'],
  startYear: 2015
});
const trainer4 = createUser({
  login: 'trainer4',
  fio: 'Белова Екатерина Игоревна',
  birthDate: '1995-07-19',
  gender: 'f',
  roles: ['trainer'],
  disciplines: ['algo', 'ai'],
  startYear: 2018
});
const trainer5 = createUser({
  login: 'trainer5',
  fio: 'Морозов Сергей Дмитриевич',
  birthDate: '1988-01-25',
  roles: ['trainer'],
  disciplines: ['product', 'security'],
  startYear: 2014
});
const trainer6 = createUser({
  login: 'trainer6',
  fio: 'Зайцева Ольга Викторовна',
  birthDate: '1992-05-11',
  gender: 'f',
  roles: ['trainer'],
  disciplines: ['robotics', 'uav'],
  startYear: 2016
});
const trainers = [trainer1, trainer2, trainer3, trainer4, trainer5, trainer6];

const judge1 = createUser({
  login: 'judge',
  fio: 'Соколов Дмитрий Игоревич',
  birthDate: '1986-08-03',
  roles: ['judge'],
  disciplines: ['algo', 'product'],
  startYear: 2014,
  judgeCategory: { title: '1 категория', validUntil: d(25) }
});
const judge2 = createUser({
  login: 'judge2',
  fio: 'Лебедева Анна Андреевна',
  birthDate: '1982-10-27',
  gender: 'f',
  roles: ['judge'],
  disciplines: ['algo', 'ai'],
  startYear: 2013,
  judgeCategory: { title: 'Всероссийская', validUntil: d(800) }
});
const judge3 = createUser({
  login: 'judge3',
  fio: 'Павлов Игорь Олегович',
  birthDate: '1991-01-16',
  roles: ['judge'],
  disciplines: ['security', 'robotics'],
  startYear: 2017,
  judgeCategory: { title: '2 категория', validUntil: d(500) }
});
const judge4 = createUser({
  login: 'judge4',
  fio: 'Никитина Дарья Павловна',
  birthDate: '1996-06-09',
  gender: 'f',
  roles: ['judge'],
  disciplines: ['uav', 'product'],
  startYear: 2019,
  judgeCategory: { title: '3 категория', validUntil: d(-10) }
});

// спортсмен для демо
const demoAthlete = createUser({
  login: 'athlete',
  fio: 'Иванов Иван Иванович',
  birthDate: '2010-03-12',
  organizationId: organizations[0].id,
  disciplines: ['algo', 'product'],
  startYear: 2021,
  roles: ['athlete'],
  rank: { title: '1 юношеский', date: d(-400), orderNumber: '№ 45-р', validUntil: d(20) },
  consent: { pdp: true, date: d(-380), guardianFio: 'Иванова Светлана Петровна', guardianConsent: true },
  rusada: { passed: true, date: d(-120), certUrl: 'https://rusada.ru/online-course/' }
});

// остальные спортсмены
const lastNames = [
  'Абрамов', 'Борисов', 'Виноградов', 'Гусев', 'Дмитриев', 'Ефимов', 'Жуков', 'Зимин',
  'Королёв', 'Лапшин', 'Медведев', 'Наумов', 'Осипов', 'Панкратов', 'Романов', 'Савельев',
  'Тихонов', 'Ульянов', 'Фомин', 'Харитонов', 'Царёв', 'Чернов', 'Шилов', 'Щукин'
];
const maleFirst = ['Данила', 'Матвей', 'Тимофей', 'Глеб', 'Лев', 'Савелий', 'Богдан', 'Марк', 'Платон', 'Владислав', 'Станислав', 'Фёдор'];
const femaleFirst = ['Анастасия', 'Екатерина', 'Юлия', 'Алина', 'Ксения', 'Валерия', 'Дарья', 'Полина', 'Марина', 'Софья'];
const maleMid = ['Андреевич', 'Викторович', 'Олегович', 'Ильич', 'Максимович', 'Романович'];
const femaleMid = ['Андреевна', 'Викторовна', 'Олеговна', 'Ильинична', 'Максимовна', 'Романовна'];

const municipalities = ['г. Оренбург', 'г. Орск', 'г. Бузулук', 'Оренбургский район'];

const athletes = [demoAthlete];

const birthYears = [
  2015, 2014, 2013, 2012, 2011, 2010, 2009, 2009, 2010, 2011, 2012, 2015, 2013,
  2014, 2008, 2007, 2006, 2005, 2008, 2007, 2006, 2005, 2004, 2003, 2004, 2002
];

for (let i = 0; i < birthYears.length; i++) {
  const female = i % 4 === 3;
  const fio = lastNames[i] + ' ' +
    (female ? femaleFirst[i % femaleFirst.length] : maleFirst[i % maleFirst.length]) + ' ' +
    (female ? femaleMid[i % femaleMid.length] : maleMid[i % maleMid.length]);

  const birthYear = birthYears[i];
  const birthDate = birthYear + '-' + String(1 + (i % 12)).padStart(2, '0') + '-' + String(1 + (i % 27)).padStart(2, '0');
  const age = ageOf(birthDate);

  const mainDisc = DISCIPLINES[i % 6].code;
  const disciplines = [mainDisc];
  if (i % 2 === 0) disciplines.push(DISCIPLINES[(i + 2) % 6].code);

  let rankTitle = '3 юношеский';
  if (age >= 18) rankTitle = i % 3 === 0 ? 'КМС' : '1 спортивный';
  else if (age >= 16) rankTitle = '1 юношеский';
  else if (age >= 14) rankTitle = '2 юношеский';

  const validUntil = i % 7 === 0 ? d(-5) : i % 5 === 0 ? d(15) : d(300);

  const athlete = createUser({
    login: 'athlete' + (i + 2),
    fio,
    birthDate,
    gender: female ? 'f' : 'm',
    municipality: municipalities[i % municipalities.length],
    organizationId: organizations[i % organizations.length].id,
    disciplines,
    startYear: Math.max(birthYear + 6, 2018 + (i % 8)),
    roles: ['athlete'],
    rank: { title: rankTitle, date: d(-500 + i * 10), orderNumber: '№ ' + (10 + i) + '-р', validUntil },
    consent: age < 18
      ? { pdp: true, date: d(-300), guardianFio: 'Законный представитель', guardianConsent: true }
      : { pdp: true, date: d(-300), guardianFio: null, guardianConsent: false },
    rusada: i % 2 === 0
      ? { passed: true, date: d(-90 - i), certUrl: 'https://rusada.ru/online-course/' }
      : { passed: false, date: null, certUrl: null }
  });
  athletes.push(athlete);
}

// привязки тренеров
for (let i = 0; i < athletes.length; i++) {
  if (i % 6 === 5) continue; // у некоторых тренера нет — подают заявку сами
  const a = athletes[i];
  const trainer = trainers.find((t) => t.disciplines.includes(a.disciplines[0])) || trainers[0];
  db.trainerLinks.push({
    id: nid('tl'),
    trainerId: trainer.id,
    athleteId: a.id,
    discipline: a.disciplines[0],
    status: 'active',
    history: [{ status: 'active', date: d(-300), by: trainer.id }]
  });
}

// ---------- соревнования ----------

function createCompetition(o) {
  const c = {
    id: nid('c'),
    title: o.title,
    discipline: o.discipline,
    level: o.level,
    typeId: o.typeId,
    ageGroup: o.ageGroup,
    gender: o.gender || 'any',
    startDate: o.startDate,
    endDate: o.endDate || o.startDate,
    place: o.place,
    format: o.format,
    status: o.status,
    regulationUrl: null,
    calendarPlan: o.calendarPlan || null,
    calendarNumber: o.calendarNumber || null,
    applicationDeadline: o.applicationDeadline,
    createdBy: fed.id,
    createdAt: d(-70)
  };
  db.competitions.push(c);
  return c;
}

const c1 = createCompetition({
  title: 'Первенство Оренбургской области по алгоритмическому программированию',
  discipline: 'algo',
  level: 'regional',
  typeId: 'ct_2',
  ageGroup: '14-17',
  startDate: d(-20),
  place: 'г. Оренбург, ул. Советская, 20',
  format: 'offline',
  status: 'finished',
  applicationDeadline: d(-30),
  calendarPlan: 'regional',
  calendarNumber: '12'
});

const c2 = createCompetition({
  title: 'Кубок Оренбургской области по продуктовому программированию',
  discipline: 'product',
  level: 'regional',
  typeId: 'ct_3',
  ageGroup: '14-17',
  startDate: d(14),
  place: 'г. Оренбург, ул. Советская, 20',
  format: 'mixed',
  status: 'registration',
  applicationDeadline: d(5),
  calendarPlan: 'regional',
  calendarNumber: '15'
});

const c3 = createCompetition({
  title: 'Межрегиональный турнир по информационной безопасности «КиберЩит»',
  discipline: 'security',
  level: 'interregional',
  typeId: 'ct_6',
  ageGroup: '18-21',
  startDate: d(30),
  endDate: d(31),
  place: 'онлайн',
  format: 'online',
  status: 'published',
  applicationDeadline: d(20)
});

const c4 = createCompetition({
  title: 'Чемпионат России по программированию систем искусственного интеллекта',
  discipline: 'ai',
  level: 'champ_ru',
  typeId: 'ct_1',
  ageGroup: '18-21',
  startDate: d(-60),
  endDate: d(-58),
  place: 'г. Москва',
  format: 'offline',
  status: 'finished',
  applicationDeadline: d(-70),
  calendarPlan: 'ekp',
  calendarNumber: 'ЕКП-2026/145'
});

const c5 = createCompetition({
  title: 'Онлайн-кубок по программированию робототехники',
  discipline: 'robotics',
  level: 'regional',
  typeId: 'ct_3',
  ageGroup: '10-13',
  startDate: d(3),
  place: 'онлайн',
  format: 'online',
  status: 'closed',
  applicationDeadline: d(-2)
});

const c6 = createCompetition({
  title: 'Фестиваль по программированию беспилотных авиационных систем',
  discipline: 'uav',
  level: 'regional',
  typeId: 'ct_5',
  ageGroup: '14-17',
  startDate: d(45),
  place: 'г. Оренбург, набережная',
  format: 'mixed',
  status: 'draft',
  applicationDeadline: d(30)
});

// ---------- заявки ----------

function addApplication(comp, athlete, status, submittedBy, comment) {
  const a = {
    id: nid('app'),
    competitionId: comp.id,
    athleteId: athlete.id,
    submittedBy: submittedBy || athlete.id,
    status,
    comment: comment || null,
    createdAt: d(-10),
    decidedAt: status === 'pending' ? null : d(-8)
  };
  db.applications.push(a);
  return a;
}

// c1: 8 участников 14-17 лет, у всех есть результаты
const c1Candidates = athletes.filter((a) => {
  const age = ageOf(a.birthDate);
  return age >= 14 && age <= 17;
});
const c1Participants = c1Candidates.slice(0, 8);
for (const a of c1Participants) addApplication(c1, a, 'approved', a.id);

// c2: регистрация открыта
const c2Candidates = athletes.filter((a) => ageOf(a.birthDate) >= 14 && ageOf(a.birthDate) <= 17).slice(0, 9);
c2Candidates.forEach((a, i) => {
  if (a.id === demoAthlete.id) return;
  const status = i < 5 ? 'pending' : i < 7 ? 'rejected' : 'approved';
  addApplication(c2, a, status, a.id, status === 'rejected' ? 'Не подтверждена организация' : null);
});
const demoAppC2 = addApplication(c2, demoAthlete, 'approved', demoAthlete.id);

// c4: 6 участников 18-21
const c4Participants = athletes.filter((a) => {
  const age = ageOf(a.birthDate);
  return age >= 18 && age <= 21;
}).slice(0, 6);
for (const a of c4Participants) addApplication(c4, a, 'approved', a.id);

// c5: 4 одобренных, результатов пока нет
const c5Participants = athletes.filter((a) => ageOf(a.birthDate) >= 10 && ageOf(a.birthDate) <= 13).slice(0, 4);
for (const a of c5Participants) addApplication(c5, a, 'approved', a.id);

// ---------- результаты и протоколы ----------

function pointsFor(level, place) {
  const table = db.settings.ratingPoints[level] || [];
  return table[place - 1] || 0;
}

function addResults(comp, participants) {
  const rows = [];
  participants.forEach((a, i) => {
    const place = i + 1;
    const r = {
      id: nid('r'),
      competitionId: comp.id,
      athleteId: a.id,
      place,
      points: pointsFor(comp.level, place),
      protocolId: null
    };
    db.results.push(r);
    rows.push(r);
  });
  return rows;
}

const r1 = addResults(c1, c1Participants);
const r4 = addResults(c4, c4Participants);

function publishProtocol(comp, results, offset) {
  const rows = results
    .slice()
    .sort((a, b) => a.place - b.place || b.points - a.points)
    .map((r) => {
      const athlete = db.users.find((u) => u.id === r.athleteId);
      const org = db.organizations.find((o) => o.id === athlete.organizationId);
      return {
        place: r.place,
        athleteId: athlete.id,
        fio: athlete.fio,
        organization: org ? org.name : '—',
        points: r.points
      };
    });

  const p = {
    id: nid('p'),
    competitionId: comp.id,
    status: 'published',
    rows,
    createdAt: d(offset),
    publishedAt: d(offset)
  };
  db.protocols.push(p);
  comp.status = 'finished';
  for (const r of results) {
    r.protocolId = p.id;
  }
  return p;
}

const p1 = publishProtocol(c1, r1, -19);
publishProtocol(c4, r4, -59);

// ---------- разряды ----------

const ra1 = {
  id: nid('ra'),
  athleteId: athletes[3].id,
  requestedRank: '3 спортивный',
  competitionId: c1.id,
  resultId: r1[3].id,
  status: 'pending',
  comment: null,
  createdAt: d(-4),
  decidedAt: null,
  decidedBy: null,
  orderNumber: null,
  validUntil: null
};
db.rankApplications.push(ra1);

const ra2 = {
  id: nid('ra'),
  athleteId: athletes[5].id,
  requestedRank: '2 юношеский',
  competitionId: c1.id,
  resultId: r1[5].id,
  status: 'pending',
  comment: null,
  createdAt: d(-3),
  decidedAt: null,
  decidedBy: null,
  orderNumber: null,
  validUntil: null
};
db.rankApplications.push(ra2);

db.rankApplications.push({
  id: nid('ra'),
  athleteId: athletes[2].id,
  requestedRank: '2 спортивный',
  competitionId: c4.id,
  resultId: r4[2].id,
  status: 'approved',
  comment: null,
  createdAt: d(-40),
  decidedAt: d(-35),
  decidedBy: fed.id,
  orderNumber: '№ 77-р',
  validUntil: addYears(d(-35), 2)
});

// ---------- судьи ----------

db.judgeAssignments.push(
  { id: nid('ja'), competitionId: c1.id, judgeId: judge2.id, position: 'главный судья' },
  { id: nid('ja'), competitionId: c1.id, judgeId: judge1.id, position: 'секретарь' },
  { id: nid('ja'), competitionId: c4.id, judgeId: judge3.id, position: 'судья' }
);

db.judgeCategoryApplications.push({
  id: nid('jca'),
  judgeId: judge4.id,
  requestedCategory: '2 категория',
  status: 'pending',
  comment: null,
  createdAt: d(-6),
  decidedAt: null,
  validUntil: null
});

// ---------- справки ----------

db.certificates.push({
  id: nid('cert'),
  number: 'ФСП-2026-0001',
  athleteId: demoAthlete.id,
  competitionId: c1.id,
  resultId: r1[0].id,
  verifyCode: 'fsp-2026-0001-x7k2',
  createdAt: d(-15)
});

// ---------- сборная ----------

db.teams.push({
  id: nid('team'),
  season: TODAY.getFullYear(),
  discipline: 'algo',
  ageGroup: '14-17',
  athleteIds: c1Participants.slice(0, 4).map((a) => a.id),
  createdAt: d(-10),
  createdBy: fed.id
});

// ---------- уведомления ----------

function notify(userId, title, text, link, offset) {
  db.notifications.push({
    id: nid('n'),
    userId,
    title,
    text,
    link: link || null,
    read: false,
    createdAt: d(offset),
    channel: 'inapp'
  });
}

notify(fed.id, 'Новая заявка на разряд', 'Поступила заявка на присвоение разряда от спортсмена.', '#/ranks', -4);
notify(fed.id, 'Заявки на соревнование', 'В «Кубке области» 5 заявок ожидают модерации.', '#/applications', -1);
notify(fed.id, 'Истекает разряд', 'У нескольких спортсменов разряд истекает в ближайшие 30 дней.', '#/ranks', -2);
notify(fed.id, 'Отчёт о численности', 'Сформирован отчёт за 3 года. Доступен в разделе «Отчёты».', '#/reports', -3);

notify(demoAthlete.id, 'Заявка одобрена', 'Заявка на Кубок области по продуктовому программированию одобрена.', '#/my-applications', -2);
notify(demoAthlete.id, 'Опубликован протокол', 'Протокол первенства области опубликован. Ваше место: 1.', '#/my-results', -19);
notify(demoAthlete.id, 'Истекает разряд', 'Срок действия разряда истекает через 20 дней.', '#/my-rank', -1);
notify(demoAthlete.id, 'Скоро дедлайн', 'Приём заявок на Кубок области закроется через 5 дней.', '#/calendar', -1);

notify(trainer1.id, 'Новая заявка', 'Ваш спортсмен подал заявку на соревнование.', '#/trainer-applications', -2);
notify(trainer1.id, 'Истекает разряд подопечного', 'Проверьте сроки действия разрядов.', '#/trainer-ranks', -1);

notify(judge1.id, 'Назначение', 'Вы назначены секретарём на первенство области.', '#/assignments', -20);
notify(judge1.id, 'Истекает категория', 'Судейская категория истекает через 25 дней.', '#/judge-category', -1);

// ---------- журнал ----------

db.auditLog.push(
  { id: nid('log'), at: d(-19) + 'T12:10:00', userId: fed.id, login: 'federation', action: 'publish', entity: 'protocol', entityId: p1.id, details: 'Публикация протокола' },
  { id: nid('log'), at: d(-8) + 'T09:30:00', userId: fed.id, login: 'federation', action: 'approve', entity: 'application', entityId: demoAppC2.id, details: 'Одобрение заявки' },
  { id: nid('log'), at: d(-4) + 'T16:45:00', userId: athletes[3].id, login: athletes[3].login, action: 'create', entity: 'rankApplication', entityId: ra1.id, details: 'Заявка на разряд' }
);

db.counters = counters;
save(db);

fs.writeFileSync(path.join(DATA_DIR, 'mail.log'), '', 'utf8');

console.log('Демо-данные созданы:');
console.log('  пользователей:', db.users.length);
console.log('  соревнований:', db.competitions.length);
console.log('  заявок:', db.applications.length);
console.log('  результатов:', db.results.length);
console.log('  протоколов:', db.protocols.length);
console.log('  Логины: federation, athlete, trainer, judge, multi, ministry (пароль demo123)');

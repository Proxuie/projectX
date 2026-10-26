// Вход, регистрация, текущий пользователь, переключение ролей.
const express = require('express');
const bcrypt = require('bcryptjs');
const { load, save, nextId } = require('../db');
const { currentUser, activeRole, publicUser } = require('../auth');
const { iso, ageAt } = require('../utils');

const router = express.Router();

router.post('/auth/login', (req, res) => {
  const body = req.body || {};
  const login = String(body.login || '').trim().toLowerCase();
  const password = String(body.password || '');

  if (!login || !password) {
    return res.status(400).json({ error: 'Укажите логин и пароль' });
  }

  const db = load();
  const user = db.users.find((u) => u.login === login);

  if (!user || !bcrypt.compareSync(password, user.passHash)) {
    return res.status(401).json({ error: 'Неверный логин или пароль' });
  }

  req.session.userId = user.id;
  req.session.activeRole = user.roles[0];

  res.json({ user: publicUser(user), activeRole: req.session.activeRole });
});

router.post('/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.post('/auth/register', (req, res) => {
  const b = req.body || {};
  const login = String(b.login || '').trim().toLowerCase();
  const password = String(b.password || '');
  const fio = String(b.fio || '').trim();
  const birthDate = String(b.birthDate || '');

  if (!/^[a-z0-9._-]{3,30}$/.test(login)) {
    return res.status(400).json({ error: 'Логин: 3–30 символов, латиница, цифры, точка, дефис' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Пароль должен быть не короче 6 символов' });
  }
  if (fio.split(' ').filter(Boolean).length < 2) {
    return res.status(400).json({ error: 'Укажите фамилию и имя' });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
    return res.status(400).json({ error: 'Укажите дату рождения' });
  }
  if (!b.consent) {
    return res.status(400).json({ error: 'Без согласия на обработку персональных данных регистрация невозможна' });
  }

  const age = ageAt(birthDate);
  if (age < 18 && (!b.guardianFio || !b.guardianConsent)) {
    return res.status(400).json({ error: 'Для несовершеннолетнего нужны данные законного представителя и его согласие' });
  }

  const db = load();
  if (db.users.some((u) => u.login === login)) {
    return res.status(400).json({ error: 'Такой логин уже занят' });
  }

  const user = {
    id: nextId('u'),
    login,
    passHash: bcrypt.hashSync(password, 8),
    fio,
    birthDate,
    gender: b.gender === 'f' ? 'f' : 'm',
    municipality: String(b.municipality || '').trim(),
    organizationId: b.organizationId || null,
    disciplines: Array.isArray(b.disciplines) ? b.disciplines : [],
    startYear: Number(b.startYear) || new Date().getFullYear(),
    roles: ['athlete'],
    activeRole: 'athlete',
    phone: String(b.phone || ''),
    email: String(b.email || ''),
    status: 'active',
    disqualifiedUntil: null,
    consent: {
      pdp: true,
      date: iso(),
      guardianFio: b.guardianFio || null,
      guardianConsent: age < 18 ? !!b.guardianConsent : false
    },
    rusada: { passed: false, date: null, certUrl: null },
    rank: null,
    judgeCategory: null,
    createdAt: iso()
  };

  db.users.push(user);
  save();

  req.session.userId = user.id;
  req.session.activeRole = 'athlete';

  res.json({ user: publicUser(user), activeRole: 'athlete' });
});

router.get('/me', (req, res) => {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: 'Требуется вход' });
  const db = load();
  const unread = db.notifications.filter((n) => n.userId === user.id && !n.read).length;
  res.json({ user: publicUser(user), activeRole: activeRole(req), unread });
});

router.post('/me/role', (req, res) => {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: 'Требуется вход' });

  const role = String((req.body || {}).role || '');
  if (!user.roles.includes(role)) {
    return res.status(403).json({ error: 'У вас нет такой роли' });
  }

  req.session.activeRole = role;
  res.json({ activeRole: role, user: publicUser(user) });
});

router.get('/dictionaries', (req, res) => {
  const db = load();
  res.json(db.dictionaries);
});

// Мягкая проверка сессии: всегда 200, чтобы не шуметь 401 в консоли.
router.get('/session', (req, res) => {
  const user = currentUser(req);
  if (!user) return res.json({ user: null, activeRole: null, unread: 0 });

  const db = load();
  const unread = db.notifications.filter((n) => n.userId === user.id && !n.read).length;
  res.json({ user: publicUser(user), activeRole: activeRole(req), unread });
});

module.exports = router;

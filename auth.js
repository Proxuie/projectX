// Сессии, текущий пользователь, проверка ролей.
const { load } = require('./db');

function currentUser(req) {
  if (!req.session || !req.session.userId) return null;
  const db = load();
  return db.users.find((u) => u.id === req.session.userId) || null;
}

// Активная роль: та, что выбрана в сессии, но только если она есть у пользователя.
function activeRole(req) {
  const user = currentUser(req);
  if (!user) return null;
  if (req.session.activeRole && user.roles.includes(req.session.activeRole)) {
    return req.session.activeRole;
  }
  return user.roles[0];
}

function requireAuth(req, res, next) {
  if (!currentUser(req)) return res.status(401).json({ error: 'Требуется вход' });
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    const user = currentUser(req);
    if (!user) return res.status(401).json({ error: 'Требуется вход' });
    const role = activeRole(req);
    if (!roles.includes(role)) {
      return res.status(403).json({ error: 'Нет доступа для роли «' + role + '»' });
    }
    next();
  };
}

function publicUser(user) {
  const copy = { ...user };
  delete copy.passHash;
  return copy;
}

module.exports = { currentUser, activeRole, requireAuth, requireRole, publicUser };

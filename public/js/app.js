// Каркас приложения: маршрутизация, оболочка, роли.
import { api } from './api.js';
import { state, roleName } from './store.js';
import { esc, initials, icon, toast, loading, openModal, closeModal } from './ui.js';

import { renderLanding, renderLogin, renderRegister, renderVerify } from './pages/public.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderRegistry } from './pages/registry.js';
import { renderCompetitions, renderCompetition } from './pages/competitions.js';
import { renderApplications } from './pages/applications.js';
import { renderRanks } from './pages/ranks.js';
import { renderJudges } from './pages/judges.js';
import { renderRating, renderTeams } from './pages/rating.js';
import { renderReports } from './pages/reports.js';
import { renderSettings, renderAudit } from './pages/admin.js';
import { renderProfile } from './pages/profile.js';
import { renderCalendar, renderMyApplications, renderMyResults, renderMyRank, renderDocuments } from './pages/athlete.js';
import { renderMyAthletes, renderTrainerApplications, renderTrainerRanks } from './pages/trainer.js';
import { renderJudgeCategory, renderAssignments, renderJudgeCompetitions, renderJudgeDocuments } from './pages/judge.js';
import { renderMinistry } from './pages/ministry.js';
import { renderNotifications } from './pages/notifications.js';

var NAV = {
  federation: [
    { id: 'dashboard', label: 'Дашборд', icon: '▦' },
    { id: 'registry', label: 'Реестр', icon: '☰' },
    { id: 'competitions', label: 'Календарь', icon: '▤' },
    { id: 'applications', label: 'Заявки', icon: '✓' },
    { id: 'ranks', label: 'Разряды', icon: '★' },
    { id: 'judges', label: 'Судьи', icon: '⚖' },
    { id: 'rating', label: 'Рейтинг', icon: '▲' },
    { id: 'teams', label: 'Сборная', icon: '⚑' },
    { id: 'reports', label: 'Отчёты', icon: '⇩' },
    { id: 'settings', label: 'Настройки', icon: '⚙' },
    { id: 'audit', label: 'Журнал', icon: '≡' }
  ],
  athlete: [
    { id: 'dashboard', label: 'Главная', icon: '▦' },
    { id: 'calendar', label: 'Календарь', icon: '▤' },
    { id: 'my-applications', label: 'Мои заявки', icon: '✓' },
    { id: 'my-results', label: 'Результаты', icon: '▲' },
    { id: 'my-rank', label: 'Разряд', icon: '★' },
    { id: 'documents', label: 'Документы', icon: '⇩' },
    { id: 'profile', label: 'Профиль', icon: '☺' }
  ],
  trainer: [
    { id: 'dashboard', label: 'Главная', icon: '▦' },
    { id: 'my-athletes', label: 'Мои спортсмены', icon: '☺' },
    { id: 'trainer-applications', label: 'Заявки', icon: '✓' },
    { id: 'trainer-ranks', label: 'Разряды', icon: '★' },
    { id: 'profile', label: 'Профиль', icon: '⚙' }
  ],
  judge: [
    { id: 'dashboard', label: 'Главная', icon: '▦' },
    { id: 'judge-category', label: 'Категория', icon: '★' },
    { id: 'assignments', label: 'Назначения', icon: '⚑' },
    { id: 'judge-competitions', label: 'Мои соревнования', icon: '▤' },
    { id: 'judge-documents', label: 'Документы', icon: '⇩' },
    { id: 'profile', label: 'Профиль', icon: '☺' }
  ],
  ministry: [
    { id: 'ministry', label: 'Обзор', icon: '▦' },
    { id: 'reports', label: 'Отчёты', icon: '⇩' },
    { id: 'rating', label: 'Рейтинг', icon: '▲' },
    { id: 'competitions', label: 'Календарь', icon: '▤' },
    { id: 'profile', label: 'Профиль', icon: '☺' }
  ]
};

var PAGES = {
  dashboard: renderDashboard,
  registry: renderRegistry,
  competitions: renderCompetitions,
  applications: renderApplications,
  ranks: renderRanks,
  judges: renderJudges,
  rating: renderRating,
  teams: renderTeams,
  reports: renderReports,
  settings: renderSettings,
  audit: renderAudit,
  profile: renderProfile,
  calendar: renderCalendar,
  'my-applications': renderMyApplications,
  'my-results': renderMyResults,
  'my-rank': renderMyRank,
  documents: renderDocuments,
  'my-athletes': renderMyAthletes,
  'trainer-applications': renderTrainerApplications,
  'trainer-ranks': renderTrainerRanks,
  'judge-category': renderJudgeCategory,
  assignments: renderAssignments,
  'judge-competitions': renderJudgeCompetitions,
  'judge-documents': renderJudgeDocuments,
  ministry: renderMinistry,
  notifications: renderNotifications
};

var TITLES = {
  dashboard: 'Дашборд',
  registry: 'Реестр',
  competitions: 'Календарь соревнований',
  applications: 'Заявки на соревнования',
  ranks: 'Разряды',
  judges: 'Судьи и коллегии',
  rating: 'Рейтинг',
  teams: 'Сборная региона',
  reports: 'Отчёты и справки',
  settings: 'Настройки',
  audit: 'Журнал действий',
  profile: 'Профиль',
  calendar: 'Календарь',
  'my-applications': 'Мои заявки',
  'my-results': 'История выступлений',
  'my-rank': 'Разряд',
  documents: 'Документы',
  'my-athletes': 'Мои спортсмены',
  'trainer-applications': 'Заявки подопечных',
  'trainer-ranks': 'Разряды подопечных',
  'judge-category': 'Судейская категория',
  assignments: 'Назначения',
  'judge-competitions': 'Мои соревнования',
  'judge-documents': 'Документы',
  ministry: 'Кабинет министерства',
  notifications: 'Уведомления'
};

var PUBLIC = ['landing', 'login', 'register', 'verify'];
var shellBuilt = false;

function navFor(role) {
  return NAV[role] || [];
}

function canAccess(name, role) {
  if (name === 'competitions' || name === 'profile' || name === 'notifications') return true;
  return navFor(role).some((n) => n.id === name);
}

function parseHash() {
  var raw = location.hash.replace(/^#\/?/, '');
  var parts = raw.split('/').filter(Boolean);
  return { name: parts[0] || '', param: parts[1] || null };
}

async function loadMe() {
  var me = await api.get('/me');
  state.me = me.user;
  state.role = me.activeRole;
  state.unread = me.unread;
  updateBadge();
}

function updateBadge() {
  var badge = document.getElementById('bell-badge');
  if (!badge) return;
  if (state.unread > 0) {
    badge.hidden = false;
    badge.textContent = state.unread > 99 ? '99+' : String(state.unread);
  } else {
    badge.hidden = true;
  }
}

async function refreshMe() {
  try {
    await loadMe();
    updateBadge();
  } catch (e) {
    /* не критично */
  }
}

function buildShell() {
  var app = document.getElementById('app');
  app.innerHTML =
    '<div class="layout">' +
      '<div class="scrim" id="scrim"></div>' +
      '<aside class="sidebar" id="sidebar">' +
        '<a class="brand" href="#/dashboard">' +
          '<span class="brand-mark">ФСП</span>' +
          '<span class="brand-text"><strong>Оренбург</strong><small>цифровая платформа</small></span>' +
        '</a>' +
        '<nav class="nav" id="nav"></nav>' +
        '<div class="side-foot" id="side-foot"></div>' +
      '</aside>' +
      '<div class="main">' +
        '<header class="topbar">' +
          '<button class="icon-btn burger" id="burger" aria-label="Меню">' + icon('menu') + '</button>' +
          '<div class="topbar-title" id="page-title">Платформа</div>' +
          '<div class="topbar-actions">' +
            '<button class="icon-btn bell" id="bell" aria-label="Уведомления">' + icon('bell') +
              '<span class="badge" id="bell-badge" hidden>0</span></button>' +
            '<select class="input role-select" id="role-select" aria-label="Активная роль"></select>' +
            '<div class="user-chip"><span class="avatar" id="avatar"></span>' +
              '<span class="user-name" id="user-name"></span></div>' +
            '<button class="btn ghost logout" id="logout">Выйти</button>' +
          '</div>' +
        '</header>' +
        '<main id="view" class="view"></main>' +
        '<nav class="bottom-nav" id="bottom-nav"></nav>' +
      '</div>' +
    '</div>';

  shellBuilt = true;

  document.getElementById('burger').onclick = () => {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('scrim').classList.toggle('show');
  };
  document.getElementById('scrim').onclick = () => {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('scrim').classList.remove('show');
  };
  document.getElementById('bell').onclick = () => {
    location.hash = '#/notifications';
  };

  async function doLogout() {
    await api.post('/auth/logout');
    state.me = null;
    state.role = null;
    shellBuilt = false;
    document.getElementById('app').innerHTML = '';
    location.hash = '#/';
    route();
  }

  document.getElementById('logout').onclick = doLogout;

  renderRoleSelect();
  renderNav();

  var avatar = document.getElementById('avatar');
  var userName = document.getElementById('user-name');
  if (avatar && state.me) avatar.textContent = initials(state.me.fio);
  if (userName && state.me) userName.textContent = state.me.fio;

  var sideFoot = document.getElementById('side-foot');
  if (sideFoot) {
    var sideLogout = document.createElement('button');
    sideLogout.className = 'side-logout';
    sideLogout.textContent = 'Выйти';
    sideLogout.onclick = doLogout;
    sideFoot.appendChild(sideLogout);
  }
}

function renderRoleSelect() {
  var select = document.getElementById('role-select');
  if (!select || !state.me) return;
  select.innerHTML = state.me.roles
    .map((r) => '<option value="' + esc(r) + '"' + (r === state.role ? ' selected' : '') + '>' + esc(roleName(r)) + '</option>')
    .join('');
  select.onchange = async () => {
    var role = select.value;
    try {
      await api.post('/me/role', { role });
      state.role = role;
      await refreshMe();
      renderNav();
      renderRoleSelect();
      location.hash = '#/dashboard';
      route();
    } catch (e) {
      toast(e.message, 'error');
    }
  };
}

function renderNav() {
  var nav = document.getElementById('nav');
  var items = navFor(state.role);

  nav.innerHTML = items.map((item) =>
    '<a class="nav-item" href="#/' + esc(item.id) + '" data-nav="' + esc(item.id) + '">' +
      '<span class="ico">' + esc(item.icon) + '</span><span class="label">' + esc(item.label) + '</span>' +
    '</a>'
  ).join('');

  var foot = document.getElementById('side-foot');
  if (foot && state.me) {
    foot.innerHTML = '<div class="side-role">Роль: <strong>' + esc(roleName(state.role)) + '</strong></div>' +
      '<div class="side-user">' + esc(state.me.fio) + '</div>';
  }

  var bottom = document.getElementById('bottom-nav');
  var first = items.slice(0, 4);
  var html = first.map((item) =>
    '<a class="bnav-item" href="#/' + esc(item.id) + '" data-nav="' + esc(item.id) + '">' +
      '<span class="ico">' + esc(item.icon) + '</span><span>' + esc(item.label) + '</span>' +
    '</a>'
  ).join('');
  html += '<button class="bnav-item" id="more-btn"><span class="ico">⋯</span><span>Ещё</span></button>';
  bottom.innerHTML = html;

  var more = document.getElementById('more-btn');
  if (more) {
    more.onclick = () => {
      var extra = items.slice(4);
      var links = extra.map((i) =>
        '<a class="sheet-link" href="#/' + esc(i.id) + '" data-sheet-link="' + esc(i.id) + '">' +
          '<span class="ico">' + esc(i.icon) + '</span>' + esc(i.label) + '</a>'
      ).join('');
      var card = openModal('Разделы', links + '<a class="sheet-link" href="#/notifications" data-sheet-link="notifications">' +
        '<span class="ico">◔</span>Уведомления</a>' +
        '<a class="sheet-link" href="#/profile" data-sheet-link="profile"><span class="ico">☺</span>Профиль</a>' +
        '<button class="sheet-link sheet-logout" id="sheet-logout"><span class="ico">⏻</span>Выйти</button>');
      card.querySelectorAll('[data-sheet-link]').forEach((a) => {
        a.addEventListener('click', () => closeModal());
      });
      var sheetLogout = card.querySelector('#sheet-logout');
      if (sheetLogout) {
        sheetLogout.onclick = () => {
          closeModal();
          document.getElementById('logout').click();
        };
      }
    };
  }
}

function markActive(name) {
  document.querySelectorAll('[data-nav]').forEach((el) => {
    el.classList.toggle('active', el.dataset.nav === name);
  });
}

function renderNoAccess() {
  var view = document.getElementById('view');
  view.innerHTML = '<div class="card no-access"><h2>Нет доступа</h2>' +
    '<p class="muted">Для роли «' + esc(roleName(state.role)) + '» этот раздел недоступен.</p>' +
    '<p><a class="btn" href="#/dashboard">На главную</a></p></div>';
}

async function renderPublic(name, param) {
  shellBuilt = false;
  document.getElementById('app').innerHTML = '<div class="public" id="public-root"></div>';
  var root = document.getElementById('public-root');

  if (name === 'login') return renderLogin(root);
  if (name === 'register') return renderRegister(root);
  if (name === 'verify') return renderVerify(root, param);
  return renderLanding(root);
}

async function route() {
  var parsed = parseHash();
  var name = parsed.name;
  var isPublic = PUBLIC.indexOf(name) !== -1 || name === '';

  if (!state.me) {
    if (!isPublic) return renderPublic('login');
    return renderPublic(name || 'landing');
  }

  if (isPublic && name !== 'verify') {
    location.hash = '#/dashboard';
    return;
  }
  if (name === 'verify') return renderPublic('verify', parsed.param);

  if (!shellBuilt) buildShell();

  var pageName = name || 'dashboard';
  var render = PAGES[pageName];
  var param = null;

  if (pageName === 'competitions' && parsed.param) {
    render = renderCompetition;
    param = parsed.param;
  }

  if (!render || !canAccess(pageName, state.role)) {
    markActive('');
    return renderNoAccess();
  }

  var title = TITLES[pageName] || 'Платформа';
  if (pageName === 'competitions' && param) title = 'Соревнование';
  document.getElementById('page-title').textContent = title;
  markActive(pageName);

  var view = document.getElementById('view');
  view.innerHTML = loading('Загрузка…');

  try {
    await render(view, param);
  } catch (e) {
    if (e.status === 401) {
      state.me = null;
      location.hash = '#/login';
      return route();
    }
    view.innerHTML = '<div class="card"><h2>Не получилось загрузить раздел</h2>' +
      '<p class="muted">' + esc(e.message) + '</p>' +
      '<p><a class="btn" href="#/dashboard">На главную</a></p></div>';
  }

  updateBadge();
}

window.addEventListener('hashchange', route);
window.addEventListener('refresh-me', refreshMe);

async function boot() {
  try {
    state.dict = await api.get('/dictionaries');
  } catch (e) {
    state.dict = null;
  }

  try {
    var session = await api.get('/session');
    if (session.user) {
      state.me = session.user;
      state.role = session.activeRole;
      state.unread = session.unread;
    }
  } catch (e) {
    state.me = null;
  }

  if (location.hash === '' || location.hash === '#') {
    location.hash = state.me ? '#/dashboard' : '#/';
  }

  await route();
}

boot();

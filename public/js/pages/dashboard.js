// Дашборд для всех ролей.
import { api } from '../api.js';
import { state, roleName, discName, levelName, formatName } from '../store.js';
import { esc, fmtDate, daysText, statusChip, loading, pageHead, empty } from '../ui.js';

function greeting() {
  var h = new Date().getHours();
  if (h < 6) return 'Доброй ночи';
  if (h < 12) return 'Доброе утро';
  if (h < 18) return 'Добрый день';
  return 'Добрый вечер';
}

function dateLine() {
  return new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

function kpiCard(kpi) {
  return '<div class="card kpi"><span class="kpi-label">' + esc(kpi.label) + '</span>' +
    '<span class="kpi-value">' + esc(kpi.value) + '</span>' +
    '<span class="kpi-hint">' + esc(kpi.hint || '') + '</span></div>';
}

function upcomingCard(list, role) {
  if (!list || list.length === 0) {
    return '<div class="card"><h2 class="card-title">Ближайшие соревнования</h2>' + empty('Пока нет событий', 'Календарь появится, когда федерация опубликует соревнования.') + '</div>';
  }

  var items = list.map(function (c) {
    var fit = '';
    if (role === 'athlete') {
      if (c.applied) fit = statusChip(c.applied);
      else if (c.fitsAge) fit = '<span class="chip chip-ok">Вы проходите</span>';
      else fit = '<span class="chip chip-muted">Не проходите</span>';
    } else {
      fit = statusChip(c.status);
    }

    var link = role === 'federation' || role === 'ministry' ? '#/competitions/' + c.id : '#/calendar';

    return '<a class="up-row" href="' + link + '">' +
      '<div class="date-box"><b>' + esc(fmtDate(c.startDate).slice(0, 5)) + '</b>' +
        '<span>' + esc(fmtDate(c.startDate).slice(6)) + '</span></div>' +
      '<div class="up-info"><strong>' + esc(c.title) + '</strong>' +
        '<span class="muted small">' + esc(c.disciplineName) + ' · ' + esc(c.levelName) + ' · ' + esc(formatName(c.format)) + '</span></div>' +
      '<div class="up-tail">' + fit + '<span class="muted small">' + esc(daysText(c.daysLeft)) + '</span></div>' +
    '</a>';
  }).join('');

  return '<div class="card"><div class="card-head"><h2 class="card-title">Ближайшие соревнования</h2>' +
    '<a class="link small" href="#/calendar">Весь календарь</a></div>' + items + '</div>';
}

function attentionCard(list) {
  var active = (list || []).filter(function (x) { return x.count > 0; });
  var rows = active.map(function (x) {
    return '<a class="att-row" href="' + esc(x.link) + '">' +
      '<span class="att-label">' + esc(x.label) + '</span>' +
      '<span class="att-count">' + x.count + '</span></a>';
  }).join('');

  return '<div class="card"><div class="card-head"><h2 class="card-title">Требует внимания</h2></div>' +
    (active.length ? rows : '<p class="muted">Всё под контролем — срочных задач нет.</p>') + '</div>';
}

function deadlinesCard(list) {
  if (!list || list.length === 0) return '';
  var items = list.slice(0, 6).map(function (d) {
    var cls = d.daysLeft !== null && d.daysLeft <= 3 ? 'due soon' : 'due';
    return '<a class="due-row ' + cls + '" href="' + esc(d.link) + '">' +
      '<span class="due-date">' + esc(fmtDate(d.date)) + '</span>' +
      '<span class="due-title">' + esc(d.title) + '</span>' +
      '<span class="due-days">' + esc(daysText(d.daysLeft)) + '</span></a>';
  }).join('');

  return '<div class="card"><div class="card-head"><h2 class="card-title">Сроки</h2></div>' + items + '</div>';
}

function chartCard(chart) {
  if (!chart || chart.length === 0) return '';
  var max = Math.max.apply(null, chart.map(function (c) { return c.value; })) || 1;

  var bars = chart.map(function (c) {
    var pct = Math.round((c.value / max) * 100);
    return '<div class="bar"><span class="bar-val">' + c.value + '</span>' +
      '<div class="bar-track"><div class="bar-fill" style="height:' + pct + '%"></div></div>' +
      '<span class="bar-year">' + c.year + '</span></div>';
  }).join('');

  return '<div class="card"><div class="card-head"><h2 class="card-title">Численность занимающихся</h2>' +
    '<span class="muted small">по годам</span></div>' +
    '<div class="bars">' + bars + '</div></div>';
}

export async function renderDashboard(el) {
  var data = await api.get('/dashboard');
  var user = state.me;

  var head = '<div class="page-head">' +
    '<div><h1>' + esc(greeting()) + ', ' + esc(user.fio.split(' ')[1] || user.fio) + '</h1>' +
      '<p class="muted">' + esc(dateLine()) + ' · ' + esc(roleName(data.role)) + '</p></div>' +
    '<div class="page-actions">' +
      (data.role === 'athlete' ? '<a class="btn" href="#/calendar">Подать заявку</a>' : '') +
      (data.role === 'federation' ? '<a class="btn" href="#/competitions">Создать соревнование</a>' : '') +
    '</div></div>';

  var kpis = '<div class="grid k4">' + data.kpis.map(kpiCard).join('') + '</div>';

  el.innerHTML = head + kpis +
    '<div class="grid k2 mt">' +
      upcomingCard(data.upcoming, data.role) +
      attentionCard(data.attention) +
    '</div>' +
    '<div class="grid k2 mt">' +
      deadlinesCard(data.deadlines) +
      chartCard(data.chart) +
    '</div>';
}

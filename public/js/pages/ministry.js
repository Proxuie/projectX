// Кабинет министерства (только чтение).
import { api } from '../api.js';
import { esc, loading, pageHead } from '../ui.js';

export async function renderMinistry(el) {
  el.innerHTML = pageHead('Кабинет министерства', 'Доступ только для чтения') + '<div id="min">' + loading() + '</div>';

  var data = await api.get('/dashboard');
  var max = Math.max.apply(null, data.chart.map(function (c) { return c.value; }).concat([1]));

  var bars = data.chart.map(function (c) {
    var pct = Math.round((c.value / max) * 100);
    return '<div class="bar"><span class="bar-val">' + c.value + '</span>' +
      '<div class="bar-track"><div class="bar-fill" style="height:' + pct + '%"></div></div>' +
      '<span class="bar-year">' + c.year + '</span></div>';
  }).join('');

  el.querySelector('#min').innerHTML =
    '<div class="note">Режим просмотра: доступны отчёты, календарь и состав сборной. Изменения недоступны.</div>' +
    '<div class="grid k4 mt">' + data.kpis.map(function (k) {
      return '<div class="card kpi"><span class="kpi-label">' + esc(k.label) + '</span>' +
        '<span class="kpi-value">' + esc(k.value) + '</span>' +
        '<span class="kpi-hint">' + esc(k.hint) + '</span></div>';
    }).join('') + '</div>' +
    '<div class="grid k2 mt">' +
      '<div class="card"><div class="card-head"><h2 class="card-title">Численность занимающихся</h2></div>' +
        '<div class="bars">' + bars + '</div></div>' +
      '<div class="card"><h2 class="card-title">Доступные разделы</h2>' +
        '<ul class="plain">' +
          '<li><a href="#/reports">Отчёты и выгрузки</a> — численность, реестр, рейтинг</li>' +
          '<li><a href="#/rating">Рейтинг спортсменов</a></li>' +
          '<li><a href="#/competitions">Календарь соревнований</a></li>' +
          '<li><a href="#/teams">Состав сборной</a></li>' +
        '</ul>' +
      '</div>' +
    '</div>';
}

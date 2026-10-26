// Кабинет судьи.
import { api } from '../api.js';
import { state } from '../store.js';
import {
  esc, fmtDate, daysText, statusChip, loading, pageHead, table, empty,
  selectField, openModal, closeModal, toast
} from '../ui.js';

export async function renderJudgeCategory(el) {
  var me = await api.get('/users/' + state.me.id);
  var apps = await api.get('/judges/category-applications');
  var cat = me.judgeCategory;
  var days = cat ? Math.round((new Date(cat.validUntil) - new Date()) / 86400000) : null;

  var card = '<div class="card"><h2 class="card-title">Судейская категория</h2>' +
    (cat
      ? '<div class="rank-big">' + esc(cat.title) + '</div>' +
        '<dl class="facts"><dt>Действует до</dt><dd>' + esc(fmtDate(cat.validUntil)) + '</dd>' +
        '<dt>Осталось</dt><dd>' + esc(daysText(days)) + '</dd></dl>' +
        (days !== null && days <= 30 ? '<p class="alert">Категория истекает — подайте заявку на подтверждение.</p>' : '')
      : '<p class="muted">Категория не присвоена.</p>') +
    '</div>';

  var existing = apps.find(function (a) { return a.status === 'pending'; });

  var form = existing
    ? '<div class="card mt"><p class="muted">Заявка на «' + esc(existing.requestedCategory) + '» уже на рассмотрении.</p></div>'
    : '<div class="card mt"><h2 class="card-title">Подать заявку</h2>' +
      '<form id="cat-apply" class="form">' +
        selectField('Категория', 'category', state.dict.judgeCategories.map(function (c) { return { value: c, label: c }; }), state.dict.judgeCategories[0]) +
        '<button class="btn" type="submit">Подать заявку</button>' +
      '</form></div>';

  el.innerHTML = pageHead('Судейская категория', 'Срок действия и заявки') +
    '<div class="grid k2">' + card +
      '<div class="card"><h2 class="card-title">История заявок</h2>' +
        table(['Дата', 'Категория', 'Статус'], apps.map(function (a) {
          return [esc(fmtDate(a.createdAt)), esc(a.requestedCategory), statusChip(a.status)];
        }), { emptyText: 'Заявок нет' }) +
      '</div>' +
    '</div>' + form;

  var applyForm = el.querySelector('#cat-apply');
  if (applyForm) {
    applyForm.onsubmit = function (e) {
      e.preventDefault();
      api.post('/judges/category-applications', {
        requestedCategory: applyForm.querySelector('[name=category]').value
      }).then(function () {
        toast('Заявка подана');
        renderJudgeCategory(el);
      }).catch(function (err) { toast(err.message, 'error'); });
    };
  }
}

export async function renderAssignments(el) {
  var list = await api.get('/judges/assignments?judgeId=' + encodeURIComponent(state.me.id));

  el.innerHTML = pageHead('Назначения', 'Соревнования и судейские должности') +
    '<div class="card">' + table(
      ['Соревнование', 'Дата', 'Должность', 'Статус'],
      list.map(function (a) {
        return [
          '<a class="link-btn" href="#/competitions/' + esc(a.competitionId) + '">' + esc(a.competitionTitle) + '</a>',
          esc(fmtDate(a.competitionDate)),
          esc(a.position),
          statusChip(a.competitionStatus)
        ];
      }),
      { emptyText: 'Назначений пока нет', emptyHint: 'Федерация назначит вас на соревнование.' }
    ) + '</div>';
}

export async function renderJudgeCompetitions(el) {
  var list = await api.get('/judges/assignments?judgeId=' + encodeURIComponent(state.me.id));
  var finished = list.filter(function (a) { return a.competitionStatus === 'finished'; });

  el.innerHTML = pageHead('Мои соревнования', 'Где вы работали судьёй') +
    '<div class="card">' + table(
      ['Соревнование', 'Дата', 'Должность', 'Документ'],
      finished.map(function (a) {
        return [
          '<a class="link-btn" href="#/competitions/' + esc(a.competitionId) + '">' + esc(a.competitionTitle) + '</a>',
          esc(fmtDate(a.competitionDate)),
          esc(a.position),
          '<a class="btn small ghost" href="/api/reports/judges/' + esc(a.competitionId) + '.docx">Справка о коллегии</a>'
        ];
      }),
      { emptyText: 'Проведённых соревнований пока нет' }
    ) + '</div>';
}

export async function renderJudgeDocuments(el) {
  var list = await api.get('/judges/assignments?judgeId=' + encodeURIComponent(state.me.id));

  el.innerHTML = pageHead('Документы', 'Справки и отчёты о судействе') +
    '<div class="grid k2">' +
      '<div class="card"><h2 class="card-title">Отчёт о соревнованиях судьи</h2>' +
        '<p class="muted small">Все соревнования, на которых вы работали, с должностями.</p>' +
        '<a class="btn ghost" href="/api/reports/judge/' + esc(state.me.id) + '.docx">Скачать .docx</a>' +
      '</div>' +
      '<div class="card"><h2 class="card-title">Справки о составе коллегии</h2>' +
        (list.length
          ? '<ul class="plain">' + list.map(function (a) {
              return '<li>' + esc(a.competitionTitle) + ' — <a href="/api/reports/judges/' + esc(a.competitionId) + '.docx">скачать</a></li>';
            }).join('') + '</ul>'
          : '<p class="muted">Назначений пока нет.</p>') +
      '</div>' +
    '</div>';
}

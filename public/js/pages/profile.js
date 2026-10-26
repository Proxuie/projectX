// Профиль пользователя.
import { api } from '../api.js';
import { state, roleName, discName } from '../store.js';
import {
  esc, fmtDate, pageHead, toast, inputField, selectField, loading
} from '../ui.js';

export async function renderProfile(el) {
  el.innerHTML = pageHead('Профиль', 'Личные данные, согласия и привязки') + '<div id="profile">' + loading() + '</div>';

  var u = await api.get('/users/' + state.me.id);
  var links = await api.get('/trainer-links');
  var dict = state.dict;

  var discChecks = dict.disciplines.map(function (d) {
    return '<label class="check"><input type="checkbox" name="disc_' + esc(d.code) + '"' +
      (u.disciplines.indexOf(d.code) !== -1 ? ' checked' : '') + '> ' + esc(d.name) + '</label>';
  }).join('');

  var rusada = u.rusada || { passed: false, date: null, certUrl: null };
  var consent = u.consent || {};

  var myLinks = links.map(function (l) {
    var other = l.trainerId === u.id ? l.athleteFio : l.trainerFio;
    var roleLabel = l.trainerId === u.id ? 'Спортсмен' : 'Тренер';
    var actions = '';
    if (l.status === 'pending' && l.athleteId === u.id) {
      actions = '<button class="btn small" data-confirm="' + esc(l.id) + '">Подтвердить</button> ' +
        '<button class="btn small ghost" data-decline="' + esc(l.id) + '">Отклонить</button>';
    }
    return '<li class="link-row"><div><b>' + esc(other) + '</b> <span class="muted small">' + esc(roleLabel) +
      ' · ' + esc(discName(l.discipline)) + '</span></div><div>' +
      '<span class="chip chip-' + esc(l.status) + '">' + esc(l.status === 'pending' ? 'Ожидает' : l.status) + '</span> ' + actions + '</div></li>';
  }).join('');

  el.querySelector('#profile').innerHTML =
    '<div class="grid k2">' +
      '<div class="card"><div class="card-head"><h2 class="card-title">Личные данные</h2></div>' +
        '<form id="profile-form" class="form">' +
          '<div class="form-grid">' +
            inputField('ФИО', 'fio', u.fio) +
            inputField('Дата рождения', 'birthDate', u.birthDate, 'date', 'disabled') +
            inputField('Муниципалитет', 'municipality', u.municipality) +
            inputField('Год начала занятий', 'startYear', u.startYear, 'number') +
            inputField('Телефон', 'phone', u.phone) +
            inputField('Email', 'email', u.email) +
          '</div>' +
          '<div class="field"><span class="field-label">Дисциплины</span><div class="check-grid">' + discChecks + '</div></div>' +
          '<button class="btn" type="submit">Сохранить профиль</button>' +
        '</form>' +
      '</div>' +
      '<div class="card"><h2 class="card-title">Роли и разряд</h2>' +
        '<dl class="facts">' +
          '<dt>Роли</dt><dd>' + u.roles.map(function (r) { return esc(roleName(r)); }).join(', ') + '</dd>' +
          '<dt>Организация</dt><dd>' + esc(u.organizationName) + '</dd>' +
          '<dt>Разряд</dt><dd>' + esc(u.rank ? u.rank.title : '—') + (u.rank ? ' <span class="muted small">до ' + esc(fmtDate(u.rank.validUntil)) + '</span>' : '') + '</dd>' +
          '<dt>Категория</dt><dd>' + esc(u.judgeCategory ? u.judgeCategory.title : '—') + '</dd>' +
        '</dl>' +
        '<h3 class="sub">Согласие на обработку ПДн</h3>' +
        '<p class="muted small">' + (consent.pdp ? 'Получено ' + esc(fmtDate(consent.date)) : 'Не получено') + '</p>' +
        (consent.guardianFio ? '<p class="muted small">Законный представитель: ' + esc(consent.guardianFio) + '</p>' : '') +
      '</div>' +
    '</div>' +
    '<div class="grid k2 mt">' +
      '<div class="card"><h2 class="card-title">Антидопинг (РУСАДА)</h2>' +
        '<form id="rusada-form" class="form">' +
          '<label class="check"><input type="checkbox" name="passed"' + (rusada.passed ? ' checked' : '') + '> Курс пройден</label>' +
          '<div class="form-grid">' +
            inputField('Дата прохождения', 'date', rusada.date || '', 'date') +
            inputField('Ссылка на сертификат', 'certUrl', rusada.certUrl || '') +
          '</div>' +
          '<button class="btn ghost" type="submit">Сохранить отметку</button>' +
        '</form>' +
        '<p class="muted small">Актуальные материалы: <a href="https://rusada.ru/" target="_blank" rel="noopener">rusada.ru</a></p>' +
      '</div>' +
      '<div class="card"><h2 class="card-title">Привязки к тренерам</h2>' +
        (myLinks ? '<ul class="plain link-list">' + myLinks + '</ul>' : '<p class="muted">Привязок пока нет.</p>') +
      '</div>' +
    '</div>';

  var form = el.querySelector('#profile-form');
  form.onsubmit = function (e) {
    e.preventDefault();
    var data = {};
    ['fio', 'municipality', 'startYear', 'phone', 'email'].forEach(function (k) {
      data[k] = form.querySelector('[name=' + k + ']').value;
    });
    data.disciplines = dict.disciplines.map(function (d) { return d.code; })
      .filter(function (code) { return form.querySelector('[name="disc_' + code + '"]').checked; });

    api.put('/users/' + u.id, data).then(function () {
      toast('Профиль сохранён');
      window.dispatchEvent(new Event('refresh-me'));
    }).catch(function (err) { toast(err.message, 'error'); });
  };

  var rus = el.querySelector('#rusada-form');
  rus.onsubmit = function (e) {
    e.preventDefault();
    api.put('/users/' + u.id, {
      rusada: {
        passed: rus.querySelector('[name=passed]').checked,
        date: rus.querySelector('[name=date]').value || null,
        certUrl: rus.querySelector('[name=certUrl]').value || null
      }
    }).then(function () { toast('Отметка сохранена'); }).catch(function (err) { toast(err.message, 'error'); });
  };

  el.querySelectorAll('[data-confirm]').forEach(function (btn) {
    btn.onclick = function () {
      api.post('/trainer-links/' + btn.dataset.confirm + '/confirm').then(function () {
        toast('Привязка подтверждена');
        renderProfile(el);
      }).catch(function (err) { toast(err.message, 'error'); });
    };
  });

  el.querySelectorAll('[data-decline]').forEach(function (btn) {
    btn.onclick = function () {
      api.post('/trainer-links/' + btn.dataset.decline + '/decline').then(function () {
        toast('Запрос отклонён');
        renderProfile(el);
      }).catch(function (err) { toast(err.message, 'error'); });
    };
  });
}

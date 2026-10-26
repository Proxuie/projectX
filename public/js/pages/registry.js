// Реестр спортсменов, тренеров, судей и организаций.
import { api } from '../api.js';
import { state, roleName, discName } from '../store.js';
import {
  esc, fmtDate, daysText, statusChip, loading, pageHead, table, empty,
  inputField, selectField, openModal, closeModal, toast, readForm, confirmDialog
} from '../ui.js';

var ROLE_CODES = ['athlete', 'trainer', 'judge', 'federation', 'ministry'];

function rolesCell(u) {
  return u.roles.map(function (r) {
    return '<span class="chip chip-role">' + esc(roleName(r)) + '</span>';
  }).join(' ');
}

function rankCell(u) {
  if (!u.rank) return '—';
  var extra = '';
  if (u.rankDaysLeft !== null && u.rankDaysLeft < 0) {
    extra = ' <span class="chip chip-expired">истёк</span>';
  } else if (u.rankDaysLeft !== null && u.rankDaysLeft <= 30) {
    extra = ' <span class="chip chip-warn">' + esc(daysText(u.rankDaysLeft)) + '</span>';
  }
  return esc(u.rank.title) + extra;
}

function filterOptions(values) {
  return values.map(function (v) { return { value: v, label: v }; });
}

export async function renderRegistry(el) {
  var isFederation = state.role === 'federation';

  el.innerHTML = pageHead('Реестр',
    'Спортсмены, тренеры, судьи и организации региона',
    (isFederation ? '<button class="btn" id="add-user">Добавить пользователя</button>' : '') +
    '<a class="btn ghost" href="/api/reports/registry.xlsx">Экспорт .xlsx</a>') +
    '<div class="card">' +
      '<div class="filters" id="filters">' +
        '<label class="field search"><span class="field-label">Поиск</span>' +
          '<input class="input" id="f-q" type="search" placeholder="ФИО или логин"></label>' +
        '<label class="field"><span class="field-label">Роль</span><select class="input" id="f-role">' +
          '<option value="">Все</option><option value="athlete">Спортсмены</option><option value="trainer">Тренеры</option>' +
          '<option value="judge">Судьи</option><option value="federation">Федерация</option></select></label>' +
        '<label class="field"><span class="field-label">Дисциплина</span><select class="input" id="f-disc"><option value="">Все</option></select></label>' +
        '<label class="field"><span class="field-label">Организация</span><select class="input" id="f-org"><option value="">Все</option></select></label>' +
        '<label class="field"><span class="field-label">Разряд</span><select class="input" id="f-rank"><option value="">Все</option></select></label>' +
        '<label class="field"><span class="field-label">Возраст</span><select class="input" id="f-age"><option value="">Все</option></select></label>' +
        '<label class="field"><span class="field-label">Муниципалитет</span><select class="input" id="f-mun"><option value="">Все</option></select></label>' +
      '</div>' +
    '</div>' +
    '<div class="card mt" id="reg-table">' + loading() + '</div>';

  var dict = state.dict;
  var users = await api.get('/users');
  var orgs = await api.get('/organizations');

  var discSelect = el.querySelector('#f-disc');
  dict.disciplines.forEach(function (d) {
    discSelect.insertAdjacentHTML('beforeend', '<option value="' + esc(d.code) + '">' + esc(d.name) + '</option>');
  });

  var orgSelect = el.querySelector('#f-org');
  orgs.forEach(function (o) {
    orgSelect.insertAdjacentHTML('beforeend', '<option value="' + esc(o.id) + '">' + esc(o.name) + '</option>');
  });

  var rankSelect = el.querySelector('#f-rank');
  dict.ranks.forEach(function (r) {
    rankSelect.insertAdjacentHTML('beforeend', '<option value="' + esc(r) + '">' + esc(r) + '</option>');
  });

  var ageSelect = el.querySelector('#f-age');
  dict.ageGroups.forEach(function (g) {
    ageSelect.insertAdjacentHTML('beforeend', '<option value="' + esc(g.code) + '">' + esc(g.code) + ' лет</option>');
  });

  var muns = [...new Set(users.map(function (u) { return u.municipality; }).filter(Boolean))].sort();
  var munSelect = el.querySelector('#f-mun');
  muns.forEach(function (m) {
    munSelect.insertAdjacentHTML('beforeend', '<option value="' + esc(m) + '">' + esc(m) + '</option>');
  });

  function current() {
    var age = el.querySelector('#f-age').value;
    var group = dict.ageGroups.find(function (g) { return g.code === age; });
    return {
      q: el.querySelector('#f-q').value.trim().toLowerCase(),
      role: el.querySelector('#f-role').value,
      disc: el.querySelector('#f-disc').value,
      org: el.querySelector('#f-org').value,
      rank: el.querySelector('#f-rank').value,
      age: age,
      group: group,
      mun: el.querySelector('#f-mun').value
    };
  }

  function apply() {
    var f = current();
    var list = users.filter(function (u) {
      if (f.q && (u.fio + ' ' + u.login).toLowerCase().indexOf(f.q) === -1) return false;
      if (f.role && u.roles.indexOf(f.role) === -1) return false;
      if (f.disc && u.disciplines.indexOf(f.disc) === -1) return false;
      if (f.org && u.organizationId !== f.org) return false;
      if (f.rank && (!u.rank || u.rank.title !== f.rank)) return false;
      if (f.mun && u.municipality !== f.mun) return false;
      if (f.group && (u.age < f.group.from || u.age > f.group.to)) return false;
      return true;
    });

    list.sort(function (a, b) { return a.fio.localeCompare(b.fio); });

    var rows = list.map(function (u) {
      return [
        '<button class="link-btn" data-user="' + esc(u.id) + '">' + esc(u.fio) + '</button>' +
          (u.status === 'disqualified' ? ' <span class="chip chip-rejected">дискв.</span>' : ''),
        rolesCell(u),
        esc(u.organizationName || '—'),
        esc(u.disciplinesNames.map(function (n) { return n; }).join(', ') || '—'),
        rankCell(u),
        String(u.age)
      ];
    });

    el.querySelector('#reg-table').innerHTML = table(
      ['ФИО', 'Роли', 'Организация', 'Дисциплины', 'Разряд', 'Возраст'], rows,
      { emptyText: 'Никого не нашли', emptyHint: 'Попробуйте изменить фильтры.' }
    );

    el.querySelectorAll('[data-user]').forEach(function (btn) {
      btn.onclick = function () { openUser(btn.dataset.user); };
    });
  }

  el.querySelector('#f-q').addEventListener('input', apply);
  ['#f-role', '#f-disc', '#f-org', '#f-rank', '#f-age', '#f-mun'].forEach(function (sel) {
    el.querySelector(sel).addEventListener('change', apply);
  });

  function openUser(id) {
    api.get('/users/' + id).then(function (u) {
      var facts =
        '<dl class="facts">' +
          '<dt>Дата рождения</dt><dd>' + esc(fmtDate(u.birthDate)) + ' (' + u.age + ' лет)</dd>' +
          '<dt>Муниципалитет</dt><dd>' + esc(u.municipality || '—') + '</dd>' +
          '<dt>Организация</dt><dd>' + esc(u.organizationName) + '</dd>' +
          '<dt>Дисциплины</dt><dd>' + esc(u.disciplinesNames.join(', ') || '—') + '</dd>' +
          '<dt>Год начала</dt><dd>' + esc(u.startYear || '—') + '</dd>' +
          '<dt>Разряд</dt><dd>' + rankCell(u) + '</dd>' +
          '<dt>Судейская категория</dt><dd>' + esc(u.judgeCategory ? u.judgeCategory.title : '—') +
            (u.categoryDaysLeft !== null ? ' <span class="muted small">(' + esc(daysText(u.categoryDaysLeft)) + ')</span>' : '') + '</dd>' +
          '<dt>РУСАДА</dt><dd>' + (u.rusada && u.rusada.passed ? 'курс пройден, ' + esc(fmtDate(u.rusada.date)) : 'не отмечен') + '</dd>' +
          '<dt>Согласие ПДн</dt><dd>' + (u.consent && u.consent.pdp ? 'получено, ' + esc(fmtDate(u.consent.date)) : 'нет') + '</dd>' +
          (u.consent && u.consent.guardianFio ? '<dt>Представитель</dt><dd>' + esc(u.consent.guardianFio) + '</dd>' : '') +
        '</dl>';

      var trainers = u.trainers.length
        ? '<h3 class="sub">Тренеры</h3><ul class="plain">' + u.trainers.map(function (t) {
            return '<li>' + esc(t.fio) + ' — ' + esc(discName(t.discipline)) + ' (' + esc(t.status) + ')</li>';
          }).join('') + '</ul>'
        : '';

      var results = u.results.length
        ? '<h3 class="sub">История выступлений</h3>' + table(
            ['Соревнование', 'Дата', 'Место', 'Баллы'],
            u.results.map(function (r) {
              return [esc(r.title), esc(fmtDate(r.date)), String(r.place || '—'), String(r.points || 0)];
            }))
        : '';

      var body = '<div class="user-head"><span class="avatar big">' + esc(u.fio.slice(0, 1)) + '</span>' +
        '<div><h2>' + esc(u.fio) + '</h2><div>' + rolesCell(u) + '</div></div></div>' + facts + trainers + results;

      var footer = isFederation
        ? '<button class="btn" id="edit-user">Редактировать</button><button class="btn ghost" id="close-user">Закрыть</button>'
        : '<button class="btn ghost" id="close-user">Закрыть</button>';

      var card = openModal('Карточка пользователя', body, footer);
      card.querySelector('#close-user').onclick = closeModal;
      if (isFederation) {
        card.querySelector('#edit-user').onclick = function () {
          closeModal();
          openEdit(u);
        };
      }
    }).catch(function (e) { toast(e.message, 'error'); });
  }

  function rankOptions(value) {
    var opts = [{ value: '', label: '— нет —' }].concat(dict.ranks.map(function (r) { return { value: r, label: r }; }));
    return opts;
  }

  function openEdit(u) {
    var rolesChecks = ROLE_CODES.map(function (r) {
      return '<label class="check"><input type="checkbox" name="role_' + r + '"' +
        (u.roles.indexOf(r) !== -1 ? ' checked' : '') + '> ' + esc(roleName(r)) + '</label>';
    }).join('');

    var discChecks = dict.disciplines.map(function (d) {
      return '<label class="check"><input type="checkbox" name="disc_' + esc(d.code) + '"' +
        (u.disciplines.indexOf(d.code) !== -1 ? ' checked' : '') + '> ' + esc(d.name) + '</label>';
    }).join('');

    var body = '<form id="edit-form" class="form">' +
      '<div class="form-grid">' +
        inputField('ФИО', 'fio', u.fio) +
        inputField('Дата рождения', 'birthDate', u.birthDate, 'date') +
        inputField('Муниципалитет', 'municipality', u.municipality) +
        inputField('Телефон', 'phone', u.phone) +
      '</div>' +
      '<div class="field"><span class="field-label">Роли</span><div class="check-grid">' + rolesChecks + '</div></div>' +
      '<div class="field"><span class="field-label">Дисциплины</span><div class="check-grid">' + discChecks + '</div></div>' +
      '<div class="form-grid">' +
        selectField('Разряд', 'rankTitle', rankOptions(), u.rank ? u.rank.title : '') +
        inputField('Разряд действует до', 'rankUntil', u.rank ? u.rank.validUntil : '', 'date') +
        selectField('Статус', 'status', [{ value: 'active', label: 'Активен' }, { value: 'disqualified', label: 'Дисквалифицирован' }], u.status) +
      '</div>' +
    '</form>';

    var card = openModal('Редактирование', body,
      '<button class="btn" id="save-user">Сохранить</button><button class="btn ghost" id="cancel-user">Отмена</button>');

    card.querySelector('#cancel-user').onclick = closeModal;
    card.querySelector('#save-user').onclick = function () {
      var form = card.querySelector('#edit-form');
      var data = readForm(form);
      var roles = ROLE_CODES.filter(function (r) { return data['role_' + r]; });
      var disciplines = dict.disciplines.map(function (d) { return d.code; })
        .filter(function (code) { return data['disc_' + code]; });

      var payload = {
        fio: data.fio,
        birthDate: data.birthDate,
        municipality: data.municipality,
        phone: data.phone,
        roles: roles.length ? roles : [u.roles[0]],
        disciplines: disciplines,
        status: data.status,
        rank: data.rankTitle ? { title: data.rankTitle, validUntil: data.rankUntil || null, date: u.rank ? u.rank.date : null, orderNumber: u.rank ? u.rank.orderNumber : null } : null
      };

      api.put('/users/' + u.id, payload).then(function () {
        toast('Сохранено');
        closeModal();
        api.get('/users').then(function (list) {
          users = list;
          apply();
        });
      }).catch(function (e) { toast(e.message, 'error'); });
    };
  }

  var addBtn = el.querySelector('#add-user');
  if (addBtn) {
    addBtn.onclick = function () {
      var body = '<form id="add-form" class="form">' +
        '<div class="form-grid">' +
          inputField('ФИО', 'fio', '') +
          inputField('Логин', 'login', '') +
          inputField('Дата рождения', 'birthDate', '', 'date') +
          inputField('Пароль (по умолчанию demo123)', 'password', '') +
        '</div>' +
        '<div class="form-grid">' +
          selectField('Роль', 'role', ROLE_CODES.map(function (r) { return { value: r, label: roleName(r) }; }), 'athlete') +
          selectField('Организация', 'organizationId', [{ value: '', label: 'Без организации' }].concat(
            orgs.map(function (o) { return { value: o.id, label: o.name }; })), '') +
          selectField('Разряд', 'rankTitle', rankOptions(), '') +
        '</div>' +
        '<div class="field"><span class="field-label">Дисциплины</span><div class="check-grid">' +
          dict.disciplines.map(function (d) {
            return '<label class="check"><input type="checkbox" name="disc_' + esc(d.code) + '"> ' + esc(d.name) + '</label>';
          }).join('') + '</div></div>' +
      '</form>';

      var card = openModal('Новый пользователь', body,
        '<button class="btn" id="create-user">Создать</button><button class="btn ghost" id="cancel-add">Отмена</button>');

      card.querySelector('#cancel-add').onclick = closeModal;
      card.querySelector('#create-user').onclick = function () {
        var data = readForm(card.querySelector('#add-form'));
        var disciplines = dict.disciplines.map(function (d) { return d.code; })
          .filter(function (code) { return data['disc_' + code]; });

        if (!data.fio || !data.login) return toast('Нужны ФИО и логин', 'error');

        api.post('/users', {
          fio: data.fio,
          login: data.login,
          password: data.password || 'demo123',
          birthDate: data.birthDate || '2000-01-01',
          roles: [data.role],
          organizationId: data.organizationId || null,
          disciplines: disciplines,
          rank: data.rankTitle ? { title: data.rankTitle, validUntil: null, date: null, orderNumber: null } : null
        }).then(function () {
          toast('Пользователь создан');
          closeModal();
          return api.get('/users').then(function (list) { users = list; apply(); });
        }).catch(function (e) { toast(e.message, 'error'); });
      };
    };
  }

  apply();
}

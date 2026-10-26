// Кабинет тренера.
import { api } from '../api.js';
import { state, discName } from '../store.js';
import {
  esc, fmtDate, daysText, statusChip, loading, pageHead, table, empty,
  selectField, openModal, closeModal, toast
} from '../ui.js';

function activeLinks(links) {
  return links.filter(function (l) { return l.status === 'active'; });
}

export async function renderMyAthletes(el) {
  var links = await api.get('/trainer-links');
  var athletes = await api.get('/users?role=athlete');

  el.innerHTML = pageHead('Мои спортсмены', 'Привязки по дисциплинам и статусы',
    '<button class="btn" id="add-link">Пригласить спортсмена</button>') +
    '<div class="card" id="links">' + loading() + '</div>';

  function render() {
    var rows = links.map(function (l) {
      var actions = '';
      if (l.status === 'pending') {
        actions = '<button class="btn small ghost" data-cancel="' + esc(l.id) + '">Отменить запрос</button>';
      }
      return [
        '<a class="link-btn" href="#/competitions">' + esc(l.athleteFio) + '</a>',
        esc(discName(l.discipline)),
        '<span class="chip chip-' + esc(l.status) + '">' + esc(l.status === 'pending' ? 'Ожидает подтверждения' : l.status === 'active' ? 'Активна' : 'Завершена') + '</span>',
        esc(fmtDate((l.history && l.history[0] ? l.history[0].date : ''))),
        actions
      ];
    });

    el.querySelector('#links').innerHTML = table(
      ['Спортсмен', 'Дисциплина', 'Статус', 'С', ''], rows,
      { emptyText: 'Пока нет привязанных спортсменов', emptyHint: 'Отправьте запрос — спортсмен подтвердит его в профиле.' }
    );

    el.querySelectorAll('[data-cancel]').forEach(function (btn) {
      btn.onclick = function () {
        api.post('/trainer-links/' + btn.dataset.cancel + '/decline').then(function () {
          toast('Запрос отменён');
          return api.get('/trainer-links').then(function (list) { links = list; render(); });
        }).catch(function (err) { toast(err.message, 'error'); });
      };
    });
  }

  render();

  el.querySelector('#add-link').onclick = function () {
    var body = '<form id="link-form" class="form">' +
      selectField('Спортсмен', 'athleteId', athletes.map(function (a) { return { value: a.id, label: a.fio }; }), '') +
      selectField('Дисциплина', 'discipline', state.dict.disciplines.map(function (d) { return { value: d.code, label: d.name }; }), 'algo') +
      '<p class="muted small">Спортсмен получит уведомление и подтвердит привязку.</p>' +
    '</form>';

    var card = openModal('Пригласить спортсмена', body,
      '<button class="btn" id="link-ok">Отправить запрос</button><button class="btn ghost" id="link-cancel">Отмена</button>');

    card.querySelector('#link-cancel').onclick = closeModal;
    card.querySelector('#link-ok').onclick = function () {
      var form = card.querySelector('#link-form');
      api.post('/trainer-links', {
        athleteId: form.querySelector('[name=athleteId]').value,
        discipline: form.querySelector('[name=discipline]').value
      }).then(function () {
        closeModal();
        toast('Запрос отправлен');
        return api.get('/trainer-links').then(function (list) { links = list; render(); });
      }).catch(function (err) { toast(err.message, 'error'); });
    };
  };
}

export async function renderTrainerApplications(el) {
  var apps = await api.get('/applications');
  var links = activeLinks(await api.get('/trainer-links'));
  var comps = await api.get('/competitions');

  el.innerHTML = pageHead('Заявки подопечных', 'Подача и отслеживание статусов',
    '<button class="btn" id="apply-for">Подать заявку</button>') +
    '<div class="card" id="t-apps">' + loading() + '</div>';

  el.querySelector('#t-apps').innerHTML = table(
    ['Спортсмен', 'Соревнование', 'Дата', 'Статус'],
    apps.map(function (a) {
      return [
        esc(a.fio),
        esc(a.competitionTitle),
        esc(fmtDate(a.competitionDate)),
        statusChip(a.status) + (a.comment ? '<div class="muted small">' + esc(a.comment) + '</div>' : '')
      ];
    }),
    { emptyText: 'Заявок нет', emptyHint: 'Подайте заявку за привязанного спортсмена.' }
  );

  el.querySelector('#apply-for').onclick = function () {
    if (!links.length) return toast('Сначала привяжите спортсмена', 'error');

    var open = comps.filter(function (c) { return c.status === 'registration'; });
    if (!open.length) return toast('Нет соревнований с открытым приёмом заявок', 'error');

    var body = '<form id="ap-form" class="form">' +
      selectField('Спортсмен', 'athleteId', links.map(function (l) {
        return { value: l.athleteId, label: l.athleteFio };
      }), '') +
      selectField('Соревнование', 'competitionId', open.map(function (c) {
        return { value: c.id, label: c.title };
      }), '') +
    '</form>';

    var card = openModal('Заявка за спортсмена', body,
      '<button class="btn" id="ap-ok">Подать</button><button class="btn ghost" id="ap-cancel">Отмена</button>');

    card.querySelector('#ap-cancel').onclick = closeModal;
    card.querySelector('#ap-ok').onclick = function () {
      var form = card.querySelector('#ap-form');
      api.post('/applications', {
        competitionId: form.querySelector('[name=competitionId]').value,
        athleteId: form.querySelector('[name=athleteId]').value
      }).then(function () {
        closeModal();
        toast('Заявка подана');
        renderTrainerApplications(el);
      }).catch(function (err) { toast(err.message, 'error'); });
    };
  };
}

export async function renderTrainerRanks(el) {
  var links = activeLinks(await api.get('/trainer-links'));
  var apps = await api.get('/ranks/applications');

  var athletes = await Promise.all(links.map(function (l) {
    return api.get('/users/' + l.athleteId).then(function (u) { return u; });
  }));

  el.innerHTML = pageHead('Разряды подопечных', 'Сроки действия и заявки на присвоение') +
    '<div class="grid k2">' +
      '<div class="card"><h2 class="card-title">Мои спортсмены</h2><div id="wards">' + loading() + '</div></div>' +
      '<div class="card"><h2 class="card-title">Заявки</h2><div id="ward-apps">' + loading() + '</div></div>' +
    '</div>';

  el.querySelector('#wards').innerHTML = table(
    ['Спортсмен', 'Разряд', 'Действует до', 'Осталось', ''],
    athletes.map(function (u) {
      var days = u.rank ? Math.round((new Date(u.rank.validUntil) - new Date()) / 86400000) : null;
      return [
        esc(u.fio),
        esc(u.rank ? u.rank.title : '—'),
        esc(u.rank ? fmtDate(u.rank.validUntil) : '—'),
        '<span class="' + (days === null ? 'chip chip-muted' : days < 0 ? 'chip chip-expired' : days <= 30 ? 'chip chip-warn' : 'chip chip-ok') + '">' + esc(daysText(days)) + '</span>',
        '<button class="btn small ghost" data-ward="' + esc(u.id) + '">Заявка</button>'
      ];
    }),
    { emptyText: 'Нет привязанных спортсменов' }
  );

  el.querySelector('#ward-apps').innerHTML = table(
    ['Спортсмен', 'Разряд', 'Статус'],
    apps.map(function (a) {
      return [esc(a.fio), esc(a.requestedRank), statusChip(a.status)];
    }),
    { emptyText: 'Заявок нет' }
  );

  el.querySelectorAll('[data-ward]').forEach(function (btn) {
    btn.onclick = function () {
      var u = athletes.find(function (x) { return x.id === btn.dataset.ward; });
      if (!u) return;

      if (!u.results.length) return toast('У спортсмена нет результатов', 'error');

      var body = '<form id="ward-form" class="form">' +
        selectField('Основание', 'result', u.results.map(function (r) {
          return { value: r.id, label: r.title + ' — ' + (r.place || '—') + ' место' };
        }), u.results[0].id) +
        selectField('Разряд', 'rank', state.dict.ranks.map(function (r) { return { value: r, label: r }; }), state.dict.ranks[0]) +
      '</form>';

      var card = openModal('Заявка на разряд — ' + u.fio, body,
        '<button class="btn" id="ward-ok">Подать</button><button class="btn ghost" id="ward-cancel">Отмена</button>');

      card.querySelector('#ward-cancel').onclick = closeModal;
      card.querySelector('#ward-ok').onclick = function () {
        var form = card.querySelector('#ward-form');
        var resultId = form.querySelector('[name=result]').value;
        var result = u.results.find(function (r) { return r.id === resultId; });

        api.post('/ranks/applications', {
          athleteId: u.id,
          competitionId: result.competitionId,
          resultId: result.id,
          requestedRank: form.querySelector('[name=rank]').value
        }).then(function () {
          closeModal();
          toast('Заявка подана');
          renderTrainerRanks(el);
        }).catch(function (err) { toast(err.message, 'error'); });
      };
    };
  });
}

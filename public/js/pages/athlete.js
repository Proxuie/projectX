// Кабинет спортсмена.
import { api } from '../api.js';
import { state, discName, levelName, formatName } from '../store.js';
import {
  esc, fmtDate, daysText, statusChip, loading, pageHead, table, empty,
  selectField, openModal, closeModal, toast, confirmDialog
} from '../ui.js';

function ageAt(birthDate, dateStr) {
  var b = new Date(birthDate);
  var d = dateStr ? new Date(dateStr) : new Date();
  var age = d.getFullYear() - b.getFullYear();
  var m = d.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && d.getDate() < b.getDate())) age--;
  return age;
}

function fits(user, comp) {
  var group = state.dict.ageGroups.find(function (g) { return g.code === comp.ageGroup; });
  if (!group) return true;
  var age = ageAt(user.birthDate, comp.startDate);
  return age >= group.from && age <= group.to;
}

export async function renderCalendar(el) {
  var me = await api.get('/users/' + state.me.id);
  var comps = await api.get('/competitions');
  var apps = await api.get('/applications');

  el.innerHTML = pageHead('Календарь', 'Соревнования, куда вы проходите по возрасту') +
    '<div class="card"><div class="filters">' +
      '<label class="field"><span class="field-label">Дисциплина</span><select class="input" id="cal-disc"><option value="">Все</option></select></label>' +
      '<label class="field"><span class="field-label">Только доступные</span><select class="input" id="cal-fit">' +
        '<option value="">Все</option><option value="1">Прохожу по возрасту</option></select></label>' +
    '</div></div>' +
    '<div class="card mt" id="cal">' + loading() + '</div>';

  var discSelect = el.querySelector('#cal-disc');
  state.dict.disciplines.forEach(function (d) {
    discSelect.insertAdjacentHTML('beforeend', '<option value="' + esc(d.code) + '">' + esc(d.name) + '</option>');
  });

  function apply() {
    var disc = discSelect.value;
    var onlyFit = el.querySelector('#cal-fit').value === '1';

    var list = comps.filter(function (c) {
      if (disc && c.discipline !== disc) return false;
      if (onlyFit && !fits(me, c)) return false;
      return true;
    });

    var rows = list.map(function (c) {
      var my = apps.find(function (a) { return a.competitionId === c.id; });
      var action = '';
      if (my) action = statusChip(my.status);
      else if (c.status === 'registration' && fits(me, c)) {
        action = '<button class="btn small" data-apply="' + esc(c.id) + '">Подать заявку</button>';
      } else if (!fits(me, c)) {
        action = '<span class="chip chip-muted">не проходите</span>';
      } else {
        action = '<span class="muted small">приём не открыт</span>';
      }

      return [
        esc(fmtDate(c.startDate)),
        '<a class="link-btn" href="#/competitions/' + esc(c.id) + '">' + esc(c.title) + '</a>',
        esc(c.disciplineName),
        esc(c.ageGroup),
        esc(formatName(c.format)),
        action
      ];
    });

    el.querySelector('#cal').innerHTML = table(
      ['Дата', 'Соревнование', 'Дисциплина', 'Возраст', 'Формат', 'Заявка'], rows,
      { emptyText: 'Соревнований не найдено', emptyHint: 'Попробуйте выбрать другую дисциплину.' }
    );

    el.querySelectorAll('[data-apply]').forEach(function (btn) {
      btn.onclick = function () {
        api.post('/applications', { competitionId: btn.dataset.apply }).then(function () {
          toast('Заявка подана');
          renderCalendar(el);
        }).catch(function (err) { toast(err.message, 'error'); });
      };
    });
  }

  discSelect.addEventListener('change', apply);
  el.querySelector('#cal-fit').addEventListener('change', apply);
  apply();
}

export async function renderMyApplications(el) {
  var apps = await api.get('/applications');

  el.innerHTML = pageHead('Мои заявки', 'Статусы и причины отказа') +
    '<div class="card">' + loading() + '</div>';

  function render() {
    el.querySelector('.card').innerHTML = table(
      ['Соревнование', 'Дата', 'Подана', 'Статус', ''],
      apps.map(function (a) {
        return [
          '<a class="link-btn" href="#/competitions/' + esc(a.competitionId) + '">' + esc(a.competitionTitle) + '</a>',
          esc(fmtDate(a.competitionDate)),
          esc(fmtDate(a.createdAt)),
          statusChip(a.status) + (a.comment ? '<div class="muted small">' + esc(a.comment) + '</div>' : ''),
          a.status === 'pending' ? '<button class="btn small ghost" data-withdraw="' + esc(a.id) + '">Отозвать</button>' : ''
        ];
      }),
      { emptyText: 'Заявок пока нет', emptyHint: 'Выберите соревнование в календаре.' }
    );

    el.querySelectorAll('[data-withdraw]').forEach(function (btn) {
      btn.onclick = async function () {
        if (!(await confirmDialog('Отозвать заявку?', 'Отозвать'))) return;
        api.del('/applications/' + btn.dataset.withdraw).then(function () {
          toast('Заявка отозвана');
          api.get('/applications').then(function (list) { apps = list; render(); });
        }).catch(function (err) { toast(err.message, 'error'); });
      };
    });
  }

  render();
}

export async function renderMyResults(el) {
  var me = await api.get('/users/' + state.me.id);

  el.innerHTML = pageHead('История выступлений', 'Результаты и протоколы') +
    '<div class="card" id="results">' + loading() + '</div>';

  var results = me.results;

  el.querySelector('#results').innerHTML = table(
    ['Соревнование', 'Дата', 'Дисциплина', 'Место', 'Баллы', 'Протокол'],
    results.map(function (r) {
      return [
        esc(r.title),
        esc(fmtDate(r.date)),
        esc(discName(r.discipline)),
        r.place ? String(r.place) : '—',
        String(r.points || 0),
        r.protocolId ? '<button class="btn small ghost" data-protocol="' + esc(r.protocolId) + '">Открыть</button>' : '—'
      ];
    }),
    { emptyText: 'Выступлений пока нет', emptyHint: 'Результаты появятся после публикации протоколов.' }
  );

  el.querySelectorAll('[data-protocol]').forEach(function (btn) {
    btn.onclick = function () {
      api.get('/protocols/' + btn.dataset.protocol).then(function (p) {
        var rows = p.rows.map(function (r) {
          return [String(r.line), esc(r.fio), esc(r.organization), String(r.place || '—'), String(r.points)];
        });
        var card = openModal('Протокол',
          '<p class="muted small">' + esc(p.competition ? p.competition.title : '') + '</p>' +
          table(['№', 'ФИО', 'Организация', 'Место', 'Баллы'], rows),
          '<a class="btn ghost" href="/api/protocols/' + esc(p.id) + '/docx">Скачать .docx</a>' +
          '<button class="btn ghost" id="pr-close">Закрыть</button>');
        card.querySelector('#pr-close').onclick = closeModal;
      }).catch(function (err) { toast(err.message, 'error'); });
    };
  });
}

export async function renderMyRank(el) {
  var me = await api.get('/users/' + state.me.id);
  var apps = await api.get('/ranks/applications');
  var links = await api.get('/trainer-links');
  var hasTrainer = links.some(function (l) { return l.status === 'active' && l.athleteId === me.id; });

  var rank = me.rank;
  var days = rank ? Math.round((new Date(rank.validUntil) - new Date()) / 86400000) : null;

  var rankCard = '<div class="card"><h2 class="card-title">Текущий разряд</h2>' +
    (rank
      ? '<div class="rank-big">' + esc(rank.title) + '</div>' +
        '<dl class="facts">' +
          '<dt>Присвоен</dt><dd>' + esc(fmtDate(rank.date)) + '</dd>' +
          '<dt>Приказ</dt><dd>' + esc(rank.orderNumber || '—') + '</dd>' +
          '<dt>Действует до</dt><dd>' + esc(fmtDate(rank.validUntil)) + '</dd>' +
          '<dt>Осталось</dt><dd>' + esc(daysText(days)) + '</dd>' +
        '</dl>' +
        (days !== null && days <= 30 ? '<p class="alert">Разряд истекает. Подайте заявку на подтверждение.</p>' : '')
      : '<p class="muted">Разряд пока не присвоен.</p>') +
    '</div>';

  var results = me.results;
  var compOptions = [];
  var seen = {};
  results.forEach(function (r) {
    if (seen[r.competitionId]) return;
    seen[r.competitionId] = true;
    compOptions.push({ value: r.competitionId, label: r.title + ' — ' + (r.place || '—') + ' место' });
  });

  var applicable = compOptions.map(function (c) {
    var result = results.find(function (r) { return r.competitionId === c.value; });
    return { comp: c, resultId: result.id };
  });

  var formHtml = applicable.length
    ? '<div class="card mt"><h2 class="card-title">Подать заявку на разряд</h2>' +
      (hasTrainer ? '<p class="muted small">У вас есть тренер — заявку обычно подаёт он, но вы можете подать сами.</p>' : '') +
      '<form id="rank-apply" class="form">' +
        selectField('Основание (соревнование и результат)', 'comp', applicable.map(function (a) { return a.comp; }), applicable[0].comp.value) +
        selectField('Запрашиваемый разряд', 'rank', state.dict.ranks.map(function (r) { return { value: r, label: r }; }), state.dict.ranks[0]) +
        '<button class="btn" type="submit">Подать заявку</button>' +
      '</form></div>'
    : '<div class="card mt"><p class="muted">Пока нет результатов, на основании которых можно подать заявку.</p></div>';

  var appsTable = table(
    ['Дата', 'Разряд', 'Основание', 'Статус'],
    apps.map(function (a) {
      return [
        esc(fmtDate(a.createdAt)),
        esc(a.requestedRank),
        esc(a.competitionTitle),
        statusChip(a.status) + (a.comment ? '<div class="muted small">' + esc(a.comment) + '</div>' : '')
      ];
    }),
    { emptyText: 'Заявок нет' }
  );

  el.innerHTML = pageHead('Разряд', 'Срок действия и заявки') +
    '<div class="grid k2">' + rankCard +
      '<div class="card"><h2 class="card-title">Мои заявки</h2>' + appsTable + '</div>' +
    '</div>' + formHtml;

  var form = el.querySelector('#rank-apply');
  if (form) {
    form.onsubmit = function (e) {
      e.preventDefault();
      var compId = form.querySelector('[name=comp]').value;
      var found = applicable.find(function (a) { return a.comp.value === compId; });
      api.post('/ranks/applications', {
        competitionId: compId,
        resultId: found.resultId,
        requestedRank: form.querySelector('[name=rank]').value
      }).then(function () {
        toast('Заявка подана');
        renderMyRank(el);
      }).catch(function (err) { toast(err.message, 'error'); });
    };
  }
}

export async function renderDocuments(el) {
  var me = await api.get('/users/' + state.me.id);
  var certs = await api.get('/certificates');

  var consent = me.consent || {};

  var results = me.results.filter(function (r) { return r.protocolId; });

  var certsRows = certs.map(function (c) {
    return [
      esc(c.number),
      esc(c.competitionTitle),
      esc(fmtDate(c.createdAt)),
      '<button class="btn small ghost" data-qr="' + esc(c.id) + '">QR</button>',
      '<a class="btn small ghost" href="#/verify/' + esc(c.verifyCode) + '">Проверить</a>'
    ];
  });

  el.innerHTML = pageHead('Документы', 'Согласия, антидопинг и справки об участии') +
    '<div class="grid k2">' +
      '<div class="card"><h2 class="card-title">Согласия</h2>' +
        '<dl class="facts">' +
          '<dt>Согласие на обработку ПДн</dt><dd>' + (consent.pdp ? 'получено ' + esc(fmtDate(consent.date)) : 'нет') + '</dd>' +
          (consent.guardianFio ? '<dt>Законный представитель</dt><dd>' + esc(consent.guardianFio) + '</dd>' : '') +
          '<dt>РУСАДА</dt><dd>' + (me.rusada && me.rusada.passed ? 'курс пройден ' + esc(fmtDate(me.rusada.date)) : 'не отмечен') + '</dd>' +
        '</dl>' +
        '<p class="muted small"><a href="https://rusada.ru/" target="_blank" rel="noopener">rusada.ru</a> — актуальные антидопинговые материалы.</p>' +
      '</div>' +
      '<div class="card"><h2 class="card-title">Справка об участии</h2>' +
        (results.length
          ? '<p class="muted small">Выберите соревнование с опубликованным протоколом.</p>' +
            '<div class="check-col">' + results.map(function (r) {
              return '<button class="btn ghost" data-cert="' + esc(r.competitionId) + '">' +
                esc(r.title) + ' — ' + (r.place || '—') + ' место</button>';
            }).join('') + '</div>'
          : '<p class="muted">Справку можно получить после публикации протокола соревнования.</p>') +
      '</div>' +
    '</div>' +
    '<div class="card mt"><div class="card-head"><h2 class="card-title">Мои справки</h2></div>' +
      table(['Номер', 'Соревнование', 'Выдана', 'QR', 'Проверка'], certsRows, { emptyText: 'Справок пока нет' }) +
    '</div>';

  el.querySelectorAll('[data-cert]').forEach(function (btn) {
    btn.onclick = function () {
      api.post('/certificates', { competitionId: btn.dataset.cert }).then(function () {
        toast('Справка сформирована');
        renderDocuments(el);
      }).catch(function (err) { toast(err.message, 'error'); });
    };
  });

  el.querySelectorAll('[data-qr]').forEach(function (btn) {
    btn.onclick = function () {
      api.get('/certificates/' + btn.dataset.qr + '/qr').then(function (data) {
        var card = openModal('QR-код справки',
          '<div class="qr-wrap"><img src="' + data.dataUrl + '" alt="QR">' +
          '<p class="muted small">' + esc(data.url) + '</p></div>' +
          '<p class="muted small">Покажите QR для проверки подлинности справки.</p>',
          '<button class="btn ghost" id="doc-qr-close">Закрыть</button>');
        card.querySelector('#doc-qr-close').onclick = closeModal;
      }).catch(function (err) { toast(err.message, 'error'); });
    };
  });
}

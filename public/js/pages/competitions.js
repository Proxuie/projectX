// Календарь соревнований и карточка соревнования.
import { api } from '../api.js';
import { state, discName, levelName, typeName, formatName } from '../store.js';
import {
  esc, fmtDate, daysText, statusChip, loading, pageHead, table, empty,
  inputField, selectField, textareaField, openModal, closeModal, toast, confirmDialog, readForm
} from '../ui.js';

var STATUS_ACTIONS = [
  { status: 'published', label: 'Опубликовать', show: ['draft'] },
  { status: 'registration', label: 'Открыть приём заявок', show: ['published', 'draft', 'closed'] },
  { status: 'closed', label: 'Закрыть приём заявок', show: ['registration'] }
];

export async function renderCompetitions(el) {
  var isFed = state.role === 'federation';

  el.innerHTML = pageHead('Календарь соревнований',
    'Региональные, межрегиональные и всероссийские старты',
    (isFed ? '<button class="btn" id="create-comp">Создать соревнование</button>' : '')) +
    '<div class="card"><div class="filters">' +
      '<label class="field search"><span class="field-label">Поиск</span>' +
        '<input class="input" id="c-q" type="search" placeholder="Название"></label>' +
      '<label class="field"><span class="field-label">Дисциплина</span><select class="input" id="c-disc"><option value="">Все</option></select></label>' +
      '<label class="field"><span class="field-label">Статус</span><select class="input" id="c-status"><option value="">Все</option>' +
        '<option value="registration">Приём заявок</option><option value="published">Опубликовано</option>' +
        '<option value="closed">Приём закрыт</option><option value="finished">Завершено</option></select></label>' +
    '</div></div>' +
    '<div class="card mt" id="comps">' + loading() + '</div>';

  var data = await api.get('/competitions');
  var dict = state.dict;

  var discSelect = el.querySelector('#c-disc');
  dict.disciplines.forEach(function (d) {
    discSelect.insertAdjacentHTML('beforeend', '<option value="' + esc(d.code) + '">' + esc(d.name) + '</option>');
  });

  function apply() {
    var q = el.querySelector('#c-q').value.trim().toLowerCase();
    var disc = discSelect.value;
    var status = el.querySelector('#c-status').value;

    var list = data.filter(function (c) {
      if (q && c.title.toLowerCase().indexOf(q) === -1) return false;
      if (disc && c.discipline !== disc) return false;
      if (status && c.status !== status) return false;
      return true;
    });

    var rows = list.map(function (c) {
      return [
        '<a class="link-btn" href="#/competitions/' + esc(c.id) + '">' + esc(c.title) + '</a>' +
          (c.calendarPlan ? ' <span class="chip chip-plan">' + (c.calendarPlan === 'ekp' ? 'ЕКП' : 'план области') + '</span>' : ''),
        esc(c.disciplineName),
        esc(c.levelName),
        esc(fmtDate(c.startDate)) + (c.endDate && c.endDate !== c.startDate ? ' — ' + esc(fmtDate(c.endDate)) : ''),
        statusChip(c.status),
        String(c.approvedCount) + ' / ' + String(c.applicationsCount)
      ];
    });

    el.querySelector('#comps').innerHTML = table(
      ['Соревнование', 'Дисциплина', 'Уровень', 'Даты', 'Статус', 'Участники'], rows,
      { emptyText: 'Соревнований не найдено', emptyHint: 'Измените фильтры или создайте новое.' }
    );
  }

  el.querySelector('#c-q').addEventListener('input', apply);
  discSelect.addEventListener('change', apply);
  el.querySelector('#c-status').addEventListener('change', apply);
  apply();

  var createBtn = el.querySelector('#create-comp');
  if (createBtn) {
    createBtn.onclick = function () {
      var body = '<form id="comp-form" class="form">' +
        inputField('Название', 'title', '') +
        '<div class="form-grid">' +
          selectField('Дисциплина', 'discipline', dict.disciplines.map(function (d) { return { value: d.code, label: d.name }; }), 'algo') +
          selectField('Уровень', 'level', [
            { value: 'regional', label: 'Региональное' },
            { value: 'interregional', label: 'Межрегиональное' },
            { value: 'perv_ru', label: 'Первенство России' },
            { value: 'champ_ru', label: 'Чемпионат России' }
          ], 'regional') +
        '</div>' +
        '<div class="form-grid">' +
          selectField('Тип', 'typeId', dict.competitionTypes.map(function (t) { return { value: t.id, label: t.name }; }), 'ct_2') +
          selectField('Возрастная группа', 'ageGroup', dict.ageGroups.map(function (g) { return { value: g.code, label: g.code }; }), '14-17') +
        '</div>' +
        '<div class="form-grid">' +
          inputField('Дата начала', 'startDate', '', 'date') +
          inputField('Дата окончания', 'endDate', '', 'date') +
        '</div>' +
        '<div class="form-grid">' +
          selectField('Формат', 'format', [
            { value: 'offline', label: 'Очно' }, { value: 'online', label: 'Онлайн' }, { value: 'mixed', label: 'Смешанный' }
          ], 'offline') +
          inputField('Дедлайн заявок', 'applicationDeadline', '', 'date') +
        '</div>' +
        inputField('Место проведения', 'place', '') +
        '<div class="form-grid">' +
          selectField('Календарный план', 'calendarPlan', [
            { value: '', label: 'Нет' }, { value: 'ekp', label: 'ЕКП Минспорта' }, { value: 'regional', label: 'План области' }
          ], '') +
          inputField('Номер в плане', 'calendarNumber', '') +
        '</div>' +
      '</form>';

      var card = openModal('Новое соревнование', body,
        '<button class="btn" id="save-comp">Создать</button><button class="btn ghost" id="cancel-comp">Отмена</button>');

      card.querySelector('#cancel-comp').onclick = closeModal;
      card.querySelector('#save-comp').onclick = function () {
        var form = card.querySelector('#comp-form');
        var payload = readForm(form);
        if (!payload.title || !payload.startDate) return toast('Укажите название и дату', 'error');

        api.post('/competitions', payload).then(function (comp) {
          closeModal();
          toast('Соревнование создано');
          location.hash = '#/competitions/' + comp.id;
        }).catch(function (e) { toast(e.message, 'error'); });
      };
    };
  }
}

function tabButton(id, label, active) {
  return '<button class="tab' + (active ? ' active' : '') + '" data-tab="' + id + '">' + esc(label) + '</button>';
}

function panel(id, html, active) {
  return '<div class="tab-panel' + (active ? ' active' : '') + '" data-panel="' + id + '">' + html + '</div>';
}

export async function renderCompetition(el, id) {
  var comp = await api.get('/competitions/' + id);
  var isFed = state.role === 'federation';
  var isAthlete = state.role === 'athlete';
  var isTrainer = state.role === 'trainer';

  var [apps, results] = await Promise.all([
    api.get('/competitions/' + id + '/applications'),
    api.get('/competitions/' + id + '/results')
  ]);

  var protocol = null;
  if (comp.protocolId) {
    try { protocol = await api.get('/protocols/' + comp.protocolId); } catch (e) { protocol = null; }
  }

  var meta =
    '<div class="comp-meta">' +
      '<span class="chip chip-role">' + esc(comp.disciplineName) + '</span>' +
      '<span class="chip chip-role">' + esc(comp.levelName) + '</span>' +
      '<span class="chip chip-role">' + esc(comp.typeName) + '</span>' +
      '<span class="chip chip-role">' + esc(comp.ageGroup) + '</span>' +
      '<span class="chip chip-role">' + esc(formatName(comp.format)) + '</span>' +
      statusChip(comp.status) +
    '</div>';

  var actions = '';
  if (isFed) {
    STATUS_ACTIONS.forEach(function (a) {
      if (a.show.indexOf(comp.status) !== -1) {
        actions += '<button class="btn ghost" data-status="' + a.status + '">' + esc(a.label) + '</button>';
      }
    });
    actions += '<button class="btn ghost" id="edit-comp">Редактировать</button>';
  }
  if (isAthlete) {
    if (comp.status === 'registration' && comp.fitsAge && !comp.myApplication) {
      actions += '<button class="btn" id="apply-comp">Подать заявку</button>';
    }
    actions += '<a class="btn ghost" href="/api/competitions/' + esc(comp.id) + '/regulation" target="_blank" rel="noopener">Положение</a>';
  }

  var overviewFacts =
    '<dl class="facts">' +
      '<dt>Даты</dt><dd>' + esc(fmtDate(comp.startDate)) + (comp.endDate !== comp.startDate ? ' — ' + esc(fmtDate(comp.endDate)) : '') + '</dd>' +
      '<dt>Место</dt><dd>' + esc(comp.place || '—') + '</dd>' +
      '<dt>Приём заявок до</dt><dd>' + esc(fmtDate(comp.applicationDeadline)) + '</dd>' +
      '<dt>Календарный план</dt><dd>' + (comp.calendarPlan ? (comp.calendarPlan === 'ekp' ? 'ЕКП Минспорта' : 'План области') + (comp.calendarNumber ? ', № ' + esc(comp.calendarNumber) : '') : 'не включено') + '</dd>' +
      '<dt>Заявок</dt><dd>' + comp.applicationsCount + ' (одобрено ' + comp.approvedCount + ')</dd>' +
      '<dt>Главный судья</dt><dd>' + esc((comp.judges.find(function (j) { return j.position === 'главный судья'; }) || {}).fio || 'не назначен') + '</dd>' +
      (comp.myApplication ? '<dt>Моя заявка</dt><dd>' + statusChip(comp.myApplication.status) + '</dd>' : '') +
    '</dl>';

  var overview = '<div class="grid k2">' +
    '<div class="card">' + overviewFacts + '</div>' +
    '<div class="card"><h3 class="sub">Судейская коллегия</h3>' +
      (comp.judges.length
        ? '<ul class="plain">' + comp.judges.map(function (j) {
            return '<li>' + esc(j.fio) + ' — ' + esc(j.position) + '</li>';
          }).join('') + '</ul>'
        : '<p class="muted">Судьи пока не назначены.</p>') +
      (isFed ? '<button class="btn ghost mt" id="assign-judge">Назначить судью</button>' : '') +
    '</div>' +
  '</div>';

  var appsHtml = apps.length
    ? table(['Спортсмен', 'Организация', 'Возраст', 'Подал', 'Статус', ''],
        apps.map(function (a) {
          var actionsHtml = '';
          if (isFed && a.status === 'pending') {
            actionsHtml = '<button class="btn small" data-approve="' + esc(a.id) + '">Одобрить</button> ' +
              '<button class="btn small ghost" data-reject="' + esc(a.id) + '">Отклонить</button>';
          }
          return [
            esc(a.fio),
            esc(a.organizationName),
            String(a.age),
            esc(a.submittedByName),
            statusChip(a.status) + (a.comment ? '<div class="muted small">' + esc(a.comment) + '</div>' : ''),
            actionsHtml
          ];
        }))
    : empty('Заявок пока нет', 'Спортсмены увидят соревнование после открытия приёма заявок.');

  var resultsRows = results.map(function (r) {
    if (isFed) {
      return [
        esc(r.fio),
        esc(r.organizationName),
        '<input class="input input-sm" type="number" min="1" data-place="' + esc(r.id) + '" value="' + esc(r.place || '') + '">',
        '<input class="input input-sm" type="number" min="0" data-points="' + esc(r.id) + '" value="' + esc(r.points || 0) + '">'
      ];
    }
    return [esc(r.fio), esc(r.organizationName), String(r.place || '—'), String(r.points || 0)];
  });

  var hasApproved = apps.some(function (a) { return a.status === 'approved'; });

  var resultsHtml = '<div class="card">' +
    (results.length
      ? table(isFed ? ['Спортсмен', 'Организация', 'Место', 'Баллы'] : ['Спортсмен', 'Организация', 'Место', 'Баллы'], resultsRows)
      : empty('Результатов пока нет', isFed ? 'Нажмите «Заполнить результаты», чтобы внести места.' : 'Результаты появятся после внесения федерацией.')) +
    (isFed ? '<div class="mt">' +
      (hasApproved ? '<button class="btn" id="fill-results">Заполнить результаты</button> ' : '') +
      (results.length ? '<button class="btn ghost" id="save-results">Сохранить результаты</button>' : '') + '</div>' : '') +
  '</div>';

  var protocolHtml;
  if (!protocol) {
    protocolHtml = '<div class="card">' + empty('Протокол не сформирован', 'Сначала внесите результаты, затем сформируйте протокол.') +
      (isFed ? '<button class="btn mt" id="gen-protocol">Сформировать протокол</button>' : '') + '</div>';
  } else {
    var rows = protocol.rows.map(function (r) {
      return [String(r.line), esc(r.fio), esc(r.organization), r.place === null ? '—' : String(r.place), String(r.points)];
    });
    protocolHtml = '<div class="card"><div class="card-head"><h2 class="card-title">Протокол</h2>' + statusChip(protocol.status) + '</div>' +
      table(['№', 'ФИО', 'Организация', 'Место', 'Баллы'], rows) +
      '<div class="mt">' +
        '<a class="btn ghost" href="/api/protocols/' + esc(protocol.id) + '/docx">Скачать .docx</a> ' +
        '<button class="btn ghost" onclick="window.print()">Печать / PDF</button> ' +
        (isFed && protocol.status !== 'published' ? '<button class="btn" id="publish-protocol">Опубликовать</button>' : '') +
        (isFed ? '<button class="btn ghost" id="gen-protocol">Пересобрать</button>' : '') +
      '</div>' +
      (protocol.status === 'published' ? '<p class="muted small mt">Опубликован ' + esc(fmtDate(protocol.publishedAt)) + '. Результаты добавлены в историю спортсменов.</p>' : '') +
    '</div>';
  }

  var tabs =
    '<div class="tabs">' +
      tabButton('overview', 'Обзор', true) +
      tabButton('apps', 'Заявки (' + apps.length + ')', false) +
      tabButton('results', 'Результаты', false) +
      tabButton('protocol', 'Протокол', false) +
    '</div>';

  el.innerHTML =
    '<a class="back-link" href="#/competitions">← Календарь</a>' +
    '<div class="page-head"><div><h1>' + esc(comp.title) + '</h1>' + meta + '</div>' +
      '<div class="page-actions">' + actions + '</div></div>' +
    tabs +
    panel('overview', overview, true) +
    panel('apps', appsHtml, false) +
    panel('results', resultsHtml, false) +
    panel('protocol', protocolHtml, false);

  el.querySelectorAll('[data-tab]').forEach(function (btn) {
    btn.onclick = function () {
      el.querySelectorAll('[data-tab]').forEach(function (b) { b.classList.remove('active'); });
      el.querySelectorAll('[data-panel]').forEach(function (p) { p.classList.remove('active'); });
      btn.classList.add('active');
      el.querySelector('[data-panel="' + btn.dataset.tab + '"]').classList.add('active');
    };
  });

  el.querySelectorAll('[data-status]').forEach(function (btn) {
    btn.onclick = function () {
      api.post('/competitions/' + comp.id + '/status', { status: btn.dataset.status })
        .then(function () { toast('Статус обновлён'); renderCompetition(el, comp.id); })
        .catch(function (e) { toast(e.message, 'error'); });
    };
  });

  el.querySelectorAll('[data-approve]').forEach(function (btn) {
    btn.onclick = function () {
      api.post('/applications/' + btn.dataset.approve + '/approve').then(function () {
        toast('Заявка одобрена');
        renderCompetition(el, comp.id);
      }).catch(function (e) { toast(e.message, 'error'); });
    };
  });

  el.querySelectorAll('[data-reject]').forEach(function (btn) {
    btn.onclick = function () {
      var card = openModal('Отклонить заявку', '<form id="rej"><label class="field"><span class="field-label">Причина</span>' +
        '<input class="input" name="comment" placeholder="Например: не подтверждена организация"></label></form>',
        '<button class="btn danger" id="rej-ok">Отклонить</button><button class="btn ghost" id="rej-cancel">Отмена</button>');
      card.querySelector('#rej-cancel').onclick = closeModal;
      card.querySelector('#rej-ok').onclick = function () {
        var comment = card.querySelector('[name=comment]').value || 'Без комментария';
        api.post('/applications/' + btn.dataset.reject + '/reject', { comment }).then(function () {
          closeModal();
          toast('Заявка отклонена');
          renderCompetition(el, comp.id);
        }).catch(function (e) { toast(e.message, 'error'); });
      };
    };
  });

  var gen = el.querySelector('#gen-protocol');
  if (gen) {
    gen.onclick = function () {
      api.post('/competitions/' + comp.id + '/protocol').then(function () {
        toast('Протокол сформирован');
        renderCompetition(el, comp.id);
      }).catch(function (e) { toast(e.message, 'error'); });
    };
  }

  var pub = el.querySelector('#publish-protocol');
  if (pub) {
    pub.onclick = async function () {
      if (!(await confirmDialog('Опубликовать протокол? Результаты попадут в историю спортсменов.', 'Опубликовать'))) return;
      api.post('/protocols/' + protocol.id + '/publish').then(function () {
        toast('Протокол опубликован');
        renderCompetition(el, comp.id);
      }).catch(function (e) { toast(e.message, 'error'); });
    };
  }

  var saveResults = el.querySelector('#save-results');
  if (saveResults) {
    saveResults.onclick = function () {
      var rows = results.map(function (r) {
        var placeInput = el.querySelector('[data-place="' + r.id + '"]');
        var pointsInput = el.querySelector('[data-points="' + r.id + '"]');
        return {
          athleteId: r.athleteId,
          place: placeInput.value ? Number(placeInput.value) : null,
          points: pointsInput.value !== '' ? Number(pointsInput.value) : 0
        };
      });
      api.post('/competitions/' + comp.id + '/results', { rows: rows }).then(function () {
        toast('Результаты сохранены');
        renderCompetition(el, comp.id);
      }).catch(function (e) { toast(e.message, 'error'); });
    };
  }

  var fill = el.querySelector('#fill-results');
  if (fill) {
    fill.onclick = function () {
      // Быстрое заполнение по порядку одобренных заявок
      var approved = apps.filter(function (a) { return a.status === 'approved'; });
      if (!approved.length) return toast('Нет одобренных заявок', 'error');
      var rows = approved.map(function (a, i) {
        return { athleteId: a.athleteId, place: i + 1, points: null };
      });
      api.post('/competitions/' + comp.id + '/results', { rows: rows }).then(function () {
        toast('Места расставлены по порядку — проверьте и сохраните');
        renderCompetition(el, comp.id);
      }).catch(function (e) { toast(e.message, 'error'); });
    };
  }

  var applyBtn = el.querySelector('#apply-comp');
  if (applyBtn) {
    applyBtn.onclick = function () {
      api.post('/applications', { competitionId: comp.id }).then(function () {
        toast('Заявка подана');
        renderCompetition(el, comp.id);
      }).catch(function (e) { toast(e.message, 'error'); });
    };
  }

  var assign = el.querySelector('#assign-judge');
  if (assign) {
    assign.onclick = function () {
      api.get('/judges').then(function (judges) {
        var body = '<form id="judge-form" class="form">' +
          selectField('Судья', 'judgeId', judges.map(function (j) { return { value: j.id, label: j.fio + ' (' + j.category + ')' }; }), '') +
          selectField('Должность', 'position', ['главный судья', 'заместитель главного судьи', 'секретарь', 'судья'], 'судья') +
        '</form>';
        var card = openModal('Назначение судьи', body,
          '<button class="btn" id="assign-ok">Назначить</button><button class="btn ghost" id="assign-cancel">Отмена</button>');
        card.querySelector('#assign-cancel').onclick = closeModal;
        card.querySelector('#assign-ok').onclick = function () {
          var data = readForm(card.querySelector('#judge-form'));
          api.post('/judges/assignments', { competitionId: comp.id, judgeId: data.judgeId, position: data.position })
            .then(function () {
              closeModal();
              toast('Судья назначен');
              renderCompetition(el, comp.id);
            }).catch(function (e) { toast(e.message, 'error'); });
        };
      });
    };
  }

  var edit = el.querySelector('#edit-comp');
  if (edit) {
    edit.onclick = function () {
      var body = '<form id="edit-comp-form" class="form">' +
        inputField('Название', 'title', comp.title) +
        '<div class="form-grid">' +
          inputField('Дата начала', 'startDate', comp.startDate, 'date') +
          inputField('Дата окончания', 'endDate', comp.endDate, 'date') +
        '</div>' +
        '<div class="form-grid">' +
          inputField('Место', 'place', comp.place) +
          inputField('Дедлайн заявок', 'applicationDeadline', comp.applicationDeadline, 'date') +
        '</div>' +
        '<div class="form-grid">' +
          inputField('Номер в календарном плане', 'calendarNumber', comp.calendarNumber || '') +
          selectField('Календарный план', 'calendarPlan', [
            { value: '', label: 'Нет' }, { value: 'ekp', label: 'ЕКП Минспорта' }, { value: 'regional', label: 'План области' }
          ], comp.calendarPlan || '') +
        '</div>' +
      '</form>';
      var card = openModal('Редактирование соревнования', body,
        '<button class="btn" id="comp-save">Сохранить</button><button class="btn ghost" id="comp-cancel">Отмена</button>');
      card.querySelector('#comp-cancel').onclick = closeModal;
      card.querySelector('#comp-save').onclick = function () {
        api.put('/competitions/' + comp.id, readForm(card.querySelector('#edit-comp-form'))).then(function () {
          closeModal();
          toast('Сохранено');
          renderCompetition(el, comp.id);
        }).catch(function (e) { toast(e.message, 'error'); });
      };
    };
  }
}

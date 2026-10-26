// Рейтинг спортсменов и сборная региона.
import { api } from '../api.js';
import { state, discName } from '../store.js';
import {
  esc, loading, pageHead, table, empty, selectField, openModal, closeModal, toast
} from '../ui.js';

function detailsModal(row) {
  var rows = row.breakdown.map(function (b) {
    return [
      esc(b.title),
      esc(b.levelName),
      String(b.place),
      String(b.points)
    ];
  });

  var body = '<p class="muted">Сумма баллов: <b>' + row.sum + '</b>. Призовых мест: <b>' + row.podiums +
    '</b>. Коэффициент стабильности: <b>×' + row.coeff + '</b>. Итог: <b>' + row.total + '</b>.</p>' +
    table(['Соревнование', 'Уровень', 'Место', 'Баллы'], rows);

  var card = openModal('Из чего сложился рейтинг', body, '<button class="btn ghost" id="bd-close">Закрыть</button>');
  card.querySelector('#bd-close').onclick = closeModal;
}

export async function renderRating(el) {
  var isFed = state.role === 'federation';
  var dict = state.dict;

  el.innerHTML = pageHead('Рейтинг спортсменов',
    'Сезон ' + (dict ? new Date().getFullYear() : '') + ' · баллы за места с учётом уровня соревнований',
    '<a class="btn ghost" id="export-rating" href="#">Экспорт .xlsx</a>' +
    (isFed ? '<button class="btn" id="make-team">Сформировать сборную</button>' : '')) +
    '<div class="card"><div class="filters">' +
      '<label class="field"><span class="field-label">Дисциплина</span><select class="input" id="r-disc"></select></label>' +
      '<label class="field"><span class="field-label">Возрастная группа</span><select class="input" id="r-age"><option value="">Все</option></select></label>' +
      '<label class="field"><span class="field-label">Минимальный разряд</span><select class="input" id="r-rank"><option value="">Любой</option></select></label>' +
    '</div></div>' +
    '<div class="card mt" id="rating">' + loading() + '</div>';

  var discSelect = el.querySelector('#r-disc');
  dict.disciplines.forEach(function (d) {
    discSelect.insertAdjacentHTML('beforeend', '<option value="' + esc(d.code) + '">' + esc(d.name) + '</option>');
  });
  discSelect.value = 'algo';

  var ageSelect = el.querySelector('#r-age');
  dict.ageGroups.forEach(function (g) {
    ageSelect.insertAdjacentHTML('beforeend', '<option value="' + esc(g.code) + '">' + esc(g.code) + '</option>');
  });

  var rankSelect = el.querySelector('#r-rank');
  dict.ranks.forEach(function (r) {
    rankSelect.insertAdjacentHTML('beforeend', '<option value="' + esc(r) + '">' + esc(r) + '</option>');
  });

  var current = [];

  function query() {
    return '/rating?discipline=' + encodeURIComponent(discSelect.value) +
      (ageSelect.value ? '&ageGroup=' + encodeURIComponent(ageSelect.value) : '') +
      (rankSelect.value ? '&minRank=' + encodeURIComponent(rankSelect.value) : '');
  }

  async function load() {
    var data = await api.get(query());
    current = data.rows;

    var exportLink = el.querySelector('#export-rating');
    exportLink.href = '/api/reports/rating.xlsx?discipline=' + encodeURIComponent(discSelect.value) +
      (ageSelect.value ? '&ageGroup=' + encodeURIComponent(ageSelect.value) : '') +
      (rankSelect.value ? '&minRank=' + encodeURIComponent(rankSelect.value) : '');

    if (!data.rows.length) {
      el.querySelector('#rating').innerHTML = empty('В рейтинге пока никого нет',
        'Баллы начисляются после публикации протоколов соревнований сезона.');
      return;
    }

    var rows = data.rows.map(function (r, i) {
      return [
        '<b>' + (i + 1) + '</b>',
        esc(r.fio),
        esc(r.organization),
        String(r.age),
        esc(r.rank),
        '<b>' + r.total + '</b>' + (r.coeff > 1 ? ' <span class="chip chip-warn">×' + r.coeff + '</span>' : ''),
        '<button class="btn small ghost" data-details="' + i + '">Баллы</button>'
      ];
    });

    el.querySelector('#rating').innerHTML = table(
      ['Место', 'Спортсмен', 'Организация', 'Возраст', 'Разряд', 'Итог', ''], rows
    );

    el.querySelectorAll('[data-details]').forEach(function (btn) {
      btn.onclick = function () { detailsModal(current[Number(btn.dataset.details)]); };
    });
  }

  discSelect.addEventListener('change', load);
  ageSelect.addEventListener('change', load);
  rankSelect.addEventListener('change', load);

  var makeTeam = el.querySelector('#make-team');
  if (makeTeam) {
    makeTeam.onclick = function () {
      var checks = current.map(function (r, i) {
        return '<label class="check"><input type="checkbox" name="tm_' + i + '"> ' + esc(r.fio) +
          ' <span class="muted small">(' + r.total + ')</span></label>';
      }).join('');

      var body = '<p class="muted">Отметьте спортсменов для сборной. Текущая дисциплина: ' +
        esc(discName(discSelect.value)) + '.</p><div class="check-col">' + checks + '</div>';

      var card = openModal('Состав сборной', body,
        '<button class="btn" id="team-ok">Сохранить состав</button><button class="btn ghost" id="team-cancel">Отмена</button>');

      card.querySelector('#team-cancel').onclick = closeModal;
      card.querySelector('#team-ok').onclick = function () {
        var ids = current.filter(function (r, i) {
          return card.querySelector('[name="tm_' + i + '"]').checked;
        }).map(function (r) { return r.athleteId; });

        if (!ids.length) return toast('Выберите хотя бы одного спортсмена', 'error');

        api.post('/teams', {
          season: new Date().getFullYear(),
          discipline: discSelect.value,
          ageGroup: ageSelect.value || null,
          athleteIds: ids
        }).then(function () {
          closeModal();
          toast('Состав сборной сохранён');
          location.hash = '#/teams';
        }).catch(function (e) { toast(e.message, 'error'); });
      };
    };
  }

  await load();
}

export async function renderTeams(el) {
  var teams = await api.get('/teams');

  el.innerHTML = pageHead('Сборная региона', 'Сформированные составы и проекты приказов',
    '<a class="btn ghost" href="#/rating">К рейтингу</a>') +
    (teams.length
      ? '<div class="grid k2">' + teams.map(function (t) {
          return '<div class="card">' +
            '<div class="card-head"><h2 class="card-title">' + esc(discName(t.discipline)) + '</h2>' +
              '<span class="chip chip-role">' + t.season + '</span></div>' +
            '<p class="muted small">Возрастная группа: ' + esc(t.ageGroup || 'все') + ' · ' + t.athletes.length + ' чел.</p>' +
            '<ol class="team-list">' + t.athletes.map(function (a) {
              return '<li>' + esc(a.fio) + ' <span class="muted small">' + esc(a.rank) + '</span></li>';
            }).join('') + '</ol>' +
            '<a class="btn ghost" href="/api/teams/' + esc(t.id) + '/order.docx">Проект приказа .docx</a>' +
          '</div>';
        }).join('') + '</div>'
      : '<div class="card">' + empty('Сборная ещё не сформирована',
          'Перейдите в рейтинг, отметьте спортсменов и сохраните состав.') + '</div>');
}

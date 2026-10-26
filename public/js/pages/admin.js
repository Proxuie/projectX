// Настройки федерации и журнал действий.
import { api } from '../api.js';
import { state } from '../store.js';
import { esc, fmtDateTime, pageHead, table, loading, toast, textareaField } from '../ui.js';

export async function renderSettings(el) {
  if (state.role !== 'federation') {
    el.innerHTML = '<div class="card"><h2>Нет доступа</h2></div>';
    return;
  }

  var data = await api.get('/settings');
  var s = data.settings;

  var levels = [
    { key: 'champ_ru', label: 'Чемпионат России' },
    { key: 'perv_ru', label: 'Первенство России' },
    { key: 'interregional', label: 'Межрегиональные' },
    { key: 'regional', label: 'Региональные' }
  ];

  var pointsRows = levels.map(function (l) {
    var row = s.ratingPoints[l.key] || [0, 0, 0];
    return '<tr><td>' + esc(l.label) + '</td>' +
      '<td><input class="input input-sm" type="number" name="p_' + l.key + '_1" value="' + row[0] + '"></td>' +
      '<td><input class="input input-sm" type="number" name="p_' + l.key + '_2" value="' + row[1] + '"></td>' +
      '<td><input class="input input-sm" type="number" name="p_' + l.key + '_3" value="' + row[2] + '"></td></tr>';
  }).join('');

  el.innerHTML = pageHead('Настройки', 'Правила рейтинга, сроки и справочники') +
    '<div class="grid k2">' +
      '<div class="card"><h2 class="card-title">Баллы рейтинга</h2>' +
        '<div class="table-wrap"><table class="table"><thead><tr><th>Уровень</th><th>1</th><th>2</th><th>3</th></tr></thead>' +
        '<tbody>' + pointsRows + '</tbody></table></div>' +
        '<div class="form-grid mt">' +
          '<label class="field"><span class="field-label">Коэффициент стабильности</span>' +
            '<input class="input" type="number" step="0.1" name="coeff" value="' + s.stabilityCoeff + '"></label>' +
          '<label class="field"><span class="field-label">Срок разряда, лет</span>' +
            '<input class="input" type="number" name="rankYears" value="' + s.rankValidityYears + '"></label>' +
          '<label class="field"><span class="field-label">Срок категории, лет</span>' +
            '<input class="input" type="number" name="catYears" value="' + s.judgeCategoryValidityYears + '"></label>' +
          '<label class="field"><span class="field-label">Дедлайн премии</span>' +
            '<input class="input" name="premiya" value="' + esc(s.premiyaDeadline) + '"></label>' +
        '</div>' +
        '<button class="btn mt" id="save-settings">Сохранить настройки</button>' +
      '</div>' +
      '<div class="card"><h2 class="card-title">Справочник типов соревнований</h2>' +
        '<ul class="plain">' + data.competitionTypes.map(function (t) { return '<li>' + esc(t.name) + '</li>'; }).join('') + '</ul>' +
        '<p class="muted small">Справочник пополняется федерацией; в демо-версии редактирование типов не вынесено в интерфейс.</p>' +
        '<h3 class="sub">Правила подсветки разрядов</h3>' +
        '<ul class="plain">' + (s.rankRules || []).map(function (r) {
          return '<li>' + esc(r.level) + ': места ' + r.minPlace + '–' + r.maxPlace + ' → ' + esc(r.rank) + '</li>';
        }).join('') + '</ul>' +
      '</div>' +
    '</div>';

  el.querySelector('#save-settings').onclick = function () {
    var points = {};
    levels.forEach(function (l) {
      points[l.key] = [1, 2, 3].map(function (i) {
        return Number(el.querySelector('[name="p_' + l.key + '_' + i + '"]').value) || 0;
      });
    });

    api.put('/settings', {
      ratingPoints: points,
      stabilityCoeff: Number(el.querySelector('[name=coeff]').value),
      rankValidityYears: Number(el.querySelector('[name=rankYears]').value),
      judgeCategoryValidityYears: Number(el.querySelector('[name=catYears]').value),
      premiyaDeadline: el.querySelector('[name=premiya]').value
    }).then(function () {
      toast('Настройки сохранены');
    }).catch(function (e) { toast(e.message, 'error'); });
  };
}

export async function renderAudit(el) {
  el.innerHTML = pageHead('Журнал действий', 'Кто, когда и что сделал',
    '<button class="btn ghost" id="refresh-audit">Обновить</button>') +
    '<div class="card" id="audit">' + loading() + '</div>';

  async function load() {
    var list = await api.get('/audit');
    el.querySelector('#audit').innerHTML = table(
      ['Время', 'Пользователь', 'Действие', 'Объект'],
      list.map(function (a) {
        return [
          esc(fmtDateTime(a.at)),
          esc(a.login || '—'),
          esc(a.action),
          esc(a.details || a.entity || '')
        ];
      }),
      { emptyText: 'Записей пока нет' }
    );
  }

  el.querySelector('#refresh-audit').onclick = load;
  await load();
}

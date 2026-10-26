// Отчёты и выгрузки.
import { api } from '../api.js';
import { state, discName } from '../store.js';
import { esc, pageHead, openModal, closeModal, toast, table, loading, fmtDate } from '../ui.js';

function downloadCard(title, desc, bodyHtml) {
  return '<div class="card"><h2 class="card-title">' + esc(title) + '</h2>' +
    '<p class="muted small">' + esc(desc) + '</p>' + bodyHtml + '</div>';
}

export async function renderReports(el) {
  var isFed = state.role === 'federation';
  var season = new Date().getFullYear();
  var dict = state.dict;

  el.innerHTML = pageHead('Отчёты и справки', 'Документы формируются из данных платформы') +
    '<div class="grid k2">' +
      downloadCard('Численность занимающихся',
        'Динамика по годам с разрезами по организациям, дисциплинам, возрастным группам и муниципалитетам.',
        '<div class="form-grid">' +
          '<label class="field"><span class="field-label">С года</span><input class="input" id="hc-from" type="number" value="' + (season - 2) + '"></label>' +
          '<label class="field"><span class="field-label">По год</span><input class="input" id="hc-to" type="number" value="' + season + '"></label>' +
        '</div><button class="btn" id="hc-download">Скачать .xlsx</button>') +
      downloadCard('Реестр спортсменов',
        'Полный реестр с организациями, дисциплинами и разрядами.',
        '<a class="btn ghost" href="/api/reports/registry.xlsx">Скачать .xlsx</a>') +
      downloadCard('Рейтинг за сезон',
        'Итоговая таблица рейтинга по выбранной дисциплине.',
        '<div class="field"><span class="field-label">Дисциплина</span><select class="input" id="rt-disc">' +
          dict.disciplines.map(function (d) { return '<option value="' + esc(d.code) + '">' + esc(d.name) + '</option>'; }).join('') +
        '</select></div><a class="btn ghost" id="rt-download" href="/api/reports/rating.xlsx?discipline=algo">Скачать .xlsx</a>') +
      downloadCard('Отчёт о соревнованиях спортсмена',
        'История выступлений, места и баллы. Word-документ.',
        '<div class="field"><span class="field-label">Спортсмен</span><select class="input" id="ath-select">' +
          '<option value="">— выберите —</option></select></div>' +
        '<button class="btn ghost" id="ath-download" disabled>Скачать .docx</button>') +
      downloadCard('Справка о судейской коллегии',
        'Состав судейской коллегии соревнования. Word-документ.',
        '<div class="field"><span class="field-label">Соревнование</span><select class="input" id="comp-select">' +
          '<option value="">— выберите —</option></select></div>' +
        '<button class="btn ghost" id="comp-download" disabled>Скачать .docx</button>') +
      downloadCard('Отчёт о соревнованиях судьи',
        'Соревнования, на которых работал судья. Word-документ.',
        '<div class="field"><span class="field-label">Судья</span><select class="input" id="judge-select">' +
          '<option value="">— выберите —</option></select></div>' +
        '<button class="btn ghost" id="judge-download" disabled>Скачать .docx</button>') +
    '</div>' +
    '<div class="card mt"><div class="card-head"><h2 class="card-title">Справки об участии</h2>' +
      '<span class="muted small">с QR-кодом для проверки подлинности</span></div>' +
      '<div id="certs">' + loading() + '</div></div>';

  el.querySelector('#hc-download').onclick = function () {
    var from = Number(el.querySelector('#hc-from').value);
    var to = Number(el.querySelector('#hc-to').value);
    if (!from || !to || from > to) return toast('Проверьте годы', 'error');
    var years = [];
    for (var y = from; y <= to; y++) years.push(y);
    window.location.href = '/api/reports/headcount.xlsx?years=' + years.join(',');
  };

  var rtDisc = el.querySelector('#rt-disc');
  rtDisc.onchange = function () {
    el.querySelector('#rt-download').href = '/api/reports/rating.xlsx?discipline=' + encodeURIComponent(rtDisc.value);
  };

  var athletes = [];
  try {
    athletes = await api.get('/users?role=athlete');
    var athSelect = el.querySelector('#ath-select');
    athletes.forEach(function (a) {
      athSelect.insertAdjacentHTML('beforeend', '<option value="' + esc(a.id) + '">' + esc(a.fio) + '</option>');
    });
    athSelect.onchange = function () {
      var btn = el.querySelector('#ath-download');
      btn.disabled = !athSelect.value;
      btn.onclick = function () {
        if (athSelect.value) window.location.href = '/api/reports/athlete/' + athSelect.value + '.docx';
      };
    };
  } catch (e) { /* министерству список спортсменов тоже доступен */ }

  var comps = await api.get('/competitions');
  var compSelect = el.querySelector('#comp-select');
  comps.forEach(function (c) {
    compSelect.insertAdjacentHTML('beforeend', '<option value="' + esc(c.id) + '">' + esc(c.title) + '</option>');
  });
  compSelect.onchange = function () {
    var btn = el.querySelector('#comp-download');
    btn.disabled = !compSelect.value;
    btn.onclick = function () {
      if (compSelect.value) window.location.href = '/api/reports/judges/' + compSelect.value + '.docx';
    };
  };

  var judges = await api.get('/judges').catch(function () { return []; });
  var judgeSelect = el.querySelector('#judge-select');
  judges.forEach(function (j) {
    judgeSelect.insertAdjacentHTML('beforeend', '<option value="' + esc(j.id) + '">' + esc(j.fio) + '</option>');
  });
  judgeSelect.onchange = function () {
    var btn = el.querySelector('#judge-download');
    btn.disabled = !judgeSelect.value;
    btn.onclick = function () {
      if (judgeSelect.value) window.location.href = '/api/reports/judge/' + judgeSelect.value + '.docx';
    };
  };

  async function loadCerts() {
    var certs = await api.get('/certificates');
    var host = el.querySelector('#certs');
    if (!certs.length) {
      host.innerHTML = '<p class="muted">Справок пока нет. Спортсмен формирует справку в разделе «Документы» после публикации протокола.</p>';
      return;
    }
    host.innerHTML = table(
      ['Номер', 'Спортсмен', 'Соревнование', 'Дата', ''],
      certs.map(function (c) {
        return [
          esc(c.number),
          esc(c.fio),
          esc(c.competitionTitle),
          esc(fmtDate(c.createdAt)),
          '<button class="btn small ghost" data-qr="' + esc(c.id) + '">QR</button>'
        ];
      })
    );

    host.querySelectorAll('[data-qr]').forEach(function (btn) {
      btn.onclick = function () {
        api.get('/certificates/' + btn.dataset.qr + '/qr').then(function (data) {
          var card = openModal('QR-код справки',
            '<div class="qr-wrap"><img src="' + data.dataUrl + '" alt="QR"><p class="muted small">' + esc(data.url) + '</p></div>',
            '<button class="btn ghost" id="qr-close">Закрыть</button>');
          card.querySelector('#qr-close').onclick = closeModal;
        }).catch(function (e) { toast(e.message, 'error'); });
      };
    });
  }

  loadCerts();
}

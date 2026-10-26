// Модерация заявок на соревнования.
import { api } from '../api.js';
import { state } from '../store.js';
import { esc, fmtDate, statusChip, loading, pageHead, table, empty, openModal, closeModal, toast } from '../ui.js';

export async function renderApplications(el) {
  var isFed = state.role === 'federation';

  el.innerHTML = pageHead('Заявки на соревнования', 'Одобрение и отклонение заявок спортсменов',
    '<a class="btn ghost" href="#/competitions">Календарь</a>') +
    '<div class="card"><div class="filters">' +
      '<label class="field search"><span class="field-label">Поиск спортсмена</span>' +
        '<input class="input" id="a-q" type="search" placeholder="ФИО"></label>' +
      '<label class="field"><span class="field-label">Статус</span><select class="input" id="a-status">' +
        '<option value="">Все</option><option value="pending">На рассмотрении</option>' +
        '<option value="approved">Одобренные</option><option value="rejected">Отклонённые</option></select></label>' +
      '<label class="field"><span class="field-label">Соревнование</span><select class="input" id="a-comp"><option value="">Все</option></select></label>' +
    '</div></div>' +
    '<div class="card mt" id="apps">' + loading() + '</div>';

  var apps = await api.get('/applications');
  var comps = await api.get('/competitions');

  var compSelect = el.querySelector('#a-comp');
  comps.forEach(function (c) {
    compSelect.insertAdjacentHTML('beforeend', '<option value="' + esc(c.id) + '">' + esc(c.title) + '</option>');
  });

  function apply() {
    var q = el.querySelector('#a-q').value.trim().toLowerCase();
    var status = el.querySelector('#a-status').value;
    var comp = compSelect.value;

    var list = apps.filter(function (a) {
      if (q && a.fio.toLowerCase().indexOf(q) === -1) return false;
      if (status && a.status !== status) return false;
      if (comp && a.competitionId !== comp) return false;
      return true;
    });

    var rows = list.map(function (a) {
      var actions = '';
      if (isFed && a.status === 'pending') {
        actions = '<button class="btn small" data-approve="' + esc(a.id) + '">Одобрить</button> ' +
          '<button class="btn small ghost" data-reject="' + esc(a.id) + '">Отклонить</button>';
      }
      return [
        '<a class="link-btn" href="#/competitions/' + esc(a.competitionId) + '">' + esc(a.fio) + '</a>' +
          (a.submittedByName !== a.fio ? '<div class="muted small">подал: ' + esc(a.submittedByName) + '</div>' : ''),
        esc(a.competitionTitle),
        esc(fmtDate(a.competitionDate)),
        statusChip(a.status) + (a.comment ? '<div class="muted small">' + esc(a.comment) + '</div>' : ''),
        actions
      ];
    });

    el.querySelector('#apps').innerHTML = table(
      ['Спортсмен', 'Соревнование', 'Дата', 'Статус', ''], rows,
      { emptyText: 'Заявок нет', emptyHint: 'Как только спортсмены подадут заявки, они появятся здесь.' }
    );

    el.querySelectorAll('[data-approve]').forEach(function (btn) {
      btn.onclick = function () {
        api.post('/applications/' + btn.dataset.approve + '/approve').then(function () {
          toast('Заявка одобрена');
          return api.get('/applications').then(function (list) { apps = list; apply(); });
        }).catch(function (e) { toast(e.message, 'error'); });
      };
    });

    el.querySelectorAll('[data-reject]').forEach(function (btn) {
      btn.onclick = function () {
        var card = openModal('Отклонить заявку',
          '<label class="field"><span class="field-label">Причина</span>' +
          '<input class="input" id="rej-comment" placeholder="Например: не подтверждена организация"></label>',
          '<button class="btn danger" id="rej-ok">Отклонить</button><button class="btn ghost" id="rej-cancel">Отмена</button>');
        card.querySelector('#rej-cancel').onclick = closeModal;
        card.querySelector('#rej-ok').onclick = function () {
          api.post('/applications/' + btn.dataset.reject + '/reject', {
            comment: card.querySelector('#rej-comment').value || 'Без комментария'
          }).then(function () {
            closeModal();
            toast('Заявка отклонена');
            return api.get('/applications').then(function (list) { apps = list; apply(); });
          }).catch(function (e) { toast(e.message, 'error'); });
        };
      };
    });
  }

  el.querySelector('#a-q').addEventListener('input', apply);
  el.querySelector('#a-status').addEventListener('change', apply);
  compSelect.addEventListener('change', apply);
  apply();
}

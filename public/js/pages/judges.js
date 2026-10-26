// Судьи: реестр и заявки на категорию.
import { api } from '../api.js';
import { state } from '../store.js';
import {
  esc, fmtDate, daysText, statusChip, loading, pageHead, table, empty,
  inputField, selectField, openModal, closeModal, toast
} from '../ui.js';

export async function renderJudges(el) {
  var isFed = state.role === 'federation';

  el.innerHTML = pageHead('Судьи и коллегии', 'Категории, сроки действия и заявки') +
    '<div class="card"><div class="card-head"><h2 class="card-title">Реестр судей</h2></div><div id="judges">' + loading() + '</div></div>' +
    '<div class="card mt"><div class="card-head"><h2 class="card-title">Заявки на судейскую категорию</h2></div><div id="judge-apps">' + loading() + '</div></div>';

  var judges = await api.get('/judges');
  var apps = await api.get('/judges/category-applications');

  el.querySelector('#judges').innerHTML = table(
    ['Судья', 'Категория', 'Действует до', 'Осталось', 'Назначений', 'Соревнований'],
    judges.map(function (j) {
      var cls = j.daysLeft === null ? 'chip chip-muted' : j.daysLeft < 0 ? 'chip chip-expired' : j.daysLeft <= 30 ? 'chip chip-warn' : 'chip chip-ok';
      return [
        esc(j.fio) + '<div class="muted small">' + esc(j.municipality || '') + '</div>',
        esc(j.category),
        esc(fmtDate(j.validUntil)),
        '<span class="' + cls + '">' + esc(daysText(j.daysLeft)) + '</span>',
        String(j.assignments),
        String(j.competitions)
      ];
    }),
    { emptyText: 'Судей пока нет' }
  );

  function renderApps() {
    var rows = apps.map(function (a) {
      var actions = '';
      if (isFed && a.status === 'pending') {
        actions = '<button class="btn small" data-approve="' + esc(a.id) + '">Присвоить</button> ' +
          '<button class="btn small ghost" data-reject="' + esc(a.id) + '">Отклонить</button>';
      }
      return [
        esc(a.fio),
        esc(a.currentCategory) + '<div class="muted small">до ' + esc(fmtDate(a.currentValidUntil)) + '</div>',
        esc(a.requestedCategory),
        statusChip(a.status),
        actions
      ];
    });

    el.querySelector('#judge-apps').innerHTML = table(
      ['Судья', 'Текущая категория', 'Запрошена', 'Статус', ''], rows,
      { emptyText: 'Заявок нет', emptyHint: 'Судья подаёт заявку из своего кабинета.' }
    );

    el.querySelectorAll('[data-approve]').forEach(function (btn) {
      btn.onclick = function () {
        var card = openModal('Присвоение категории',
          '<form id="cat-form" class="form">' +
            inputField('Действует до', 'validUntil', '', 'date') +
            '<p class="muted small">Если дату не указать, срок будет рассчитан по настройкам федерации.</p>' +
          '</form>',
          '<button class="btn" id="cat-ok">Присвоить</button><button class="btn ghost" id="cat-cancel">Отмена</button>');
        card.querySelector('#cat-cancel').onclick = closeModal;
        card.querySelector('#cat-ok').onclick = function () {
          var validUntil = card.querySelector('[name=validUntil]').value;
          api.post('/judges/category-applications/' + btn.dataset.approve + '/approve', {
            validUntil: validUntil || undefined
          }).then(function () {
            closeModal();
            toast('Категория присвоена');
            return api.get('/judges/category-applications').then(function (list) { apps = list; renderApps(); });
          }).catch(function (e) { toast(e.message, 'error'); });
        };
      };
    });

    el.querySelectorAll('[data-reject]').forEach(function (btn) {
      btn.onclick = function () {
        var card = openModal('Отклонить заявку',
          '<label class="field"><span class="field-label">Причина</span><input class="input" id="cat-comment"></label>',
          '<button class="btn danger" id="cat-rej">Отклонить</button><button class="btn ghost" id="cat-rej-cancel">Отмена</button>');
        card.querySelector('#cat-rej-cancel').onclick = closeModal;
        card.querySelector('#cat-rej').onclick = function () {
          api.post('/judges/category-applications/' + btn.dataset.reject + '/reject', {
            comment: card.querySelector('#cat-comment').value || 'Без комментария'
          }).then(function () {
            closeModal();
            toast('Заявка отклонена');
            return api.get('/judges/category-applications').then(function (list) { apps = list; renderApps(); });
          }).catch(function (e) { toast(e.message, 'error'); });
        };
      };
    });
  }

  renderApps();
}

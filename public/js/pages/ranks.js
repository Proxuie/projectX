// Разряды: заявки, присвоение, контроль сроков.
import { api } from '../api.js';
import { state } from '../store.js';
import {
  esc, fmtDate, daysText, statusChip, loading, pageHead, table, empty,
  inputField, openModal, closeModal, toast
} from '../ui.js';

export async function renderRanks(el) {
  var isFed = state.role === 'federation';

  el.innerHTML = pageHead('Разряды', 'Заявки на присвоение и подтверждение, контроль сроков действия') +
    '<div class="grid k2">' +
      '<div class="card"><div class="card-head"><h2 class="card-title">Заявки</h2></div><div id="rank-apps">' + loading() + '</div></div>' +
      '<div class="card"><div class="card-head"><h2 class="card-title">Истекают в ближайшие 30 дней</h2></div><div id="rank-exp">' + loading() + '</div></div>' +
    '</div>';

  var apps = await api.get('/ranks/applications');
  var expiring = await api.get('/ranks/expiring');

  function renderApps() {
    var rows = apps.map(function (a) {
      var actions = '';
      if (isFed && a.status === 'pending') {
        actions = '<button class="btn small" data-approve="' + esc(a.id) + '">Присвоить</button> ' +
          '<button class="btn small ghost" data-reject="' + esc(a.id) + '">Отклонить</button>';
      }
      return [
        esc(a.fio) + '<div class="muted small">' + esc(a.organizationName) + '</div>',
        esc(a.requestedRank) + '<div class="muted small">сейчас: ' + esc(a.currentRank) + '</div>',
        esc(a.competitionTitle) + (a.place ? '<div class="muted small">' + a.place + ' место</div>' : ''),
        statusChip(a.status),
        actions
      ];
    });

    el.querySelector('#rank-apps').innerHTML = table(
      ['Спортсмен', 'Разряд', 'Основание', 'Статус', ''], rows,
      { emptyText: 'Заявок нет', emptyHint: 'Спортсмен или тренер может подать заявку из личного кабинета.' }
    );

    el.querySelectorAll('[data-approve]').forEach(function (btn) {
      btn.onclick = function () {
        var card = openModal('Присвоение разряда',
          '<form id="rank-form" class="form">' +
            inputField('Номер приказа', 'orderNumber', '№ ' + (100 + Math.floor(Math.random() * 50)) + '-р') +
            inputField('Действует до', 'validUntil', '', 'date') +
            '<p class="muted small">Если дату не указать, срок будет рассчитан по настройкам федерации.</p>' +
          '</form>',
          '<button class="btn" id="rank-ok">Присвоить</button><button class="btn ghost" id="rank-cancel">Отмена</button>');
        card.querySelector('#rank-cancel').onclick = closeModal;
        card.querySelector('#rank-ok').onclick = function () {
          var form = card.querySelector('#rank-form');
          api.post('/ranks/applications/' + btn.dataset.approve + '/approve', {
            orderNumber: form.querySelector('[name=orderNumber]').value,
            validUntil: form.querySelector('[name=validUntil]').value || undefined
          }).then(function () {
            closeModal();
            toast('Разряд присвоен');
            return api.get('/ranks/applications').then(function (list) { apps = list; renderApps(); });
          }).catch(function (e) { toast(e.message, 'error'); });
        };
      };
    });

    el.querySelectorAll('[data-reject]').forEach(function (btn) {
      btn.onclick = function () {
        var card = openModal('Отклонить заявку',
          '<label class="field"><span class="field-label">Причина</span>' +
          '<input class="input" id="rank-comment" placeholder="Например: результат не соответствует требованиям"></label>',
          '<button class="btn danger" id="rank-rej">Отклонить</button><button class="btn ghost" id="rank-rej-cancel">Отмена</button>');
        card.querySelector('#rank-rej-cancel').onclick = closeModal;
        card.querySelector('#rank-rej').onclick = function () {
          api.post('/ranks/applications/' + btn.dataset.reject + '/reject', {
            comment: card.querySelector('#rank-comment').value || 'Без комментария'
          }).then(function () {
            closeModal();
            toast('Заявка отклонена');
            return api.get('/ranks/applications').then(function (list) { apps = list; renderApps(); });
          }).catch(function (e) { toast(e.message, 'error'); });
        };
      };
    });
  }

  function renderExpiring() {
    if (!expiring.length) {
      el.querySelector('#rank-exp').innerHTML = empty('Просроченных и истекающих разрядов нет');
      return;
    }

    el.querySelector('#rank-exp').innerHTML = table(
      ['Спортсмен', 'Разряд', 'Действует до', 'Осталось'],
      expiring.map(function (x) {
        var cls = x.daysLeft < 0 ? 'chip chip-expired' : 'chip chip-warn';
        return [
          esc(x.fio) + '<div class="muted small">' + esc(x.organizationName) + '</div>',
          esc(x.rank),
          esc(fmtDate(x.validUntil)),
          '<span class="' + cls + '">' + esc(daysText(x.daysLeft)) + '</span>'
        ];
      })
    );
  }

  renderApps();
  renderExpiring();
}

// Уведомления.
import { api } from '../api.js';
import { esc, fmtDateTime, loading, pageHead, empty, toast } from '../ui.js';

export async function renderNotifications(el) {
  el.innerHTML = pageHead('Уведомления', 'События платформы',
    '<button class="btn ghost" id="read-all">Прочитать все</button>') +
    '<div class="card" id="notif">' + loading() + '</div>';

  async function load() {
    var data = await api.get('/notifications');
    var host = el.querySelector('#notif');

    if (!data.items.length) {
      host.innerHTML = empty('Уведомлений пока нет', 'Здесь появятся события: заявки, протоколы, сроки.');
      return;
    }

    host.innerHTML = data.items.map(function (n) {
      return '<div class="notif' + (n.read ? ' read' : '') + '" data-id="' + esc(n.id) + '" data-link="' + esc(n.link || '') + '">' +
        '<div class="notif-dot"></div>' +
        '<div class="notif-body"><strong>' + esc(n.title) + '</strong>' +
          '<p>' + esc(n.text) + '</p>' +
          '<span class="muted small">' + esc(fmtDateTime(n.createdAt)) + ' · ' + (n.channel === 'email' ? 'кабинет и письмо' : 'кабинет') + '</span>' +
        '</div></div>';
    }).join('');

    host.querySelectorAll('[data-id]').forEach(function (row) {
      row.onclick = function () {
        api.post('/notifications/' + row.dataset.id + '/read').then(function () {
          window.dispatchEvent(new Event('refresh-me'));
          if (row.dataset.link) location.hash = row.dataset.link;
          else load();
        }).catch(function (e) { toast(e.message, 'error'); });
      };
    });
  }

  el.querySelector('#read-all').onclick = function () {
    api.post('/notifications/read-all').then(function () {
      toast('Все уведомления прочитаны');
      window.dispatchEvent(new Event('refresh-me'));
      load();
    }).catch(function (e) { toast(e.message, 'error'); });
  };

  await load();
}

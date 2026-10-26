// Мелкие помощники для интерфейса.

export function esc(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function fmtDate(value) {
  if (!value) return '—';
  const s = String(value).slice(0, 10);
  const parts = s.split('-');
  if (parts.length !== 3) return s;
  return parts[2] + '.' + parts[1] + '.' + parts[0];
}

export function fmtDateTime(value) {
  if (!value) return '—';
  const s = String(value);
  return fmtDate(s) + (s.length > 10 ? ', ' + s.slice(11, 16) : '');
}

export function daysText(days) {
  if (days === null || days === undefined) return '—';
  if (days < 0) return 'истёк';
  if (days === 0) return 'сегодня';
  return days + ' дн.';
}

export function initials(fio) {
  const parts = String(fio || '').split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0].slice(0, 1) + parts[1].slice(0, 1)).toUpperCase();
}

export function statusLabel(status) {
  const map = {
    draft: 'Черновик',
    published: 'Опубликовано',
    registration: 'Приём заявок',
    closed: 'Приём закрыт',
    finished: 'Завершено',
    pending: 'На рассмотрении',
    approved: 'Одобрено',
    rejected: 'Отклонено',
    withdrawn: 'Отозвано',
    active: 'Активна',
    paused: 'Приостановлена',
    ended: 'Завершена',
    disqualified: 'Дисквалифицирован'
  };
  return map[status] || status;
}

export function statusChip(status) {
  return '<span class="chip chip-' + esc(status) + '">' + esc(statusLabel(status)) + '</span>';
}

export function pageHead(title, subtitle, actions) {
  return '<div class="page-head">' +
    '<div><h1>' + esc(title) + '</h1>' + (subtitle ? '<p class="muted">' + esc(subtitle) + '</p>' : '') + '</div>' +
    (actions ? '<div class="page-actions">' + actions + '</div>' : '') +
    '</div>';
}

export function table(headers, rows, options) {
  const opts = options || {};
  if (!rows || rows.length === 0) {
    return empty(opts.emptyText || 'Пока ничего нет', opts.emptyHint || '');
  }
  const head = headers.map((h) => '<th>' + esc(h) + '</th>').join('');
  const body = rows.map((row) => {
    const cells = row.map((cell, i) => {
      return '<td data-label="' + esc(headers[i] || '') + '">' + cell + '</td>';
    }).join('');
    return '<tr>' + cells + '</tr>';
  }).join('');

  return '<div class="table-wrap"><table class="table ' + (opts.cls || '') + '">' +
    '<thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table></div>';
}

export function empty(text, hint) {
  return '<div class="empty"><div class="empty-mark">∅</div><p>' + esc(text) + '</p>' +
    (hint ? '<p class="muted small">' + esc(hint) + '</p>' : '') + '</div>';
}

export function loading(text) {
  return '<div class="loading"><span class="spinner"></span> ' + esc(text || 'Загрузка…') + '</div>';
}

export function inputField(label, name, value, type, attrs) {
  return '<label class="field"><span class="field-label">' + esc(label) + '</span>' +
    '<input class="input" name="' + esc(name) + '" type="' + esc(type || 'text') + '" value="' +
    esc(value === undefined || value === null ? '' : value) + '" ' + (attrs || '') + '></label>';
}

export function selectField(label, name, options, value, attrs) {
  const list = (options || []).map((o) => {
    const v = typeof o === 'string' ? o : o.value;
    const l = typeof o === 'string' ? o : o.label;
    return '<option value="' + esc(v) + '"' + (String(v) === String(value) ? ' selected' : '') + '>' + esc(l) + '</option>';
  }).join('');
  return '<label class="field"><span class="field-label">' + esc(label) + '</span>' +
    '<select class="input" name="' + esc(name) + '" ' + (attrs || '') + '>' + list + '</select></label>';
}

export function textareaField(label, name, value, rows) {
  return '<label class="field"><span class="field-label">' + esc(label) + '</span>' +
    '<textarea class="input" name="' + esc(name) + '" rows="' + (rows || 3) + '">' + esc(value || '') + '</textarea></label>';
}

let toastTimer = null;

export function toast(message, type) {
  const host = document.getElementById('toasts');
  if (!host) return;
  const el = document.createElement('div');
  el.className = 'toast ' + (type === 'error' ? 'toast-error' : 'toast-ok');
  el.textContent = message;
  host.appendChild(el);
  setTimeout(() => el.remove(), 3400);
}

export function icon(name, size) {
  const paths = {
    bell: '<path d="M12 3a5 5 0 0 0-5 5v3l-2 3h14l-2-3V8a5 5 0 0 0-5-5Z"/><path d="M10 18a2 2 0 0 0 4 0"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M4 20h16"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="m5 13 4 4L19 7"/>'
  };
  const s = size || 18;
  return '<svg class="ico-svg" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" ' +
    'stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
    (paths[name] || '') + '</svg>';
}

export function openModal(title, body, footer) {
  const root = document.getElementById('modal-root');
  root.innerHTML = '<div class="modal-overlay" data-overlay>' +
    '<div class="modal-card" role="dialog" aria-modal="true">' +
    '<div class="modal-head"><h3>' + esc(title) + '</h3>' +
    '<button type="button" class="icon-btn" data-close aria-label="Закрыть">' + icon('close') + '</button></div>' +
    '<div class="modal-body">' + body + '</div>' +
    (footer ? '<div class="modal-foot">' + footer + '</div>' : '') +
    '</div></div>';

  const overlay = root.querySelector('[data-overlay]');
  const card = root.querySelector('.modal-card');

  function onKey(e) {
    if (e.key === 'Escape') closeModal();
  }
  document.addEventListener('keydown', onKey);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });
  card.querySelector('[data-close]').addEventListener('click', closeModal);

  card._onKey = onKey;
  return card;
}

export function closeModal() {
  const root = document.getElementById('modal-root');
  const card = root.querySelector('.modal-card');
  if (card && card._onKey) document.removeEventListener('keydown', card._onKey);
  root.innerHTML = '';
}

export function confirmDialog(text, okLabel) {
  return new Promise((resolve) => {
    const card = openModal('Подтверждение', '<p>' + esc(text) + '</p>',
      '<button type="button" class="btn" data-cancel>Отмена</button>' +
      '<button type="button" class="btn danger" data-ok>' + esc(okLabel || 'Подтвердить') + '</button>');

    card.querySelector('[data-cancel]').onclick = () => {
      closeModal();
      resolve(false);
    };
    card.querySelector('[data-ok]').onclick = () => {
      closeModal();
      resolve(true);
    };
  });
}

export function readForm(form) {
  const data = {};
  const elements = form.querySelectorAll('[name]');
  elements.forEach((el) => {
    if (el.type === 'checkbox') data[el.name] = el.checked;
    else data[el.name] = el.value;
  });
  return data;
}

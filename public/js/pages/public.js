// Публичная часть: навигатор, вход, регистрация, проверка справки.
import { api } from '../api.js';
import { state, discName, levelName, typeName, formatName } from '../store.js';
import { esc, fmtDate, inputField, selectField, loading, icon, toast } from '../ui.js';

const DEMO_ACCOUNTS = [
  { login: 'federation', role: 'Федерация' },
  { login: 'athlete', role: 'Спортсмен' },
  { login: 'trainer', role: 'Тренер' },
  { login: 'judge', role: 'Судья' },
  { login: 'multi', role: 'Спортсмен + тренер + судья' },
  { login: 'ministry', role: 'Министерство (чтение)' }
];

function publicHeader() {
  return '<header class="landing-top">' +
    '<a class="brand brand-light" href="#/">' +
      '<span class="brand-mark">ФСП</span>' +
      '<span class="brand-text"><strong>Оренбург</strong><small>спортивное программирование</small></span>' +
    '</a>' +
    '<nav class="landing-nav">' +
      '<a href="#/">О платформе</a>' +
      '<a href="#/login">Войти</a>' +
      '<a class="btn small" href="#/register">Регистрация</a>' +
    '</nav></header>';
}

export async function renderLanding(root) {
  root.innerHTML = publicHeader() +
    '<section class="hero">' +
      '<div class="hero-inner">' +
        '<div class="hero-text">' +
          '<span class="eyebrow">ОренКод 2026 · цифровая платформа</span>' +
          '<h1>Спортивное программирование Оренбургской области — в одном месте</h1>' +
          '<p>Единый реестр спортсменов, тренеров и судей, календарь соревнований, заявки, протоколы, разряды и сборная региона.</p>' +
          '<div class="hero-actions">' +
            '<a class="btn" href="#/login">Войти в кабинет</a>' +
            '<a class="btn outline" href="#/register">Стать участником</a>' +
          '</div>' +
        '</div>' +
        '<div class="hero-panel" id="hero-stats">' + loading('Считаем данные…') + '</div>' +
      '</div>' +
    '</section>' +
    '<main class="landing-main" id="landing-body">' + loading('Загружаем навигатор…') + '</main>' +
    '<footer class="landing-foot">' +
      '<span>Региональное отделение ФСП Оренбургской области</span>' +
      '<span>Демонстрационная версия · данные вымышлены</span>' +
    '</footer>';

  var body = root.querySelector('#landing-body');
  var statsHost = root.querySelector('#hero-stats');

  try {
    var data = await api.get('/public/landing');

    statsHost.innerHTML =
      '<div class="hero-stat"><b>' + data.stats.athletes + '</b><span>спортсменов в реестре</span></div>' +
      '<div class="hero-stat"><b>' + data.stats.competitions + '</b><span>проведённых соревнований</span></div>' +
      '<div class="hero-stat"><b>' + data.stats.organizations + '</b><span>организаций</span></div>' +
      '<div class="hero-stat"><b>' + data.stats.judges + '</b><span>судей</span></div>';

    var disciplinesHtml = data.disciplines.map((d) =>
      '<div class="disc-card"><span class="disc-dot"></span><h3>' + esc(d.name) + '</h3></div>'
    ).join('');

    var compsHtml = data.upcoming.length
      ? data.upcoming.map((c) =>
        '<a class="comp-row" href="#/login">' +
          '<div class="comp-date"><b>' + esc(fmtDate(c.startDate).slice(0, 5)) + '</b><span>' + esc(fmtDate(c.startDate).slice(6)) + '</span></div>' +
          '<div class="comp-info"><strong>' + esc(c.title) + '</strong>' +
            '<span class="muted small">' + esc(c.disciplineName) + ' · ' + esc(c.levelName) + ' · ' + esc(formatName(c.format)) + '</span></div>' +
          '<span class="chip chip-' + esc(c.status) + '">' + (c.status === 'registration' ? 'Приём заявок' : 'Анонс') + '</span>' +
        '</a>'
      ).join('')
      : '<p class="muted">Ближайших соревнований пока нет.</p>';

    var orgsHtml = data.organizations.map((o) =>
      '<div class="org-card"><strong>' + esc(o.name) + '</strong>' +
        '<span class="muted small">' + esc(o.type) + ' · ' + esc(o.municipality) + '</span></div>'
    ).join('');

    body.innerHTML =
      '<section class="land-section">' +
        '<div class="land-head"><h2>Шесть дисциплин</h2><p class="muted">Учёт, календарь, разряды и отчёты — по всем дисциплинам вида спорта.</p></div>' +
        '<div class="disc-grid">' + disciplinesHtml + '</div>' +
      '</section>' +
      '<section class="land-section">' +
        '<div class="land-head"><h2>Ближайшие соревнования</h2><p class="muted">Полный календарь доступен после входа.</p></div>' +
        '<div class="comp-list">' + compsHtml + '</div>' +
      '</section>' +
      '<section class="land-section">' +
        '<div class="land-head"><h2>Где заниматься</h2><p class="muted">Организации, ведущие подготовку в регионе.</p></div>' +
        '<div class="org-grid">' + orgsHtml + '</div>' +
      '</section>' +
      '<section class="land-section">' +
        '<div class="land-head"><h2>Как начать</h2></div>' +
        '<div class="steps">' +
          '<div class="step"><span>1</span><h3>Зарегистрируйтесь</h3><p>Создайте аккаунт спортсмена и укажите организацию.</p></div>' +
          '<div class="step"><span>2</span><h3>Подайте заявку</h3><p>Выберите соревнование, куда проходите по возрасту.</p></div>' +
          '<div class="step"><span>3</span><h3>Следите за результатами</h3><p>Протоколы, разряды и справки — в личном кабинете.</p></div>' +
        '</div>' +
      '</section>';
  } catch (e) {
    body.innerHTML = '<div class="card"><p>Не удалось загрузить данные: ' + esc(e.message) + '</p></div>';
  }
}

function authShell(title, subtitle, bodyHtml) {
  return '<div class="auth-wrap">' +
    '<div class="auth-side">' +
      '<a class="brand brand-light" href="#/">' +
        '<span class="brand-mark">ФСП</span>' +
        '<span class="brand-text"><strong>Оренбург</strong><small>цифровая платформа</small></span>' +
      '</a>' +
      '<div class="auth-side-text">' +
        '<h2>Единая платформа федерации</h2>' +
        '<p>Спортсмены, тренеры, судьи и организации. Календарь, заявки, протоколы, разряды, рейтинг и сборная региона.</p>' +
      '</div>' +
      '<div class="auth-side-foot">Демо-версия · данные вымышлены</div>' +
    '</div>' +
    '<div class="auth-main">' +
      '<div class="auth-card">' +
        '<h1>' + esc(title) + '</h1>' +
        '<p class="muted">' + esc(subtitle) + '</p>' +
        bodyHtml +
      '</div>' +
    '</div>' +
  '</div>';
}

export async function renderLogin(root) {
  var accounts = DEMO_ACCOUNTS.map((a) =>
    '<button type="button" class="demo-acc" data-login="' + esc(a.login) + '">' +
      '<code>' + esc(a.login) + '</code><span>' + esc(a.role) + '</span></button>'
  ).join('');

  root.innerHTML = authShell('Вход', 'Демо-пароль для всех аккаунтов: demo123',
    '<form id="login-form" class="form">' +
      inputField('Логин', 'login', '', 'text', 'autocomplete="username" required') +
      inputField('Пароль', 'password', 'demo123', 'password', 'autocomplete="current-password" required') +
      '<button class="btn wide" type="submit">Войти</button>' +
      '<p class="muted small center">Нет аккаунта? <a href="#/register">Зарегистрироваться</a></p>' +
    '</form>' +
    '<div class="demo-block"><span class="muted small">Быстрый вход в демо:</span><div class="demo-grid">' + accounts + '</div></div>');

  var form = root.querySelector('#login-form');
  form.login.value = '';

  root.querySelectorAll('[data-login]').forEach((btn) => {
    btn.onclick = () => {
      form.login.value = btn.dataset.login;
      form.password.value = 'demo123';
      form.login.focus();
    };
  });

  form.onsubmit = async (e) => {
    e.preventDefault();
    var submit = form.querySelector('button[type=submit]');
    submit.disabled = true;
    submit.textContent = 'Входим…';
    try {
      var res = await api.post('/auth/login', { login: form.login.value.trim(), password: form.password.value });
      state.me = res.user;
      state.role = res.activeRole;
      var me = await api.get('/me');
      state.unread = me.unread;
      location.hash = '#/dashboard';
      window.dispatchEvent(new Event('refresh-me'));
    } catch (err) {
      toast(err.message, 'error');
      submit.disabled = false;
      submit.textContent = 'Войти';
    }
  };
}

export async function renderRegister(root) {
  var orgs = [];
  try {
    var dict = state.dict || await api.get('/dictionaries');
    state.dict = dict;
  } catch (e) { /* без справочника тоже можно */ }

  var discOptions = (state.dict ? state.dict.disciplines : []).map((d) => ({ value: d.code, label: d.name }));

  root.innerHTML = authShell('Регистрация спортсмена', 'После регистрации доступен личный кабинет спортсмена',
    '<form id="reg-form" class="form">' +
      '<div class="form-grid">' +
        inputField('Фамилия, имя, отчество', 'fio', '', 'text', 'required') +
        inputField('Дата рождения', 'birthDate', '', 'date', 'required') +
        inputField('Логин', 'login', '', 'text', 'required') +
        inputField('Пароль', 'password', '', 'password', 'required minlength="6"') +
        inputField('Муниципалитет', 'municipality', '', 'text') +
        inputField('Год начала занятий', 'startYear', new Date().getFullYear(), 'number') +
      '</div>' +
      '<div class="field"><span class="field-label">Дисциплины</span>' +
        '<div class="check-grid">' + discOptions.map((d) =>
          '<label class="check"><input type="checkbox" name="disc" value="' + esc(d.value) + '"> ' + esc(d.label) + '</label>'
        ).join('') + '</div></div>' +
      '<div class="field"><span class="field-label">Организация</span>' +
        '<select class="input" name="organizationId" id="org-select"><option value="">Без организации</option></select></div>' +
      '<label class="check"><input type="checkbox" name="consent" required> Согласен(на) на обработку персональных данных</label>' +
      '<div id="guardian" class="guardian" hidden>' +
        '<p class="muted small">Для несовершеннолетнего нужно согласие законного представителя.</p>' +
        inputField('ФИО законного представителя', 'guardianFio', '') +
        '<label class="check"><input type="checkbox" name="guardianConsent"> Согласие представителя получено</label>' +
      '</div>' +
      '<button class="btn wide" type="submit">Зарегистрироваться</button>' +
      '<p class="muted small center">Уже есть аккаунт? <a href="#/login">Войти</a></p>' +
    '</form>');

  var form = root.querySelector('#reg-form');

  try {
    var orgList = await api.get('/organizations');
    var select = form.querySelector('#org-select');
    orgList.forEach((o) => {
      var opt = document.createElement('option');
      opt.value = o.id;
      opt.textContent = o.name;
      select.appendChild(opt);
    });
  } catch (e) { /* без организаций */ }

  function checkAge() {
    var birth = form.birthDate.value;
    if (!birth) return;
    var age = new Date().getFullYear() - new Date(birth).getFullYear();
    form.querySelector('#guardian').hidden = age >= 18;
  }
  form.birthDate.addEventListener('change', checkAge);
  checkAge();

  form.onsubmit = async (e) => {
    e.preventDefault();
    var disciplines = [...form.querySelectorAll('input[name=disc]:checked')].map((c) => c.value);
    var body = {
      fio: form.fio.value.trim(),
      birthDate: form.birthDate.value,
      login: form.login.value.trim(),
      password: form.password.value,
      municipality: form.municipality.value.trim(),
      startYear: form.startYear.value,
      organizationId: form.organizationId.value || null,
      disciplines,
      consent: form.consent.checked,
      guardianFio: form.guardianFio ? form.guardianFio.value.trim() : null,
      guardianConsent: form.guardianConsent ? form.guardianConsent.checked : false
    };

    var submit = form.querySelector('button[type=submit]');
    submit.disabled = true;
    submit.textContent = 'Создаём аккаунт…';

    try {
      var res = await api.post('/auth/register', body);
      state.me = res.user;
      state.role = 'athlete';
      var me = await api.get('/me');
      state.unread = me.unread;
      location.hash = '#/dashboard';
      window.dispatchEvent(new Event('refresh-me'));
    } catch (err) {
      toast(err.message, 'error');
      submit.disabled = false;
      submit.textContent = 'Зарегистрироваться';
    }
  };
}

export async function renderVerify(root, code) {
  root.innerHTML = publicHeader() +
    '<div class="verify-wrap"><div class="card verify-card" id="verify-card">' + loading('Проверяем справку…') + '</div></div>';

  var card = root.querySelector('#verify-card');
  try {
    var data = await api.get('/verify/' + encodeURIComponent(code));
    card.innerHTML =
      '<div class="verify-ok">' + icon('check', 28) + '</div>' +
      '<h2>Справка действительна</h2>' +
      '<p class="muted">Номер ' + esc(data.number) + '</p>' +
      '<dl class="facts">' +
        '<dt>Спортсмен</dt><dd>' + esc(data.fio) + '</dd>' +
        '<dt>Соревнование</dt><dd>' + esc(data.competition) + '</dd>' +
        '<dt>Дата</dt><dd>' + esc(fmtDate(data.date)) + '</dd>' +
        '<dt>Результат</dt><dd>' + (data.place ? data.place + ' место' : '—') + '</dd>' +
        '<dt>Статус</dt><dd><span class="chip chip-approved">действительна</span></dd>' +
      '</dl>' +
      '<p class="muted small">Проверка выполнена по коду из QR-кода на справке.</p>';
  } catch (e) {
    card.innerHTML =
      '<div class="verify-fail">✕</div>' +
      '<h2>Справка не найдена</h2>' +
      '<p class="muted">Код не соответствует ни одной выданной справке.</p>' +
      '<p><a class="btn" href="#/">На главную</a></p>';
  }
}

// Быстрая проверка API. Требует запущенного сервера.
const BASE = process.env.BASE || 'http://127.0.0.1:3000';

let cookie = '';
let passed = 0;
const failures = [];

async function req(method, path, body) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (cookie) headers.cookie = cookie;

  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual'
  });

  const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  if (setCookie.length) cookie = setCookie.map((c) => c.split(';')[0]).join('; ');

  const type = res.headers.get('content-type') || '';
  const data = type.includes('json') ? await res.json() : await res.arrayBuffer();
  return { status: res.status, data, type };
}

function check(name, condition, extra) {
  if (condition) {
    passed++;
    console.log('  ok   ' + name);
  } else {
    failures.push(name + (extra ? ' — ' + extra : ''));
    console.log('  FAIL ' + name + (extra ? ' — ' + extra : ''));
  }
}

(async () => {
  console.log('Проверка API: ' + BASE + '\n');

  const login = await req('POST', '/api/auth/login', { login: 'federation', password: 'demo123' });
  check('вход федерации', login.status === 200 && login.data.user);

  const me = await req('GET', '/api/me');
  check('текущий пользователь', me.status === 200 && me.data.activeRole === 'federation');

  const dash = await req('GET', '/api/dashboard');
  check('дашборд', dash.status === 200 && dash.data.kpis.length === 4);

  const comps = await req('GET', '/api/competitions');
  check('календарь', comps.status === 200 && comps.data.length > 0);

  const users = await req('GET', '/api/users?role=athlete');
  check('реестр спортсменов', users.status === 200 && users.data.length > 0);

  const rating = await req('GET', '/api/rating?discipline=algo');
  check('рейтинг', rating.status === 200 && rating.data.rows.length > 0);

  const apps = await req('GET', '/api/applications');
  check('заявки', apps.status === 200 && Array.isArray(apps.data));

  const xlsx = await req('GET', '/api/reports/headcount.xlsx');
  check('выгрузка численности', xlsx.status === 200 && xlsx.data.byteLength > 1000);

  const protocol = await req('GET', '/api/protocols/p_1');
  check('протокол', protocol.status === 200 && protocol.data.rows.length > 0);

  const certs = await req('GET', '/api/certificates');
  check('справки', certs.status === 200 && certs.data.length > 0);

  if (certs.data.length) {
    const verify = await fetch(BASE + '/api/verify/' + certs.data[0].verifyCode);
    check('публичная проверка справки', verify.status === 200);
  }

  const audit = await req('GET', '/api/audit');
  check('журнал действий', audit.status === 200 && Array.isArray(audit.data));

  const logout = await req('POST', '/api/auth/logout');
  check('выход', logout.status === 200);

  console.log('\nПройдено: ' + passed + ', ошибок: ' + failures.length);
  if (failures.length) {
    failures.forEach((f) => console.log(' - ' + f));
    process.exit(1);
  }
})().catch((e) => {
  console.error('Проверка не запустилась:', e.message);
  process.exit(1);
});

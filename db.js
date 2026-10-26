// Простое хранилище: один JSON-файл, чтение в память, запись целиком.
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

let data = null;

function emptyDb() {
  return {
    users: [],
    organizations: [],
    competitions: [],
    applications: [],
    results: [],
    protocols: [],
    rankApplications: [],
    judgeAssignments: [],
    judgeCategoryApplications: [],
    trainerLinks: [],
    teams: [],
    certificates: [],
    notifications: [],
    auditLog: [],
    settings: {},
    dictionaries: {},
    counters: {}
  };
}

function load() {
  if (data) return data;
  if (!fs.existsSync(DB_FILE)) {
    data = emptyDb();
    return data;
  }
  data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  return data;
}

function save(next) {
  if (next) data = next;
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// Простой счётчик id: u_1, u_2, ...
function nextId(prefix) {
  const db = load();
  db.counters[prefix] = (db.counters[prefix] || 0) + 1;
  return prefix + '_' + db.counters[prefix];
}

module.exports = { load, save, emptyDb, nextId, DATA_DIR, DB_FILE };

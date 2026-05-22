import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import initSqlJs from 'sql.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {string} */
let dbFilePath = '';

/**
 * @param {import('sql.js').Database} database
 */
function persist(database) {
  const data = database.export();
  const buf = Buffer.from(data);
  fs.mkdirSync(path.dirname(dbFilePath), { recursive: true });
  fs.writeFileSync(dbFilePath, buf);
}

/**
 * @param {import('sql.js').Database} database
 * @returns {number}
 */
function lastInsertRowid(database) {
  var r = database.exec('SELECT last_insert_rowid() AS id');
  if (!r.length || !r[0].values || !r[0].values.length) {
    return 0;
  }
  return Number(r[0].values[0][0]);
}

/**
 * @param {string} dbPath
 * @returns {Promise<import('sql.js').Database>}
 */
export async function openDatabase(dbPath) {
  dbFilePath = dbPath;
  var dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  var distDir = path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist');
  var SQL = await initSqlJs({
    locateFile: function (file) {
      return path.join(distDir, file);
    },
  });

  /** @type {import('sql.js').Database} */
  var database;
  if (fs.existsSync(dbPath)) {
    var fileBuffer = fs.readFileSync(dbPath);
    database = new SQL.Database(fileBuffer);
  } else {
    database = new SQL.Database();
  }

  database.run(`
    CREATE TABLE IF NOT EXISTS contact_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      message TEXT NOT NULL
    );
  `);
  database.run(
    'CREATE INDEX IF NOT EXISTS idx_contact_created ON contact_submissions(created_at);',
  );

  database.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      email TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL
    );
  `);
  database.run('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);');

  database.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT NOT NULL UNIQUE,
      user_id INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );
  `);
  database.run('CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);');
  database.run('CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);');

  persist(database);
  return database;
}

/**
 * @param {import('sql.js').Database} database
 * @param {{ name: string; email: string; phone: string; message: string }} row
 * @returns {number}
 */
export function insertContactSubmission(database, row) {
  database.run('INSERT INTO contact_submissions (name, email, phone, message) VALUES (?, ?, ?, ?)', [
    row.name,
    row.email,
    row.phone,
    row.message,
  ]);
  var id = lastInsertRowid(database);
  persist(database);
  return id;
}

/**
 * @param {import('sql.js').Database} database
 * @param {{ email: string; displayName: string; salt: string; hash: string }} row
 * @returns {number}
 */
export function insertUser(database, row) {
  database.run(
    'INSERT INTO users (email, display_name, password_salt, password_hash) VALUES (?, ?, ?, ?)',
    [row.email, row.displayName, row.salt, row.hash],
  );
  var id = lastInsertRowid(database);
  persist(database);
  return id;
}

/**
 * @param {import('sql.js').Database} database
 * @param {string} email
 * @returns {{ id: number; email: string; display_name: string; password_salt: string; password_hash: string } | null}
 */
export function getUserByEmail(database, email) {
  var stmt = database.prepare(
    'SELECT id, email, display_name, password_salt, password_hash FROM users WHERE lower(email) = lower(?) LIMIT 1',
  );
  stmt.bind([email]);
  if (!stmt.step()) {
    stmt.free();
    return null;
  }
  var o = stmt.getAsObject();
  stmt.free();
  return {
    id: Number(o.id),
    email: String(o.email),
    display_name: String(o.display_name),
    password_salt: String(o.password_salt),
    password_hash: String(o.password_hash),
  };
}

/**
 * @param {import('sql.js').Database} database
 */
export function deleteExpiredSessions(database) {
  database.run('DELETE FROM sessions WHERE expires_at < ?', [Date.now()]);
  persist(database);
}

/**
 * @param {import('sql.js').Database} database
 * @param {number} userId
 */
export function deleteSessionsForUser(database, userId) {
  database.run('DELETE FROM sessions WHERE user_id = ?', [userId]);
  persist(database);
}

/**
 * @param {import('sql.js').Database} database
 * @param {string} token
 * @param {number} userId
 * @param {number} expiresAtMs
 */
export function insertSession(database, token, userId, expiresAtMs) {
  database.run('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)', [token, userId, expiresAtMs]);
  persist(database);
}

/**
 * @param {import('sql.js').Database} database
 * @param {string} token
 * @param {number} nowMs
 * @returns {{ userId: number; email: string; display_name: string } | null}
 */
export function getSessionUser(database, token, nowMs) {
  var stmt = database.prepare(
    'SELECT u.id AS user_id, u.email AS email, u.display_name AS display_name FROM sessions s INNER JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > ? LIMIT 1',
  );
  stmt.bind([token, nowMs]);
  if (!stmt.step()) {
    stmt.free();
    return null;
  }
  var o = stmt.getAsObject();
  stmt.free();
  return {
    userId: Number(o.user_id),
    email: String(o.email),
    display_name: String(o.display_name),
  };
}

/**
 * @param {import('sql.js').Database} database
 * @param {string} token
 */
export function deleteSession(database, token) {
  database.run('DELETE FROM sessions WHERE token = ?', [token]);
  persist(database);
}

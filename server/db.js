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

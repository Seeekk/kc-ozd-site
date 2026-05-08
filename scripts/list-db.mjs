/**
 * Печать последних заявок из data/contacts.db (sql.js, без sqlite3 CLI).
 * Запуск: npm run db:list
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import initSqlJs from 'sql.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dbPath = process.env.DATABASE_PATH || path.join(root, 'data', 'contacts.db');

if (!fs.existsSync(dbPath)) {
  process.stdout.write('Файл БД не найден: ' + dbPath + '\nСначала отправьте форму с запущенным сервером.\n');
  process.exit(0);
}

var distDir = path.join(root, 'node_modules', 'sql.js', 'dist');
var SQL = await initSqlJs({
  locateFile: function (file) {
    return path.join(distDir, file);
  },
});

var buf = fs.readFileSync(dbPath);
var db = new SQL.Database(buf);

var sql =
  'SELECT id, created_at, name, email, phone, substr(message, 1, 80) AS msg FROM contact_submissions ORDER BY id DESC LIMIT 50';
var res = db.exec(sql);

if (!res.length || !res[0].columns) {
  process.stdout.write('Таблица пуста или нет колонок.\n');
  process.exit(0);
}

var cols = res[0].columns;
var rows = res[0].values;
process.stdout.write('Записей: ' + rows.length + '\n\n');
for (var i = 0; i < rows.length; i++) {
  process.stdout.write('--- #' + (i + 1) + ' ---\n');
  for (var j = 0; j < cols.length; j++) {
    process.stdout.write(cols[j] + ': ' + String(rows[i][j] != null ? rows[i][j] : '') + '\n');
  }
  process.stdout.write('\n');
}

db.close();

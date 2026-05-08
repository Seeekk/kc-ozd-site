import express from 'express';
import rateLimit from 'express-rate-limit';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { openDatabase, insertContactSubmission } from './db.js';
import { stripAndTruncate } from './sanitize.js';
import {
  validateEmail,
  validatePhoneOptional,
  validatePersonName,
  validateRequiredText,
} from '../js/modules/validation.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dbPath = process.env.DATABASE_PATH || path.join(root, 'data', 'contacts.db');

/**
 * @param {import('express').Express} app
 * @param {number} port
 * @param {string} host 0.0.0.0 — доступ из локальной сети (телефон, другой ПК)
 * @returns {Promise<import('http').Server>}
 */
function listenOnPort(app, port, host) {
  return new Promise(function (resolve, reject) {
    var srv = app.listen(port, host, function () {
      resolve(srv);
    });
    srv.on('error', function (err) {
      reject(err);
    });
  });
}

/**
 * @param {number} port
 * @returns {string[]}
 */
function getLanIPv4Addresses() {
  var nets = os.networkInterfaces();
  var out = [];
  for (var name of Object.keys(nets)) {
    var group = nets[name];
    if (!group) {
      continue;
    }
    for (var i = 0; i < group.length; i++) {
      var net = group[i];
      if (!net || net.internal) {
        continue;
      }
      var fam = net.family;
      if (fam === 'IPv4' || fam === 4) {
        out.push(net.address);
      }
    }
  }
  return out;
}

async function main() {
  var db;
  try {
    db = await openDatabase(dbPath);
  } catch (e) {
    process.stderr.write(
      'Ошибка базы (sql.js). Выполните в этой папке: npm install\n' + String(e && e.message ? e.message : e) + '\n',
    );
    process.exit(1);
    return;
  }

  var app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '48kb' }));

  var contactLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 40,
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.post('/api/contact', contactLimiter, function (req, res) {
    var body = req.body && typeof req.body === 'object' ? req.body : {};
    var name = stripAndTruncate(body.name, 120);
    var email = stripAndTruncate(body.email, 254).toLowerCase();
    var phone = stripAndTruncate(body.phone, 32);
    var message = stripAndTruncate(body.message, 4000);

    if (!validatePersonName(name)) {
      return res.status(400).json({ ok: false, error: 'name', message: 'Некорректное имя.' });
    }
    if (!validateEmail(email)) {
      return res.status(400).json({ ok: false, error: 'email', message: 'Некорректный e-mail.' });
    }
    if (!validatePhoneOptional(phone)) {
      return res.status(400).json({ ok: false, error: 'phone', message: 'Некорректный телефон.' });
    }
    if (!validateRequiredText(message, 4000)) {
      return res.status(400).json({ ok: false, error: 'message', message: 'Введите сообщение.' });
    }

    try {
      var id = insertContactSubmission(db, {
        name: name,
        email: email,
        phone: phone,
        message: message,
      });
      return res.status(201).json({ ok: true, id: id });
    } catch (err) {
      return res.status(500).json({ ok: false, error: 'server', message: 'Ошибка записи в базу.' });
    }
  });

  app.get('/api/health', function (_req, res) {
    res.json({ ok: true, db: true });
  });

  app.use(express.static(root));

  var basePort = Number(process.env.PORT);
  if (!Number.isFinite(basePort) || basePort < 1) {
    basePort = 3000;
  }

  var host = typeof process.env.HOST === 'string' && process.env.HOST.trim() ? process.env.HOST.trim() : '0.0.0.0';

  var lastErr = null;
  for (var p = basePort; p < basePort + 25; p++) {
    try {
      await listenOnPort(app, p, host);
      process.stdout.write('\n--- Локально (этот ПК) ---\n');
      process.stdout.write('http://127.0.0.1:' + p + '/\n');
      process.stdout.write('http://127.0.0.1:' + p + '/contacts.html\n');

      if (host === '0.0.0.0' || host === '::') {
        var addrs = getLanIPv4Addresses();
        if (addrs.length) {
          process.stdout.write('\n--- Сеть (телефон / планшет / другой ПК в одной Wi-Fi) ---\n');
          for (var a = 0; a < addrs.length; a++) {
            process.stdout.write('http://' + addrs[a] + ':' + p + '/\n');
            process.stdout.write('http://' + addrs[a] + ':' + p + '/contacts.html\n');
          }
          process.stdout.write(
            '\nПодключите устройство к той же Wi-Fi сети. Если не открывается — разрешите Node.js в брандмауэре Windows для «частной» сети.\n',
          );
        } else {
          process.stdout.write('\n(Не найдены IPv4-адреса LAN — проверьте Wi‑Fi / Ethernet.)\n');
        }
      }

      process.stdout.write('\nSQLite: ' + dbPath + '\n');
      process.stdout.write('HOST=' + host + '\n');
      if (p !== basePort) {
        process.stdout.write('(порт ' + basePort + ' был занят — использован ' + p + ')\n');
      }
      return;
    } catch (e) {
      lastErr = e;
      if (e && e.code === 'EADDRINUSE') {
        continue;
      }
      throw e;
    }
  }

  process.stderr.write(
    'Не удалось занять порт с ' +
      basePort +
      '. Закройте старый node (или окно с сервером) либо задайте другой порт:\n' +
      '  set PORT=3010\n' +
      '  npm run server\n',
  );
  if (lastErr) {
    process.stderr.write(String(lastErr.message || lastErr) + '\n');
  }
  process.exit(1);
}

main().catch(function (e) {
  process.stderr.write('Ошибка запуска: ' + String(e && e.stack ? e.stack : e) + '\n');
  process.exit(1);
});

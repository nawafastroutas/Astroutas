#!/usr/bin/env node
/** نقطة التشغيل. */
import http from 'node:http';
import config from './src/config.js';
import { getDb } from './src/db/index.js';
import { handle } from './src/app.js';
import './src/routes/index.js';        // يسجّل كل المسارات

getDb();                                // تهيئة القاعدة والمخطّط

const server = http.createServer((req, res) => {
  handle(req, res).catch((err) => {
    console.error('[خطأ غير ملتقَط]', err);
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('خلل في الخادم');
  });
});

server.listen(config.port, config.host, () => {
  console.log(`${config.club.name} — يعمل على http://localhost:${config.port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  });
}

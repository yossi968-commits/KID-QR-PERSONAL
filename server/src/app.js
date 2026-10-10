import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readToken } from './lib/auth.js';
import { HttpError } from './lib/http.js';
import { OutboxNotifier } from './adapters/notifier.js';
import authRoutes from './routes/auth.js';
import childRoutes from './routes/children.js';
import publicRoutes from './routes/public.js';
import adminRoutes from './routes/admin.js';
import kidRoutes from './routes/kid.js';

const here = path.dirname(fileURLToPath(import.meta.url));

export function createApp({ db, partner, payments, notifier = new OutboxNotifier(db) }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  const ctx = { db, partner, payments, notifier };
  app.use((req, _res, next) => {
    const raw = req.get('authorization')?.replace(/^Bearer /, '');
    const t = readToken(raw);
    req.user = t?.uid ? db.prepare('SELECT * FROM users WHERE id=?').get(t.uid) || null : null;
    req.child = t?.cid ? db.prepare('SELECT * FROM children WHERE id=?').get(t.cid) || null : null;
    req.ctx = ctx;
    next();
  });

  app.get('/api/health', (_req, res) => res.json({ ok: true, partner: partner.name, payments: payments.name }));
  app.use('/api/auth', authRoutes);
  app.use('/api/children', childRoutes);
  app.use('/api/kid', kidRoutes);
  app.use('/api', publicRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'not_found')));

  // Serve the built web app (SPA) in production.
  const dist = path.resolve(here, '../../web/dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist, { index: false, maxAge: '1h' }));
    app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, _next) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.code });
    if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'invalid_json' });
    console.error(err);
    res.status(500).json({ error: 'server_error' });
  });

  return app;
}

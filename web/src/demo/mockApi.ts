/**
 * In-browser backend for the demo build (VITE_DEMO=1). It runs the real server code:
 * the same route modules, data layer, sandbox adapters and seed, on an in-memory
 * SQLite database (sql.js), with tiny shims for Express and node built-ins.
 */
import { ready } from './shims/sqlite';
import { NO_MATCH } from './shims/express';
import { ApiError } from '../lib/api';
// @ts-ignore - plain JS modules shared with the server
import { openDb } from '../../../server/src/db.js';
// @ts-ignore
import { seed } from '../../../server/src/seed.js';
// @ts-ignore
import { readToken } from '../../../server/src/lib/auth.js';
// @ts-ignore
import { HttpError } from '../../../server/src/lib/http.js';
// @ts-ignore
import { SandboxInvestmentPartner } from '../../../server/src/adapters/investment-partner.js';
// @ts-ignore
import { SandboxPayments } from '../../../server/src/adapters/payments.js';
// @ts-ignore
import { OutboxNotifier } from '../../../server/src/adapters/notifier.js';
// @ts-ignore
import authRoutes from '../../../server/src/routes/auth.js';
// @ts-ignore
import childRoutes from '../../../server/src/routes/children.js';
// @ts-ignore
import kidRoutes from '../../../server/src/routes/kid.js';
// @ts-ignore
import employerRoutes, { workRoutes } from '../../../server/src/routes/employer.js';
// @ts-ignore
import publicRoutes from '../../../server/src/routes/public.js';
// @ts-ignore
import adminRoutes from '../../../server/src/routes/admin.js';

// Same mount order as server/src/app.js.
const MOUNTS: [string, any][] = [['/auth', authRoutes], ['/children', childRoutes], ['/kid', kidRoutes], ['/employer', employerRoutes], ['/work', workRoutes], ['', publicRoutes], ['/admin', adminRoutes]];

const boot = ready.then(() => {
  const db = openDb(':memory:');
  const partner = new SandboxInvestmentPartner();
  seed(db, partner);
  // The demo shows the SMS code on screen, since no SMS is sent.
  return { db, partner, payments: new SandboxPayments(), notifier: new OutboxNotifier(db), exposeOtp: true };
});

export async function mockApi(path: string, opts: { method?: string; body?: unknown }, token: string | null) {
  const ctx = await boot;
  await new Promise((r) => setTimeout(r, 60));
  const [p, q] = path.split('?');
  const t = readToken(token);
  const req: any = {
    method: opts.method || (opts.body ? 'POST' : 'GET'),
    query: Object.fromEntries(new URLSearchParams(q)),
    body: opts.body ? JSON.parse(JSON.stringify(opts.body)) : {},
    params: {},
    ctx,
    user: t?.uid ? ctx.db.prepare('SELECT * FROM users WHERE id=?').get(t.uid) || null : null,
    child: t?.cid ? ctx.db.prepare('SELECT * FROM children WHERE id=?').get(t.cid) || null : null,
    employer: t?.eid ? ctx.db.prepare('SELECT * FROM employers WHERE id=?').get(t.eid) || null : null,
    get: () => undefined,
  };
  let out: { status: number; body: any } | null = null;
  const res: any = {
    statusCode: 200,
    status(c: number) { this.statusCode = c; return this; },
    set() { return this; },
    json(body: unknown) { out = { status: this.statusCode, body: JSON.parse(JSON.stringify(body)) }; this.onEnd?.(); return this; },
  };
  try {
    for (const [prefix, router] of MOUNTS) {
      if (!(p === prefix || p.startsWith(prefix + '/'))) continue;
      req.path = p.slice(prefix.length) || '/';
      try { await router.handle(req, res); break; } catch (e) { if (e !== NO_MATCH) throw e; }
    }
  } catch (e) {
    if (e instanceof HttpError) throw new ApiError((e as any).status, (e as any).code);
    console.error(e);
    throw new ApiError(500, 'server_error');
  }
  if (!out) throw new ApiError(404, 'not_found');
  const { status, body } = out as { status: number; body: any };
  if (status >= 400) throw new ApiError(status, body?.error || 'server_error');
  return body;
}

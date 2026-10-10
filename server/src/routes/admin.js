import { Router } from 'express';
import { h } from '../lib/http.js';
import { requireAdmin } from '../lib/guards.js';
import { holdings } from '../lib/portfolio.js';
import { today } from '../lib/dates.js';
import { runDuePledges } from '../lib/pledges.js';

const r = Router();
r.use(requireAdmin);

r.get('/stats', h((req, res) => {
  const { db, partner } = req.ctx;
  const one = (sql) => db.prepare(sql).get();
  const children = db.prepare('SELECT id FROM children').all();
  const aum = children.reduce(
    (s, c) => s + holdings(db, c.id).reduce((a, h2) => a + h2.units * partner.navOn(h2.track, today()) * 100, 0),
    0
  );
  const monthly = db
    .prepare(`SELECT substr(paid_at,1,7) AS month, COUNT(*) AS gifts, SUM(amount) AS amount FROM contributions
              WHERE status='invested' GROUP BY month ORDER BY month DESC LIMIT 12`)
    .all()
    .reverse();
  const byTrack = db.prepare('SELECT track, COUNT(*) AS children FROM children GROUP BY track').all();
  res.json({
    users: one('SELECT COUNT(*) AS n FROM users').n,
    verifiedGuardians: one(`SELECT COUNT(*) AS n FROM users WHERE kyc_status='verified'`).n,
    children: children.length,
    gifts: one(`SELECT COUNT(*) AS n FROM contributions WHERE status='invested'`).n,
    giftVolume: one(`SELECT COALESCE(SUM(amount),0) AS s FROM contributions WHERE status='invested'`).s,
    avgGift: Math.round(one(`SELECT COALESCE(AVG(amount),0) AS a FROM contributions WHERE status='invested'`).a),
    pending: one(`SELECT COUNT(*) AS n FROM contributions WHERE status='pending'`).n,
    aum: Math.round(aum),
    monthly,
    byTrack,
    withdrawalsPaid: one(`SELECT COALESCE(SUM(amount),0) AS s FROM withdrawals WHERE status='paid'`).s,
    withdrawalsPending: one(`SELECT COUNT(*) AS n FROM withdrawals WHERE status='requested'`).n,
    activePledges: one(`SELECT COUNT(*) AS n FROM pledges WHERE status='active'`).n,
    monthlyRecurring: one(`SELECT COALESCE(SUM(amount),0) AS s FROM pledges WHERE status='active'`).s,
    bySource: db.prepare(`SELECT COALESCE(source,'gift') AS source, COUNT(*) AS n, SUM(amount) AS amount FROM contributions WHERE status='invested' GROUP BY 1 ORDER BY 3 DESC`).all(),
    byMethod: db.prepare(`SELECT COALESCE(method,'card') AS method, COUNT(*) AS gifts, SUM(amount) AS amount FROM contributions WHERE status='invested' GROUP BY 1 ORDER BY 3 DESC`).all(),
  });
}));

r.get('/users', h((req, res) => {
  const rows = req.ctx.db
    .prepare(`SELECT u.id, u.email, u.name, u.role, u.kyc_status, u.created_at, COUNT(c.id) AS children
              FROM users u LEFT JOIN children c ON c.guardian_id=u.id GROUP BY u.id ORDER BY u.id DESC LIMIT 200`)
    .all();
  res.json({ users: rows });
}));

r.get('/contributions', h((req, res) => {
  const rows = req.ctx.db
    .prepare(`SELECT x.id, x.giver_name, x.amount, x.status, x.payment_ref, x.method, x.pledge_id, x.created_at, x.paid_at, c.first_name AS child, c.partner_account_id
              FROM contributions x JOIN children c ON c.id=x.child_id ORDER BY x.id DESC LIMIT 200`)
    .all();
  res.json({ contributions: rows });
}));

r.get('/outbox', h((req, res) => {
  res.json({ messages: req.ctx.db.prepare('SELECT * FROM outbox ORDER BY id DESC LIMIT 100').all() });
}));

r.get('/audit', h((req, res) => {
  res.json({ entries: req.ctx.db.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT 200').all() });
}));

r.get('/pledges', h((req, res) => {
  res.json({
    pledges: req.ctx.db
      .prepare(`SELECT p.*, c.first_name AS child FROM pledges p JOIN children c ON c.id=p.child_id ORDER BY p.id DESC LIMIT 200`)
      .all()
      .map((p) => ({ id: p.id, child: p.child, giverName: p.giver_name, amount: p.amount, method: p.method, status: p.status, nextDate: p.next_date, charges: p.charges })),
  });
}));

/** Run the monthly-gift scheduler now (it also runs automatically every few hours). */
r.post('/pledges/run', h((req, res) => res.json(runDuePledges(req.ctx))));

export default r;

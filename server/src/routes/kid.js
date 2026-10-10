import { Router } from 'express';
import { verifyPassword, issueChildToken } from '../lib/auth.js';
import { h, notFound, HttpError } from '../lib/http.js';
import { portfolioSummary } from '../lib/portfolio.js';
import { childView, giftsFor, lessonsPayload, completeLesson } from '../lib/child-data.js';
import { plannerPayload, withdrawalBudget, taxEstimate } from '../lib/wishes.js';
import { validWish } from './children.js';
import { startContribution } from '../lib/contribute.js';
import { pledgeView } from '../lib/pledges.js';
import { bad, toAgorot } from '../lib/http.js';

/** The child's own portal: read-only money view, gifts and lessons. */
const r = Router();

r.post('/login', h((req, res) => {
  const { db } = req.ctx;
  const c = db.prepare('SELECT * FROM children WHERE kid_username=?').get(String(req.body.username || '').trim().toLowerCase());
  if (!c?.kid_pin_hash || !verifyPassword(String(req.body.pin || ''), c.kid_pin_hash)) throw new HttpError(401, 'bad_kid_credentials');
  res.json({ token: issueChildToken(c), child: childView(c) });
}));

r.use((req, _res, next) => next(req.child ? undefined : new HttpError(401, 'unauthorized')));

r.get('/me', h((req, res) => {
  const { db, partner } = req.ctx;
  const p = portfolioSummary(db, partner, req.child);
  const { partnerAccountId, ...child } = childView(req.child);
  res.json({ child, portfolio: p });
}));

r.get('/gifts', h((req, res) => res.json({ gifts: giftsFor(req.ctx.db, req.child) })));

r.get('/lessons', h((req, res) => res.json(lessonsPayload(req.ctx.db, req.child, req.query.locale || 'he'))));

r.post('/lessons/:lid/complete', h((req, res) => {
  const g = completeLesson(req.ctx.db, req.child, req.params.lid, req.body.answers);
  if (!g) throw notFound();
  res.json(g);
}));

// The child plans gifts and asks for a withdrawal; a parent approves and chooses the payout.
r.get('/planner', h((req, res) => res.json(plannerPayload(req.ctx.db, req.ctx.partner, req.child))));

r.post('/wishes', h((req, res) => {
  const w = validWish(req.body);
  req.ctx.db.prepare('INSERT INTO wishes (child_id, title, icon, target_amount, target_date, created_by) VALUES (?,?,?,?,?,?)').run(req.child.id, w.title, w.icon, w.targetAmount, w.targetDate, 'child');
  res.status(201).json(plannerPayload(req.ctx.db, req.ctx.partner, req.child));
}));

r.post('/withdrawals', h((req, res) => {
  const { db, partner, notifier } = req.ctx;
  const amount = toAgorot(req.body.amount);
  if (amount > withdrawalBudget(db, partner, req.child).available) throw bad('over_budget');
  const wishId = req.body.wishId && db.prepare('SELECT 1 FROM wishes WHERE id=? AND child_id=?').get(Number(req.body.wishId), req.child.id) ? Number(req.body.wishId) : null;
  db.prepare('INSERT INTO withdrawals (child_id, wish_id, amount, requested_by, tax_estimate, note) VALUES (?,?,?,?,?,?)')
    .run(req.child.id, wishId, amount, 'child', taxEstimate(db, partner, req.child.id, amount), req.body.note ? String(req.body.note).slice(0, 200) : null);
  const g = db.prepare('SELECT email FROM users WHERE id=?').get(req.child.guardian_id);
  notifier.send({ to: g.email, subject: `${req.child.first_name} מבקש/ת למשוך ₪${amount / 100}`, body: 'הבקשה מחכה לאישורך באפליקציה.' });
  res.status(201).json(plannerPayload(db, partner, req.child));
}));

/**
 * The child deposits their own money (pocket money, earnings, part of a salary),
 * one-time or as a monthly standing deposit. Payment is made by whoever pays; the
 * child is recorded as the depositor.
 */
r.post('/deposits', h((req, res) => {
  const source = req.body.source && req.body.source !== 'gift' ? req.body.source : 'pocket_money';
  res.status(201).json(startContribution(req.ctx, req.child, { ...req.body, source, giverName: req.child.first_name, isPublic: false }));
}));

r.get('/deposits', h((req, res) => {
  const { db } = req.ctx;
  res.json({
    pledges: db.prepare(`SELECT * FROM pledges WHERE child_id=? AND source<>'gift' ORDER BY id DESC`).all(req.child.id).map(pledgeView),
    deposits: db
      .prepare(`SELECT id, amount, source, method, pledge_id, paid_at, giver_name FROM contributions WHERE child_id=? AND status='invested' AND source<>'gift' ORDER BY paid_at DESC LIMIT 50`)
      .all(req.child.id)
      .map((x) => ({ id: x.id, amount: x.amount, source: x.source, method: x.method, monthly: Boolean(x.pledge_id), paidAt: x.paid_at, payer: x.giver_name })),
  });
}));

export default r;

import { Router } from 'express';
import { verifyPassword, issueChildToken } from '../lib/auth.js';
import { h, notFound, HttpError } from '../lib/http.js';
import { portfolioSummary } from '../lib/portfolio.js';
import { childView, giftsFor, lessonsPayload, completeLesson } from '../lib/child-data.js';
import { plannerPayload, withdrawalLimit, taxEstimate, executeWithdrawal } from '../lib/wishes.js';
import { phaseOf, graduate } from '../lib/lifecycle.js';
import { nextSwitchDate, docsStatus, submitDocument, transferProvider } from '../lib/fund.js';
import { switchTrack } from '../lib/portfolio.js';
import { PAYOUT_METHODS } from '../adapters/payments.js';
import { EVENT_TYPES } from '../lib/contribute.js';
import { requireString, requireDate } from '../lib/http.js';
import { today } from '../lib/dates.js';
import { validWish } from './children.js';
import { startContribution, isEarning } from '../lib/contribute.js';
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
  const events = phaseOf(req.child) === 'minor' ? [] : db.prepare('SELECT * FROM events WHERE child_id=? AND active=1 ORDER BY date').all(req.child.id);
  res.json({ child: { ...child, ...(phaseOf(req.child) !== 'minor' && { partnerAccountId }) }, portfolio: p, events });
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
  if (req.child.account_status !== 'active') throw bad('fund_not_open');
  const limit = withdrawalLimit(db, partner, req.child, req.body.purpose);
  if (amount > limit.available) throw bad('over_budget');
  const wishId = req.body.wishId && db.prepare('SELECT 1 FROM wishes WHERE id=? AND child_id=?').get(Number(req.body.wishId), req.child.id) ? Number(req.body.wishId) : null;
  const adult = phaseOf(req.child) !== 'minor';
  let target = null;
  if (adult) {
    // A young adult withdraws on their own signature, to their own app, card or account.
    if (!PAYOUT_METHODS.includes(req.body.method)) throw bad('invalid_payout_method');
    target = { method: req.body.method, destination: requireString(req.body.destination, 'destination', { max: 60 }) };
  }
  const ins = db.prepare('INSERT INTO withdrawals (child_id, wish_id, amount, requested_by, tax_estimate, note, purpose) VALUES (?,?,?,?,?,?,?)')
    .run(req.child.id, wishId, amount, 'child', taxEstimate(db, partner, req.child.id, amount), req.body.note ? String(req.body.note).slice(0, 200) : null, limit.purpose);
  if (adult) {
    executeWithdrawal(req.ctx, req.child, db.prepare('SELECT * FROM withdrawals WHERE id=?').get(ins.lastInsertRowid), target);
    return res.status(201).json(plannerPayload(db, partner, req.child));
  }
  const g = db.prepare('SELECT email FROM users WHERE id=?').get(req.child.guardian_id);
  notifier.send({ to: g.email, subject: `${req.child.first_name} מבקש/ת למשוך ₪${amount / 100}${limit.purpose === 'driving' ? ' לשיעורי נהיגה' : ''}`, body: 'הבקשה מחכה לאישורך באפליקציה.' });
  res.status(201).json(plannerPayload(db, partner, req.child));
}));

/**
 * The child deposits their own money (pocket money, earnings, part of a salary),
 * one-time or as a monthly standing deposit. Payment is made by whoever pays; the
 * child is recorded as the depositor.
 */
r.post('/deposits', h((req, res) => {
  const source = isEarning(req.body.source) ? req.body.source : 'pocket_money';
  res.status(201).json(startContribution(req.ctx, req.child, { ...req.body, source, giverName: req.child.first_name, isPublic: false }));
}));

r.get('/deposits', h((req, res) => {
  const { db } = req.ctx;
  res.json({
    pledges: db.prepare(`SELECT * FROM pledges WHERE child_id=? AND source NOT IN ('gift','employer_gift','event_gifts','provider_gift') ORDER BY id DESC`).all(req.child.id).map(pledgeView),
    deposits: db
      .prepare(`SELECT id, amount, source, method, pledge_id, paid_at, giver_name FROM contributions WHERE child_id=? AND status IN ('paid','invested') AND source NOT IN ('gift','employer_gift','event_gifts','provider_gift') ORDER BY paid_at DESC LIMIT 50`)
      .all(req.child.id)
      .map((x) => ({ id: x.id, amount: x.amount, source: x.source, method: x.method, monthly: Boolean(x.pledge_id), paidAt: x.paid_at, payer: x.giver_name })),
  });
}));

// ---- From 18: the young adult manages the fund ----

const selfManaged = (req, _res, next) => next(phaseOf(req.child) === 'minor' ? new HttpError(403, 'managed_by_guardians') : undefined);

r.post('/track', selfManaged, h((req, res) => {
  const { db, partner } = req.ctx;
  const c = req.child;
  if (c.graduated_at) throw bad('managed_at_new_fund');
  if (!partner.listTracks().some((t) => t.id === req.body.track)) throw bad('invalid_track');
  if (req.body.track === c.track) return res.json({ moved: 0 });
  const next = nextSwitchDate(c);
  if (next && today() < next) throw bad('track_switch_quarter');
  const out = switchTrack(db, partner, c, req.body.track);
  db.prepare('UPDATE children SET track_changed_at=? WHERE id=?').run(today(), c.id);
  res.json(out);
}));

/** Gift occasions the young adult opens on their QR: enlistment, graduation, a wedding. */
r.post('/events', selfManaged, h((req, res) => {
  const { db } = req.ctx;
  const type = EVENT_TYPES.includes(req.body.type) ? req.body.type : 'other';
  const title = requireString(req.body.title, 'title', { max: 60 });
  const date = requireDate(req.body.date, 'date');
  const goal = req.body.goalAmount ? toAgorot(req.body.goalAmount, 'goal_amount') : null;
  const { lastInsertRowid } = db.prepare('INSERT INTO events (child_id, type, title, date, goal_amount) VALUES (?,?,?,?,?)').run(req.child.id, type, title, date, goal);
  res.status(201).json({ event: db.prepare('SELECT * FROM events WHERE id=?').get(lastInsertRowid) });
}));

r.delete('/events/:eid', selfManaged, h((req, res) => {
  req.ctx.db.prepare('UPDATE events SET active=0 WHERE id=? AND child_id=?').run(Number(req.params.eid), req.child.id);
  res.json({ ok: true });
}));

/** An adult saver completes the opening checklist of their own fund. */
r.get('/documents', selfManaged, h((req, res) => res.json(docsStatus(req.ctx.db, req.child))));

r.post('/documents/:doc', selfManaged, h((req, res) => {
  const out = submitDocument(req.ctx, req.child, req.params.doc, req.body);
  if (!out) throw notFound();
  if (out.error) throw bad(out.error);
  res.json(out);
}));

/** From 18 the young adult may move the fund to another investment house on their own signature. */
r.post('/provider', selfManaged, h((req, res) => {
  const out = transferProvider(req.ctx, req.child, req.body.provider);
  if (out.error) throw bad(out.error);
  res.json({ ...out, child: childView(req.ctx.db.prepare('SELECT * FROM children WHERE id=?').get(req.child.id)) });
}));

/** Whether the parents keep seeing the fund after 18. */
r.post('/privacy', selfManaged, h((req, res) => {
  req.ctx.db.prepare('UPDATE children SET parent_view=? WHERE id=?').run(req.body.parentView ? 1 : 0, req.child.id);
  res.json({ child: childView(req.ctx.db.prepare('SELECT * FROM children WHERE id=?').get(req.child.id)) });
}));

/** From 21: move the savings into a regular investment provident fund in their own name. */
r.post('/graduate', selfManaged, h((req, res) => {
  const out = graduate(req.ctx, req.child, { provider: req.body.provider || req.child.provider });
  if (out.error) throw bad(out.error);
  res.json({ ...out, child: childView(req.ctx.db.prepare('SELECT * FROM children WHERE id=?').get(req.child.id)) });
}));

export default r;

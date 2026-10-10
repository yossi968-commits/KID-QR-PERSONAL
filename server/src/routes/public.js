import { Router } from 'express';
import { h, bad, notFound, requireString, toAgorot, HttpError } from '../lib/http.js';
import { ageOn, nextBirthday, today, daysBetween } from '../lib/dates.js';
import { addMonth } from '../lib/pledges.js';

const addMonthFromToday = () => addMonth(today());
import { GIFT_MIN, GIFT_MAX } from '../lib/portfolio.js';
import { settleContribution, chargePledge, pledgeView } from '../lib/pledges.js';
import { startContribution, SOURCES } from '../lib/contribute.js';
import { lessonsFor } from '../content/lessons.js';

const r = Router();

r.get('/tracks', (req, res) => res.json({ tracks: req.ctx.partner.listTracks(), partner: req.ctx.partner.name }));

r.get('/payment-methods', (req, res) => res.json({ methods: req.ctx.payments.methods }));

r.get('/lessons', (req, res) => res.json({ lessons: lessonsFor(req.query.locale || 'he') }));

function childByCode(db, code) {
  const c = db.prepare('SELECT * FROM children WHERE gift_code=?').get(String(code).toLowerCase());
  if (!c) throw notFound('gift_code_not_found');
  return c;
}

/** Public gift page data: what a guest sees after scanning the QR. No balances. */
r.get('/gift/:code', h((req, res) => {
  const { db } = req.ctx;
  const c = childByCode(db, req.params.code);
  const age = ageOn(c.birth_date);
  const events = db
    .prepare(`SELECT id, type, title, date, goal_amount FROM events WHERE child_id=? AND active=1 AND date >= date('now','-14 days') ORDER BY date`)
    .all(c.id);
  const wall = db
    .prepare(`SELECT giver_name, message, unlock_age, paid_at FROM contributions
              WHERE child_id=? AND status IN ('paid','invested') AND is_public=1 ORDER BY paid_at DESC LIMIT 30`)
    .all(c.id)
    .map((w) => ({
      giverName: w.giver_name,
      sealedUntil: w.unlock_age && age < w.unlock_age ? w.unlock_age : null,
      message: w.unlock_age && age < w.unlock_age ? null : w.message,
      date: w.paid_at?.slice(0, 10),
    }));
  const giverCount = db.prepare(`SELECT COUNT(*) AS n FROM contributions WHERE child_id=? AND status IN ('paid','invested')`).get(c.id).n;
  const nb = nextBirthday(c.birth_date);
  res.json({
    child: { firstName: c.first_name, avatar: c.avatar, age, turning: age + 1, nextBirthday: nb, daysToBirthday: daysBetween(today(), nb), publicMessage: c.public_message, goalText: c.goal_text },
    events,
    wall,
    giverCount,
    limits: { min: GIFT_MIN, max: GIFT_MAX },
    suggested: [5200, 10000, 18000, 36000],
    methods: req.ctx.payments.methods,
    sources: SOURCES,
  });
}));

r.post('/gift/:code/contribute', h((req, res) => {
  const c = childByCode(req.ctx.db, req.params.code);
  res.status(201).json(startContribution(req.ctx, c, req.body));
}));

r.get('/gift/:code/receipt/:cid', h((req, res) => {
  const { db } = req.ctx;
  const c = childByCode(db, req.params.code);
  const x = db.prepare('SELECT * FROM contributions WHERE id=? AND child_id=?').get(Number(req.params.cid), c.id);
  if (!x) throw notFound();
  res.json({ status: x.status, amount: x.amount, giverName: x.giver_name, childFirstName: c.first_name, avatar: c.avatar, paidAt: x.paid_at, birthDate: c.birth_date });
}));

// ---- Sandbox hosted checkout (stands in for the payment provider's page + webhook) ----

r.get('/payments/:checkoutId', h((req, res) => {
  const chk = req.ctx.payments.getCheckout(req.params.checkoutId);
  if (!chk) throw notFound();
  res.json({ checkout: chk, provider: req.ctx.payments.name });
}));

r.post('/payments/:checkoutId/complete', h((req, res) => {
  const { db, payments } = req.ctx;
  const x = db.prepare('SELECT * FROM contributions WHERE checkout_id=?').get(req.params.checkoutId);
  if (!x) throw notFound();
  if (x.status !== 'pending') throw new HttpError(409, 'already_processed');
  const { paymentRef, cardToken } = payments.complete(req.params.checkoutId);
  const child = settleContribution(req.ctx, x, paymentRef);
  let pledgeToken;
  if (x.pledge_id) {
    // First month paid by card: activate the monthly gift with the stored token.
    const p = db.prepare('SELECT * FROM pledges WHERE id=?').get(x.pledge_id);
    db.prepare(`UPDATE pledges SET status='active', card_token=?, charges=1, next_date=? WHERE id=?`).run(cardToken, addMonthFromToday(), p.id);
    pledgeToken = p.token;
  }
  res.json({ ok: true, returnUrl: `/g/${child.gift_code}/thanks/${x.id}`, pledgeToken });
}));

r.post('/payments/:checkoutId/cancel', h((req, res) => {
  const { db, payments } = req.ctx;
  payments.cancel(req.params.checkoutId);
  const x = db.prepare('SELECT * FROM contributions WHERE checkout_id=?').get(req.params.checkoutId);
  if (x?.status === 'pending') db.prepare(`UPDATE contributions SET status='cancelled' WHERE id=?`).run(x.id);
  const child = x && db.prepare('SELECT gift_code FROM children WHERE id=?').get(x.child_id);
  res.json({ ok: true, returnUrl: child ? `/g/${child.gift_code}` : '/' });
}));

// ---- Monthly gifts (giver-facing, addressed by an unguessable token) ----

function pledgeByToken(db, token) {
  const p = db.prepare('SELECT * FROM pledges WHERE token=?').get(String(token));
  if (!p) throw notFound();
  return p;
}

r.get('/pledge/:token', h((req, res) => {
  const { db } = req.ctx;
  const p = pledgeByToken(db, req.params.token);
  const c = db.prepare('SELECT first_name, avatar, gift_code FROM children WHERE id=?').get(p.child_id);
  res.json({ pledge: pledgeView(p), child: { firstName: c.first_name, avatar: c.avatar, giftCode: c.gift_code } });
}));

/** Bank confirms the giver's direct-debit authorization (sandbox stand-in for the Masav confirmation file). */
r.post('/pledge/:token/authorize', h((req, res) => {
  const { db } = req.ctx;
  const p = pledgeByToken(db, req.params.token);
  if (p.method !== 'masav' || p.status !== 'pending') throw new HttpError(409, 'not_pending');
  db.prepare(`UPDATE pledges SET status='active', next_date=? WHERE id=?`).run(today(), p.id);
  chargePledge(req.ctx, db.prepare('SELECT * FROM pledges WHERE id=?').get(p.id));
  res.json({ pledge: pledgeView(db.prepare('SELECT * FROM pledges WHERE id=?').get(p.id)) });
}));

r.post('/pledge/:token/cancel', h((req, res) => {
  const { db } = req.ctx;
  const p = pledgeByToken(db, req.params.token);
  db.prepare(`UPDATE pledges SET status='cancelled', cancelled_at=datetime('now') WHERE id=? AND status<>'cancelled'`).run(p.id);
  res.json({ pledge: pledgeView(db.prepare('SELECT * FROM pledges WHERE id=?').get(p.id)) });
}));

export default r;

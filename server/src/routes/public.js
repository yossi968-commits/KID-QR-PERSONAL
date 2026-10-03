import { Router } from 'express';
import { h, bad, notFound, requireString, toAgorot, HttpError } from '../lib/http.js';
import { ageOn, nextBirthday, today, daysBetween } from '../lib/dates.js';
import { investContribution, GIFT_MIN, GIFT_MAX } from '../lib/portfolio.js';
import { lessonsFor } from '../content/lessons.js';

const r = Router();

r.get('/tracks', (req, res) => res.json({ tracks: req.ctx.partner.listTracks(), partner: req.ctx.partner.name }));

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
  });
}));

/** Start a gift: records a pending contribution and opens a payment checkout. */
r.post('/gift/:code/contribute', h((req, res) => {
  const { db, payments } = req.ctx;
  const c = childByCode(db, req.params.code);
  const amount = toAgorot(req.body.amount);
  if (amount < GIFT_MIN || amount > GIFT_MAX) throw bad('amount_out_of_range');
  const giverName = requireString(req.body.giverName, 'giver_name', { max: 60 });
  const giverEmail = req.body.giverEmail ? requireString(req.body.giverEmail, 'giver_email', { max: 120 }) : null;
  const message = req.body.message ? String(req.body.message).trim().slice(0, 500) : null;
  const unlockAge = req.body.unlockAge ? Number(req.body.unlockAge) : null;
  if (unlockAge !== null && (!Number.isInteger(unlockAge) || unlockAge <= ageOn(c.birth_date) || unlockAge > 21)) throw bad('invalid_unlock_age');
  let eventId = req.body.eventId ? Number(req.body.eventId) : null;
  if (eventId && !db.prepare('SELECT 1 FROM events WHERE id=? AND child_id=?').get(eventId, c.id)) eventId = null;

  const { lastInsertRowid } = db
    .prepare(`INSERT INTO contributions (child_id, event_id, giver_name, giver_email, amount, message, is_public, unlock_age) VALUES (?,?,?,?,?,?,?,?)`)
    .run(c.id, eventId, giverName, giverEmail, amount, message, req.body.isPublic === false ? 0 : 1, unlockAge);
  const checkout = payments.createCheckout({
    amount,
    description: `מתנה לעתיד של ${c.first_name}`,
    reference: lastInsertRowid,
    returnUrl: `/g/${c.gift_code}/thanks/${lastInsertRowid}`,
  });
  db.prepare('UPDATE contributions SET checkout_id=? WHERE id=?').run(checkout.checkoutId, lastInsertRowid);
  res.status(201).json({ contributionId: lastInsertRowid, checkoutId: checkout.checkoutId, redirectUrl: checkout.redirectUrl });
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
  const { db, payments, partner, notifier } = req.ctx;
  const x = db.prepare('SELECT * FROM contributions WHERE checkout_id=?').get(req.params.checkoutId);
  if (!x) throw notFound();
  if (x.status !== 'pending') throw new HttpError(409, 'already_processed');
  const method = ['card', 'bit', 'applepay', 'googlepay'].includes(req.body.method) ? req.body.method : 'card';
  const { paymentRef } = payments.complete(req.params.checkoutId, method);
  db.prepare(`UPDATE contributions SET status='paid', payment_ref=?, paid_at=datetime('now') WHERE id=?`).run(paymentRef, x.id);
  const child = db.prepare('SELECT * FROM children WHERE id=?').get(x.child_id);
  investContribution(db, partner, child, x, today());

  const guardian = db.prepare('SELECT * FROM users WHERE id=?').get(child.guardian_id);
  notifier.send({ to: guardian.email, subject: `🎁 ${x.giver_name} שלח/ה מתנה לעתיד של ${child.first_name}`, body: `₪${x.amount / 100} הושקעו בחשבון. ${x.message || ''}` });
  if (x.giver_email) notifier.send({ to: x.giver_email, subject: `קבלה: מתנה לעתיד של ${child.first_name}`, body: `תודה! ₪${x.amount / 100} הושקעו עבור ${child.first_name}. אסמכתא ${paymentRef}.` });
  res.json({ ok: true, returnUrl: `/g/${child.gift_code}/thanks/${x.id}` });
}));

r.post('/payments/:checkoutId/cancel', h((req, res) => {
  const { db, payments } = req.ctx;
  payments.cancel(req.params.checkoutId);
  const x = db.prepare('SELECT * FROM contributions WHERE checkout_id=?').get(req.params.checkoutId);
  if (x?.status === 'pending') db.prepare(`UPDATE contributions SET status='cancelled' WHERE id=?`).run(x.id);
  const child = x && db.prepare('SELECT gift_code FROM children WHERE id=?').get(x.child_id);
  res.json({ ok: true, returnUrl: child ? `/g/${child.gift_code}` : '/' });
}));

export default r;

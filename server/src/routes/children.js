import { Router } from 'express';
import { newGiftCode, hashPassword } from '../lib/auth.js';
import { h, bad, notFound, requireString, requireDate, toAgorot, HttpError } from '../lib/http.js';
import { requireUser, audit } from '../lib/guards.js';
import { ageOn, nextBirthday, today } from '../lib/dates.js';
import { portfolioSummary, switchTrack } from '../lib/portfolio.js';
import { pledgeView } from '../lib/pledges.js';
import { plannerPayload, withdrawalBudget, executeWithdrawal, taxEstimate } from '../lib/wishes.js';
import { PAYOUT_METHODS } from '../adapters/payments.js';
import { PROVIDERS, DEFAULT_PROVIDER, docsStatus, submitDocument, nextSwitchDate, newApplicationRef } from '../lib/fund.js';
import { startContribution, EVENT_TYPES } from '../lib/contribute.js';
import { linkReports } from '../lib/employer.js';
import { childView, giftsFor, lessonsPayload, completeLesson } from '../lib/child-data.js';

const r = Router();
r.use(requireUser);

const AVATARS = ['🦁', '🐻', '🦊', '🐼', '🐨', '🐯', '🦄', '🐬', '🦋', '🐢', '🚀', '⭐'];

function loadChild(req) {
  const c = req.ctx.db.prepare('SELECT * FROM children WHERE id=?').get(Number(req.params.id));
  if (!c) throw notFound();
  if (c.guardian_id !== req.user.id && req.user.role !== 'admin') throw notFound();
  return c;
}

r.get('/', h((req, res) => {
  const { db, partner } = req.ctx;
  const rows = db.prepare('SELECT * FROM children WHERE guardian_id=? ORDER BY birth_date').all(req.user.id);
  res.json({
    children: rows.map((c) => {
      const p = portfolioSummary(db, partner, c);
      return {
        ...childView(c), value: p.value, deposited: p.deposited, held: p.held, earned: p.earned,
        docsMissing: docsStatus(db, c).missing.length,
        pendingWithdrawals: db.prepare(`SELECT COUNT(*) AS n FROM withdrawals WHERE child_id=? AND status='requested'`).get(c.id).n,
        monthly: db.prepare(`SELECT COALESCE(SUM(amount),0) AS s FROM pledges WHERE child_id=? AND status='active'`).get(c.id).s,
      };
    }),
  });
}));

r.post('/', h((req, res) => {
  const { db, partner } = req.ctx;
  if (req.user.kyc_status !== 'verified') throw new HttpError(403, 'kyc_required');
  const firstName = requireString(req.body.firstName, 'first_name', { max: 40 });
  const birthDate = requireDate(req.body.birthDate, 'birth_date');
  const age = ageOn(birthDate);
  if (age < 0 || age >= 18) throw bad('child_age_out_of_range');
  const track = partner.listTracks().some((t) => t.id === req.body.track && t.core) ? req.body.track : 'equity';
  const provider = PROVIDERS.some((p) => p.id === req.body.provider) ? req.body.provider : DEFAULT_PROVIDER;
  const avatar = AVATARS.includes(req.body.avatar) ? req.body.avatar : AVATARS[0];
  let code;
  do code = newGiftCode(); while (db.prepare('SELECT 1 FROM children WHERE gift_code=?').get(code));
  const { lastInsertRowid } = db
    .prepare(`INSERT INTO children (guardian_id, first_name, last_name, birth_date, avatar, gift_code, track, goal_text, goal_amount, public_message, provider, account_status, application_ref)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(
      req.user.id, firstName, req.body.lastName?.trim() || null, birthDate, avatar, code, track,
      req.body.goalText?.trim()?.slice(0, 120) || null,
      req.body.goalAmount ? toAgorot(req.body.goalAmount, 'goal_amount') : null,
      req.body.publicMessage?.trim()?.slice(0, 280) || null,
      provider, 'pending_docs', newApplicationRef()
    );
  // The QR works from now on; the fund opens once the document checklist is complete.
  const child = db.prepare('SELECT * FROM children WHERE id=?').get(lastInsertRowid);
  // Every child gets a standing birthday campaign from day one.
  db.prepare('INSERT INTO events (child_id, type, title, date) VALUES (?,?,?,?)').run(child.id, 'birthday', `יום הולדת ${age + 1}`, nextBirthday(birthDate));
  audit(db, req.user.id, 'child_created', { childId: child.id, provider });
  linkReports(db); // an employer may already be waiting to send a birth gift
  res.status(201).json({ child: childView(child), documents: docsStatus(db, child) });
}));

r.get('/:id', h((req, res) => {
  const { db, partner } = req.ctx;
  const c = loadChild(req);
  const events = db.prepare('SELECT * FROM events WHERE child_id=? ORDER BY date DESC').all(c.id);
  res.json({ child: childView(c), portfolio: portfolioSummary(db, partner, c), events, documents: docsStatus(db, c) });
}));

r.patch('/:id', h((req, res) => {
  const { db } = req.ctx;
  const c = loadChild(req);
  const b = req.body;
  db.prepare(`UPDATE children SET first_name=?, last_name=?, avatar=?, goal_text=?, goal_amount=?, public_message=? WHERE id=?`).run(
    b.firstName !== undefined ? requireString(b.firstName, 'first_name', { max: 40 }) : c.first_name,
    b.lastName !== undefined ? String(b.lastName).trim().slice(0, 40) || null : c.last_name,
    AVATARS.includes(b.avatar) ? b.avatar : c.avatar,
    b.goalText !== undefined ? String(b.goalText).trim().slice(0, 120) || null : c.goal_text,
    b.goalAmount !== undefined ? (b.goalAmount ? toAgorot(b.goalAmount, 'goal_amount') : null) : c.goal_amount,
    b.publicMessage !== undefined ? String(b.publicMessage).trim().slice(0, 280) || null : c.public_message,
    c.id
  );
  res.json({ child: childView(db.prepare('SELECT * FROM children WHERE id=?').get(c.id)) });
}));

r.post('/:id/track', h((req, res) => {
  const { db, partner } = req.ctx;
  const c = loadChild(req);
  if (!partner.listTracks().some((t) => t.id === req.body.track)) throw bad('invalid_track');
  if (req.body.track === c.track) return res.json({ moved: 0 });
  const next = nextSwitchDate(c);
  if (next && today() < next) throw bad('track_switch_quarter');
  // Until 18 both parents sign actions on the child's fund.
  if (c.account_status === 'active' && req.body.coSigned !== true) throw bad('second_guardian_signature_required');
  const out = switchTrack(db, partner, c, req.body.track);
  db.prepare('UPDATE children SET track_changed_at=? WHERE id=?').run(today(), c.id);
  audit(db, req.user.id, 'track_switched', { childId: c.id, from: c.track, to: req.body.track });
  res.json(out);
}));

r.get('/:id/contributions', h((req, res) => {
  res.json({ contributions: giftsFor(req.ctx.db, loadChild(req), { withEmail: true }) });
}));

r.post('/:id/contributions/:cid/thank', h((req, res) => {
  const { db, notifier } = req.ctx;
  const c = loadChild(req);
  const x = db.prepare('SELECT * FROM contributions WHERE id=? AND child_id=?').get(Number(req.params.cid), c.id);
  if (!x) throw notFound();
  const text = requireString(req.body.message, 'message', { max: 500 });
  notifier.send({ to: x.giver_email, subject: `תודה מ${c.first_name}!`, body: text });
  db.prepare(`UPDATE contributions SET thanked_at=datetime('now') WHERE id=?`).run(x.id);
  res.json({ ok: true, delivered: Boolean(x.giver_email) });
}));

r.get('/:id/pledges', h((req, res) => {
  const c = loadChild(req);
  res.json({ pledges: req.ctx.db.prepare('SELECT * FROM pledges WHERE child_id=? ORDER BY id DESC').all(c.id).map(pledgeView) });
}));

// ---- Planned gifts and withdrawals (parent side) ----

export function validWish(body) {
  return {
    title: requireString(body.title, 'title', { max: 40 }),
    icon: typeof body.icon === 'string' && body.icon.length <= 8 ? body.icon : '🎁',
    targetAmount: toAgorot(body.targetAmount, 'target_amount'),
    targetDate: body.targetDate ? requireDate(body.targetDate, 'target_date') : null,
  };
}

r.get('/:id/planner', h((req, res) => res.json(plannerPayload(req.ctx.db, req.ctx.partner, loadChild(req)))));

r.post('/:id/wishes', h((req, res) => {
  const c = loadChild(req);
  const w = validWish(req.body);
  req.ctx.db.prepare('INSERT INTO wishes (child_id, title, icon, target_amount, target_date, created_by) VALUES (?,?,?,?,?,?)').run(c.id, w.title, w.icon, w.targetAmount, w.targetDate, 'parent');
  res.status(201).json(plannerPayload(req.ctx.db, req.ctx.partner, c));
}));

r.delete('/:id/wishes/:wid', h((req, res) => {
  const c = loadChild(req);
  req.ctx.db.prepare(`UPDATE wishes SET status='cancelled' WHERE id=? AND child_id=?`).run(Number(req.params.wid), c.id);
  res.json(plannerPayload(req.ctx.db, req.ctx.partner, c));
}));

r.post('/:id/withdraw-pct', h((req, res) => {
  const c = loadChild(req);
  const pct = Number(req.body.pct);
  if (!Number.isInteger(pct) || pct < 0 || pct > 50) throw bad('invalid_pct');
  req.ctx.db.prepare('UPDATE children SET withdraw_pct=? WHERE id=?').run(pct, c.id);
  audit(req.ctx.db, req.user.id, 'withdraw_pct_set', { childId: c.id, pct });
  res.json(plannerPayload(req.ctx.db, req.ctx.partner, req.ctx.db.prepare('SELECT * FROM children WHERE id=?').get(c.id)));
}));

function payoutTarget(body, c) {
  if (c.account_status !== 'active') throw bad('fund_not_open');
  if (!PAYOUT_METHODS.includes(body.method)) throw bad('invalid_payout_method');
  // Until 18 both parents sign withdrawals from the child's fund.
  if (body.coSigned !== true) throw bad('second_guardian_signature_required');
  return { method: body.method, destination: requireString(body.destination, 'destination', { max: 60 }) };
}

/** Parent withdraws directly (within the yearly budget); pays out to the parent's own app, card or account. */
r.post('/:id/withdrawals', h((req, res) => {
  const { db, partner } = req.ctx;
  const c = loadChild(req);
  const amount = toAgorot(req.body.amount);
  const target = payoutTarget(req.body, c);
  if (amount > withdrawalBudget(db, partner, c).available) throw bad('over_budget');
  const wishId = req.body.wishId ? Number(req.body.wishId) : null;
  const { lastInsertRowid } = db
    .prepare('INSERT INTO withdrawals (child_id, wish_id, amount, requested_by, tax_estimate, note) VALUES (?,?,?,?,?,?)')
    .run(c.id, wishId, amount, 'parent', taxEstimate(db, partner, c.id, amount), req.body.note || null);
  executeWithdrawal(req.ctx, c, db.prepare('SELECT * FROM withdrawals WHERE id=?').get(lastInsertRowid), target);
  audit(db, req.user.id, 'withdrawal', { childId: c.id, amount });
  res.status(201).json(plannerPayload(db, partner, c));
}));

/** Approve a child's request: the parent picks where the money goes. */
r.post('/:id/withdrawals/:wid/approve', h((req, res) => {
  const { db, partner } = req.ctx;
  const c = loadChild(req);
  const w = db.prepare(`SELECT * FROM withdrawals WHERE id=? AND child_id=? AND status='requested'`).get(Number(req.params.wid), c.id);
  if (!w) throw notFound();
  executeWithdrawal(req.ctx, c, w, payoutTarget(req.body, c));
  audit(db, req.user.id, 'withdrawal_approved', { childId: c.id, withdrawalId: w.id });
  res.json(plannerPayload(db, partner, c));
}));

r.post('/:id/withdrawals/:wid/reject', h((req, res) => {
  const c = loadChild(req);
  req.ctx.db.prepare(`UPDATE withdrawals SET status='rejected', decided_at=datetime('now') WHERE id=? AND child_id=? AND status='requested'`).run(Number(req.params.wid), c.id);
  res.json(plannerPayload(req.ctx.db, req.ctx.partner, c));
}));

/**
 * The parent deposits part of the cash and checks received at a brit, naming, bar or
 * bat mitzvah (or any family event). Tagged to the event; paid by the parent's chosen method.
 */
r.post('/:id/deposits', h((req, res) => {
  const { db } = req.ctx;
  const c = loadChild(req);
  let eventId = req.body.eventId ? Number(req.body.eventId) : null;
  if (eventId && !db.prepare('SELECT 1 FROM events WHERE id=? AND child_id=?').get(eventId, c.id)) throw bad('invalid_event');
  if (!eventId && req.body.eventType) {
    const type = EVENT_TYPES.includes(req.body.eventType) ? req.body.eventType : 'other';
    const title = requireString(req.body.eventTitle, 'title', { max: 60 });
    const date = requireDate(req.body.eventDate, 'date');
    eventId = Number(db.prepare('INSERT INTO events (child_id, type, title, date, active) VALUES (?,?,?,?,0)').run(c.id, type, title, date).lastInsertRowid);
  }
  const out = startContribution(req.ctx, c, { ...req.body, source: 'event_gifts', giverName: req.user.name, giverEmail: req.user.email, eventId, isPublic: false, frequency: 'once', unlockAge: undefined });
  audit(db, req.user.id, 'event_deposit', { childId: c.id, eventId, amount: req.body.amount });
  res.status(201).json(out);
}));

// Fund opening checklist: the parent can finish it any time after the QR was created.
r.get('/:id/documents', h((req, res) => res.json(docsStatus(req.ctx.db, loadChild(req)))));

r.post('/:id/documents/:doc', h((req, res) => {
  const c = loadChild(req);
  const out = submitDocument(req.ctx, c, req.params.doc, req.body);
  if (!out) throw notFound();
  if (out.error) throw bad(out.error);
  audit(req.ctx.db, req.user.id, 'document_submitted', { childId: c.id, doc: req.params.doc });
  res.json(out);
}));

r.post('/:id/events', h((req, res) => {
  const { db } = req.ctx;
  const c = loadChild(req);
  const type = EVENT_TYPES.includes(req.body.type) ? req.body.type : 'other';
  const title = requireString(req.body.title, 'title', { max: 60 });
  const date = requireDate(req.body.date, 'date');
  const goal = req.body.goalAmount ? toAgorot(req.body.goalAmount, 'goal_amount') : null;
  const { lastInsertRowid } = db.prepare('INSERT INTO events (child_id, type, title, date, goal_amount) VALUES (?,?,?,?,?)').run(c.id, type, title, date, goal);
  res.status(201).json({ event: db.prepare('SELECT * FROM events WHERE id=?').get(lastInsertRowid) });
}));

r.delete('/:id/events/:eid', h((req, res) => {
  const c = loadChild(req);
  req.ctx.db.prepare('UPDATE events SET active=0 WHERE id=? AND child_id=?').run(Number(req.params.eid), c.id);
  res.json({ ok: true });
}));

r.get('/:id/lessons', h((req, res) => {
  res.json(lessonsPayload(req.ctx.db, loadChild(req), req.query.locale || req.user.locale));
}));

r.post('/:id/lessons/:lid/complete', h((req, res) => {
  const g = completeLesson(req.ctx.db, loadChild(req), req.params.lid, req.body.answers);
  if (!g) throw notFound();
  res.json(g);
}));

/** Parent sets the child's own login (username + 4–6 digit PIN) for the kids' portal. */
r.post('/:id/kid-login', h((req, res) => {
  const { db } = req.ctx;
  const c = loadChild(req);
  const username = requireString(req.body.username, 'username', { min: 3, max: 30 }).toLowerCase();
  if (!/^[a-z0-9._-]+$/.test(username)) throw bad('invalid_username');
  if (!/^\d{4,6}$/.test(String(req.body.pin || ''))) throw bad('invalid_pin');
  if (db.prepare('SELECT 1 FROM children WHERE kid_username=? AND id<>?').get(username, c.id)) throw new HttpError(409, 'username_taken');
  db.prepare('UPDATE children SET kid_username=?, kid_pin_hash=? WHERE id=?').run(username, hashPassword(String(req.body.pin)), c.id);
  audit(db, req.user.id, 'kid_login_set', { childId: c.id });
  res.json({ child: childView(db.prepare('SELECT * FROM children WHERE id=?').get(c.id)) });
}));

r.get('/:id/statement', h((req, res) => {
  const { db, partner } = req.ctx;
  const c = loadChild(req);
  const txs = db.prepare('SELECT * FROM transactions WHERE child_id=? ORDER BY date DESC, id DESC').all(c.id);
  res.json({ child: childView(c), partner: partner.name, generatedAt: today(), transactions: txs });
}));

export default r;

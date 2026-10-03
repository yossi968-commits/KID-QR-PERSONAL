import { Router } from 'express';
import { newGiftCode } from '../lib/auth.js';
import { h, bad, notFound, requireString, requireDate, toAgorot, HttpError } from '../lib/http.js';
import { requireUser, audit } from '../lib/guards.js';
import { ageOn, nextBirthday, today } from '../lib/dates.js';
import { portfolioSummary, switchTrack } from '../lib/portfolio.js';
import { lessonsFor, gradeLesson, AGE_BANDS } from '../content/lessons.js';

const r = Router();
r.use(requireUser);

const AVATARS = ['🦁', '🐻', '🦊', '🐼', '🐨', '🐯', '🦄', '🐬', '🦋', '🐢', '🚀', '⭐'];

export function childView(c) {
  return {
    id: c.id,
    firstName: c.first_name,
    lastName: c.last_name,
    birthDate: c.birth_date,
    age: ageOn(c.birth_date),
    nextBirthday: nextBirthday(c.birth_date),
    avatar: c.avatar,
    giftCode: c.gift_code,
    track: c.track,
    partnerAccountId: c.partner_account_id,
    goalText: c.goal_text,
    goalAmount: c.goal_amount,
    publicMessage: c.public_message,
  };
}

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
      return { ...childView(c), value: p.value, deposited: p.deposited };
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
  const track = partner.listTracks().some((t) => t.id === req.body.track) ? req.body.track : 'equity';
  const avatar = AVATARS.includes(req.body.avatar) ? req.body.avatar : AVATARS[0];
  let code;
  do code = newGiftCode(); while (db.prepare('SELECT 1 FROM children WHERE gift_code=?').get(code));
  const { lastInsertRowid } = db
    .prepare(`INSERT INTO children (guardian_id, first_name, last_name, birth_date, avatar, gift_code, track, goal_text, goal_amount, public_message)
              VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run(
      req.user.id, firstName, req.body.lastName?.trim() || null, birthDate, avatar, code, track,
      req.body.goalText?.trim()?.slice(0, 120) || null,
      req.body.goalAmount ? toAgorot(req.body.goalAmount, 'goal_amount') : null,
      req.body.publicMessage?.trim()?.slice(0, 280) || null
    );
  const child = db.prepare('SELECT * FROM children WHERE id=?').get(lastInsertRowid);
  const { accountId } = partner.openAccount({ guardian: req.user, child });
  db.prepare('UPDATE children SET partner_account_id=? WHERE id=?').run(accountId, child.id);
  // Every child gets a standing birthday campaign from day one.
  db.prepare('INSERT INTO events (child_id, type, title, date) VALUES (?,?,?,?)').run(child.id, 'birthday', `יום הולדת ${age + 1}`, nextBirthday(birthDate));
  audit(db, req.user.id, 'child_created', { childId: child.id, accountId });
  res.status(201).json({ child: childView({ ...child, partner_account_id: accountId }) });
}));

r.get('/:id', h((req, res) => {
  const { db, partner } = req.ctx;
  const c = loadChild(req);
  const events = db.prepare('SELECT * FROM events WHERE child_id=? ORDER BY date DESC').all(c.id);
  res.json({ child: childView(c), portfolio: portfolioSummary(db, partner, c), events });
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
  const out = switchTrack(db, partner, c, req.body.track);
  audit(db, req.user.id, 'track_switched', { childId: c.id, from: c.track, to: req.body.track });
  res.json(out);
}));

r.get('/:id/contributions', h((req, res) => {
  const { db } = req.ctx;
  const c = loadChild(req);
  const age = ageOn(c.birth_date);
  const rows = db
    .prepare(`SELECT c.*, e.title AS event_title FROM contributions c LEFT JOIN events e ON e.id=c.event_id
              WHERE c.child_id=? AND c.status IN ('paid','invested') ORDER BY c.paid_at DESC`)
    .all(c.id);
  res.json({
    contributions: rows.map((x) => ({
      id: x.id, giverName: x.giver_name, giverEmail: x.giver_email, amount: x.amount, status: x.status,
      eventTitle: x.event_title, paidAt: x.paid_at, thankedAt: x.thanked_at, unlockAge: x.unlock_age,
      // Time-capsule messages stay sealed until the child reaches the chosen age.
      sealed: x.unlock_age ? age < x.unlock_age : false,
      message: x.unlock_age && age < x.unlock_age ? null : x.message,
    })),
  });
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

r.post('/:id/events', h((req, res) => {
  const { db } = req.ctx;
  const c = loadChild(req);
  const type = ['birthday', 'bar_mitzvah', 'holiday', 'other'].includes(req.body.type) ? req.body.type : 'other';
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
  const { db } = req.ctx;
  const c = loadChild(req);
  const done = new Map(db.prepare('SELECT lesson_id, score FROM lesson_progress WHERE child_id=?').all(c.id).map((p) => [p.lesson_id, p.score]));
  const age = ageOn(c.birth_date);
  const band = AGE_BANDS.find((b) => age >= b.from && age <= b.to)?.id || (age < 4 ? 'little' : 'young');
  const lessons = lessonsFor(req.query.locale || req.user.locale).map((l) => ({ ...l, completed: done.has(l.id), starsEarned: done.get(l.id) || 0 }));
  res.json({ band, bands: AGE_BANDS, lessons, totalStars: [...done.values()].reduce((a, b) => a + b, 0) });
}));

r.post('/:id/lessons/:lid/complete', h((req, res) => {
  const { db } = req.ctx;
  const c = loadChild(req);
  const g = gradeLesson(req.params.lid, req.body.answers);
  if (!g) throw notFound();
  if (g.passed) {
    db.prepare(`INSERT INTO lesson_progress (child_id, lesson_id, score) VALUES (?,?,?)
                ON CONFLICT(child_id, lesson_id) DO UPDATE SET score=excluded.score, completed_at=datetime('now')`).run(c.id, req.params.lid, g.stars);
  }
  res.json(g);
}));

r.get('/:id/statement', h((req, res) => {
  const { db, partner } = req.ctx;
  const c = loadChild(req);
  const txs = db.prepare('SELECT * FROM transactions WHERE child_id=? ORDER BY date DESC, id DESC').all(c.id);
  res.json({ child: childView(c), partner: partner.name, generatedAt: today(), transactions: txs });
}));

export default r;

/**
 * In-browser API used by the demo build (VITE_DEMO=1). It mirrors the server routes
 * with in-memory state so the whole app can be tried without a backend. It reuses
 * the server's sandbox investment partner, date helpers and lesson content.
 */
// @ts-ignore - plain JS modules shared with the server
import { SandboxInvestmentPartner } from '../../../server/src/adapters/investment-partner.js';
// @ts-ignore
import { today, ageOn, nextBirthday, addYears, daysBetween } from '../../../server/src/lib/dates.js';
// @ts-ignore
import { lessonsFor, gradeLesson, AGE_BANDS } from '../../../server/src/content/lessons.js';
import { ApiError } from '../lib/api';

const partner = new SandboxInvestmentPartner();
const GIFT_MIN = 1800, GIFT_MAX = 500000, PAYOUT_AGE = 21;
const err = (status: number, code: string) => new ApiError(status, code);
const now = () => new Date().toISOString().replace('T', ' ').slice(0, 19);
const rid = () => Math.random().toString(16).slice(2, 12);

type Row = Record<string, any>;
const S = { users: [] as Row[], children: [] as Row[], events: [] as Row[], contributions: [] as Row[], tx: [] as Row[], progress: [] as Row[], outbox: [] as Row[], checkouts: new Map<string, Row>() };
let seq = 1;
const nid = () => seq++;

const pubUser = (u: Row) => ({ id: u.id, email: u.email, name: u.name, phone: u.phone, role: u.role, locale: u.locale, kycStatus: u.kyc_status });
const childView = (c: Row) => ({
  id: c.id, firstName: c.first_name, lastName: c.last_name, birthDate: c.birth_date, age: ageOn(c.birth_date), nextBirthday: nextBirthday(c.birth_date),
  avatar: c.avatar, giftCode: c.gift_code, track: c.track, partnerAccountId: c.partner_account_id, goalText: c.goal_text, goalAmount: c.goal_amount, publicMessage: c.public_message,
});

function holdings(childId: number, upTo?: string) {
  const m = new Map<string, number>();
  for (const t of S.tx) if (t.child_id === childId && (!upTo || t.date <= upTo)) m.set(t.track, (m.get(t.track) || 0) + (t.type === 'buy' ? t.units : -t.units));
  return [...m].filter(([, u]) => u > 1e-9).map(([track, units]) => ({ track, units }));
}

function invest(child: Row, c: Row, date = today()) {
  const o = partner.placeBuy({ accountId: child.partner_account_id, trackId: child.track, amount: c.amount, date });
  S.tx.push({ id: nid(), child_id: child.id, contribution_id: c.id, type: 'buy', reason: 'gift', track: child.track, amount: c.amount, units: o.units, nav: o.nav, partner_order_id: o.orderId, date });
  c.status = 'invested';
}

function summary(child: Row) {
  const d0 = today();
  const hs = holdings(child.id);
  const value = Math.round(hs.reduce((s, h) => s + h.units * partner.navOn(h.track, d0) * 100, 0));
  const inv = S.contributions.filter((c) => c.child_id === child.id && c.status === 'invested');
  const deposited = inv.reduce((s, c) => s + c.amount, 0);
  const yearAgo = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
  const last12 = inv.filter((c) => c.paid_at.slice(0, 10) > yearAgo).reduce((s, c) => s + c.amount, 0);
  const giverCount = new Set(inv.map((c) => c.giver_name.toLowerCase())).size;
  const ledger = S.tx.filter((t) => t.child_id === child.id).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id));
  const history: Row[] = [];
  if (ledger.length) {
    const units = new Map<string, number>();
    let dep = 0, li = 0;
    const start = Date.parse(ledger[0].date + 'T00:00:00Z'), end = Date.parse(d0 + 'T00:00:00Z');
    const step = Math.max(7, Math.ceil((end - start) / 86400000 / 160)) * 86400000;
    for (let t = start; ; t = Math.min(t + step, end)) {
      const d = new Date(t).toISOString().slice(0, 10);
      while (li < ledger.length && ledger[li].date <= d) {
        const e = ledger[li++];
        units.set(e.track, (units.get(e.track) || 0) + (e.type === 'buy' ? e.units : -e.units));
        if (e.reason === 'gift') dep += e.amount;
      }
      history.push({ date: d, value: Math.round([...units].reduce((s, [tr, u]) => s + u * partner.navOn(tr, d) * 100, 0)), deposited: dep });
      if (t >= end) break;
    }
  }
  const track = partner.listTracks().find((t: Row) => t.id === child.track);
  const yearsLeft = Math.max(0, PAYOUT_AGE - ageOn(child.birth_date));
  const annual = last12 || 250000;
  const points: Row[] = [];
  const finals: Row = {};
  for (const [k, delta] of Object.entries({ low: -0.02, mid: 0, high: 0.02 })) {
    const r = track.expectedReturn - track.mgmtFee + delta;
    let v = value;
    for (let y = 0; y <= yearsLeft; y++) {
      if (y > 0) v = v * (1 + r) + annual;
      points[y] = points[y] || { age: ageOn(child.birth_date) + y };
      points[y][k] = Math.round(v);
    }
    finals[k] = Math.round(v);
  }
  return {
    value, deposited, gain: value - deposited, gainPct: deposited ? (value - deposited) / deposited : 0, giverCount,
    holdings: hs.map((h) => ({ ...h, value: Math.round(h.units * partner.navOn(h.track, d0) * 100) })),
    history, projection: { payoutDate: addYears(child.birth_date, PAYOUT_AGE), payoutAge: PAYOUT_AGE, annualAssumed: annual, points, finals },
  };
}

// ---- seed: same demo family as server/src/seed.js ----
function seed() {
  S.users.push({ id: nid(), email: 'admin@kfq.app', password: 'admin1234', name: 'מנהל מערכת', role: 'admin', locale: 'he', kyc_status: 'none', created_at: now() });
  const parent = { id: nid(), email: 'demo@kfq.app', password: 'demo1234', name: 'מיכל לוי', role: 'parent', locale: 'he', kyc_status: 'verified', created_at: now() };
  S.users.push(parent);
  const givers: [string, string | null, string][] = [
    ['סבתא רחל', 'rachel@example.com', 'לנכדה/נכד האהוב, שתגדל/י בשמחה ❤️'], ['סבא משה', 'moshe@example.com', 'עד 120! מסבא'],
    ['דודה שירה', 'shira@example.com', 'מזל טוב! שתגשים/י את כל החלומות'], ['דוד אבי', null, 'יום הולדת שמח'],
    ['ההורים של יואב מהגן', null, 'מזל טוב מכל המשפחה'], ['נועם מהכיתה', null, 'יום הולדת שמח חבר/ה!'],
    ['סבתא אסתר', 'ester@example.com', 'בשבילך, לעתיד'], ['השכנים, משפחת כהן', null, 'מזל טוב!'],
  ];
  let s = 7;
  const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const kids = [
    { first: 'נועה', birth: '2019-05-12', avatar: '🦄', track: 'equity', goal: 'לימודים באוניברסיטה', goalAmount: 15000000, msg: 'נועה חוסכת לחלום הגדול שלה 🎓', code: 'noa2019demo' },
    { first: 'איתי', birth: '2013-11-03', avatar: '🚀', track: 'sp500', goal: 'דירה ראשונה', goalAmount: 40000000, msg: "איתי עולה לתורה בקרוב! במקום צ'ק, מתנה שגדלה איתו 🚀", code: 'itay2013demo' },
  ];
  for (const k of kids) {
    const child: Row = { id: nid(), guardian_id: parent.id, first_name: k.first, last_name: 'לוי', birth_date: k.birth, avatar: k.avatar, gift_code: k.code, track: k.track, goal_text: k.goal, goal_amount: k.goalAmount, public_message: k.msg };
    child.partner_account_id = 'SBX-' + rid().toUpperCase() + '-' + child.id;
    S.children.push(child);
    for (let age = 0; age <= ageOn(k.birth); age++) {
      const date = addYears(k.birth, age);
      if (date > today()) break;
      const ev = { id: nid(), child_id: child.id, type: 'birthday', title: age === 0 ? 'לידה' : `יום הולדת ${age}`, date, goal_amount: null, active: 0 };
      S.events.push(ev);
      const n = 3 + Math.floor(rand() * 4);
      for (let i = 0; i < n; i++) {
        const [name, email, message] = givers[(age + i) % givers.length];
        const amount = [5200, 10000, 18000, 20000, 36000, 50000][Math.floor(rand() * 6)] * (age === 0 ? 2 : 1);
        const d = new Date(Date.parse(date) + Math.floor(rand() * 5) * 86400000).toISOString().slice(0, 10);
        if (d > today()) continue;
        const c = { id: nid(), child_id: child.id, event_id: ev.id, giver_name: name, giver_email: email, amount, message, is_public: 1, unlock_age: i === 0 && age % 4 === 2 ? 18 : null, status: 'paid', payment_ref: 'SEED', paid_at: d + ' 10:00:00', created_at: d + ' 09:58:00' };
        S.contributions.push(c);
        invest(child, c, d);
      }
    }
    const turning = ageOn(k.birth) + 1;
    S.events.push({ id: nid(), child_id: child.id, type: turning === 13 ? 'bar_mitzvah' : 'birthday', title: turning === 13 ? 'בר מצווה לאיתי' : `יום הולדת ${turning}`, date: nextBirthday(k.birth), goal_amount: turning === 13 ? 3000000 : null, active: 1 });
  }
  const [noa, itay] = S.children;
  for (const [lid, st] of [['what-is-money', 3], ['three-jars', 3]] as const) S.progress.push({ child_id: noa.id, lesson_id: lid, score: st });
  for (const [lid, st] of [['needs-wants', 4], ['compound-interest', 5], ['what-is-a-share', 5]] as const) S.progress.push({ child_id: itay.id, lesson_id: lid, score: st });
}
seed();

// ---- routing ----
type Req = { method: string; path: string; body: Row; user: Row | null; query: URLSearchParams };
type Handler = (req: Req, p: string[]) => any;
const routes: [string, RegExp, Handler][] = [];
const on = (method: string, pattern: string, h: Handler) => routes.push([method, new RegExp('^' + pattern.replace(/:\w+/g, '([^/]+)') + '$'), h]);
const need = (req: Req) => { if (!req.user) throw err(401, 'unauthorized'); return req.user; };
const own = (req: Req, id: string) => {
  const u = need(req);
  const c = S.children.find((x) => x.id === Number(id));
  if (!c || (c.guardian_id !== u.id && u.role !== 'admin')) throw err(404, 'not_found');
  return c;
};
const byCode = (code: string) => { const c = S.children.find((x) => x.gift_code === code.toLowerCase()); if (!c) throw err(404, 'gift_code_not_found'); return c; };
const money = (v: any, f = 'amount') => { const n = Number(v); if (!Number.isFinite(n) || n <= 0) throw err(400, 'invalid_' + f); return Math.round(n * 100); };
const str = (v: any, f: string, max = 200) => { if (typeof v !== 'string' || !v.trim() || v.trim().length > max) throw err(400, 'invalid_' + f); return v.trim(); };
const token = (u: Row) => 'demo.' + u.id;

on('POST', '/auth/register', (r) => {
  const email = str(r.body.email, 'email').toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw err(400, 'invalid_email');
  if ((r.body.password || '').length < 8) throw err(400, 'weak_password');
  if (S.users.some((u) => u.email === email)) throw err(409, 'email_taken');
  const u = { id: nid(), email, password: r.body.password, name: str(r.body.name, 'name'), phone: r.body.phone, role: 'parent', locale: r.body.locale || 'he', kyc_status: 'none', created_at: now() };
  S.users.push(u);
  return { token: token(u), user: pubUser(u) };
});
on('POST', '/auth/login', (r) => {
  const u = S.users.find((x) => x.email === String(r.body.email || '').toLowerCase() && x.password === r.body.password);
  if (!u) throw err(401, 'bad_credentials');
  return { token: token(u), user: pubUser(u) };
});
on('GET', '/auth/me', (r) => ({ user: pubUser(need(r)) }));
on('POST', '/auth/kyc', (r) => {
  const u = need(r);
  const id = String(r.body.nationalId || '').replace(/\D/g, '').padStart(9, '0');
  const sum = [...id].reduce((s, d, i) => { let x = Number(d) * ((i % 2) + 1); if (x > 9) x -= 9; return s + x; }, 0);
  if (id.length !== 9 || sum % 10) throw err(400, 'invalid_national_id');
  if (!r.body.consent) throw err(400, 'consent_required');
  u.kyc_status = 'verified';
  return { user: pubUser(u) };
});
on('GET', '/tracks', () => ({ tracks: partner.listTracks(), partner: partner.name }));
on('GET', '/children', (r) => {
  const u = need(r);
  return { children: S.children.filter((c) => c.guardian_id === u.id).sort((a, b) => (a.birth_date < b.birth_date ? -1 : 1)).map((c) => { const p = summary(c); return { ...childView(c), value: p.value, deposited: p.deposited }; }) };
});
on('POST', '/children', (r) => {
  const u = need(r);
  if (u.kyc_status !== 'verified') throw err(403, 'kyc_required');
  const birth = r.body.birthDate;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birth || '')) throw err(400, 'invalid_birth_date');
  const age = ageOn(birth);
  if (age < 0 || age >= 18) throw err(400, 'child_age_out_of_range');
  const c: Row = {
    id: nid(), guardian_id: u.id, first_name: str(r.body.firstName, 'first_name', 40), last_name: r.body.lastName || null, birth_date: birth, avatar: r.body.avatar || '🦁',
    gift_code: rid().slice(0, 10), track: r.body.track || 'equity', goal_text: r.body.goalText || null, goal_amount: r.body.goalAmount ? money(r.body.goalAmount) : null, public_message: r.body.publicMessage || null,
  };
  c.partner_account_id = 'SBX-' + rid().toUpperCase() + '-' + c.id;
  S.children.push(c);
  S.events.push({ id: nid(), child_id: c.id, type: 'birthday', title: `יום הולדת ${age + 1}`, date: nextBirthday(birth), goal_amount: null, active: 1 });
  return { child: childView(c) };
});
on('GET', '/children/:id', (r, [id]) => {
  const c = own(r, id);
  return { child: childView(c), portfolio: summary(c), events: S.events.filter((e) => e.child_id === c.id).sort((a, b) => (a.date < b.date ? 1 : -1)) };
});
on('PATCH', '/children/:id', (r, [id]) => {
  const c = own(r, id), b = r.body;
  if (b.firstName !== undefined) c.first_name = str(b.firstName, 'first_name', 40);
  if (b.lastName !== undefined) c.last_name = b.lastName || null;
  if (b.avatar) c.avatar = b.avatar;
  if (b.goalText !== undefined) c.goal_text = b.goalText || null;
  if (b.goalAmount !== undefined) c.goal_amount = b.goalAmount ? money(b.goalAmount) : null;
  if (b.publicMessage !== undefined) c.public_message = b.publicMessage || null;
  return { child: childView(c) };
});
on('POST', '/children/:id/track', (r, [id]) => {
  const c = own(r, id), to = r.body.track, d = today();
  let proceeds = 0;
  for (const h of holdings(c.id)) {
    if (h.track === to) continue;
    const s = partner.placeSell({ trackId: h.track, units: h.units, date: d });
    proceeds += s.amount;
    S.tx.push({ id: nid(), child_id: c.id, type: 'sell', reason: 'switch', track: h.track, amount: s.amount, units: h.units, nav: s.nav, date: d });
  }
  if (proceeds) { const b = partner.placeBuy({ trackId: to, amount: proceeds, date: d }); S.tx.push({ id: nid(), child_id: c.id, type: 'buy', reason: 'switch', track: to, amount: proceeds, units: b.units, nav: b.nav, date: d }); }
  c.track = to;
  return { moved: proceeds };
});
on('GET', '/children/:id/contributions', (r, [id]) => {
  const c = own(r, id), age = ageOn(c.birth_date);
  return {
    contributions: S.contributions.filter((x) => x.child_id === c.id && ['paid', 'invested'].includes(x.status)).sort((a, b) => (a.paid_at < b.paid_at ? 1 : -1)).map((x) => ({
      id: x.id, giverName: x.giver_name, giverEmail: x.giver_email, amount: x.amount, status: x.status, eventTitle: S.events.find((e) => e.id === x.event_id)?.title,
      paidAt: x.paid_at, thankedAt: x.thanked_at, unlockAge: x.unlock_age, sealed: x.unlock_age ? age < x.unlock_age : false, message: x.unlock_age && age < x.unlock_age ? null : x.message,
    })),
  };
});
on('POST', '/children/:id/contributions/:cid/thank', (r, [id, cid]) => {
  const c = own(r, id), x = S.contributions.find((y) => y.id === Number(cid) && y.child_id === c.id);
  if (!x) throw err(404, 'not_found');
  if (x.giver_email) S.outbox.push({ id: nid(), recipient: x.giver_email, subject: `תודה מ${c.first_name}!`, body: str(r.body.message, 'message', 500), created_at: now() });
  x.thanked_at = now();
  return { ok: true, delivered: Boolean(x.giver_email) };
});
on('POST', '/children/:id/events', (r, [id]) => {
  const c = own(r, id);
  const e = { id: nid(), child_id: c.id, type: r.body.type, title: str(r.body.title, 'title', 60), date: r.body.date, goal_amount: r.body.goalAmount ? money(r.body.goalAmount) : null, active: 1 };
  S.events.push(e);
  return { event: e };
});
on('DELETE', '/children/:id/events/:eid', (r, [id, eid]) => { const c = own(r, id); const e = S.events.find((x) => x.id === Number(eid) && x.child_id === c.id); if (e) e.active = 0; return { ok: true }; });
on('GET', '/children/:id/lessons', (r, [id]) => {
  const c = own(r, id), age = ageOn(c.birth_date);
  const done = new Map(S.progress.filter((p) => p.child_id === c.id).map((p) => [p.lesson_id, p.score]));
  const band = AGE_BANDS.find((b: Row) => age >= b.from && age <= b.to)?.id || (age < 4 ? 'little' : 'young');
  return { band, bands: AGE_BANDS, lessons: lessonsFor(r.query.get('locale') || 'he').map((l: Row) => ({ ...l, completed: done.has(l.id), starsEarned: done.get(l.id) || 0 })), totalStars: [...done.values()].reduce((a, b) => a + b, 0) };
});
on('POST', '/children/:id/lessons/:lid/complete', (r, [id, lid]) => {
  const c = own(r, id), g = gradeLesson(lid, r.body.answers);
  if (!g) throw err(404, 'not_found');
  if (g.passed) { S.progress = S.progress.filter((p) => !(p.child_id === c.id && p.lesson_id === lid)); S.progress.push({ child_id: c.id, lesson_id: lid, score: g.stars }); }
  return g;
});
on('GET', '/children/:id/statement', (r, [id]) => {
  const c = own(r, id);
  return { child: childView(c), transactions: S.tx.filter((t) => t.child_id === c.id).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id)) };
});
on('GET', '/gift/:code', (_r, [code]) => {
  const c = byCode(code), age = ageOn(c.birth_date), nb = nextBirthday(c.birth_date);
  const cutoff = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
  const paid = S.contributions.filter((x) => x.child_id === c.id && ['paid', 'invested'].includes(x.status));
  return {
    child: { firstName: c.first_name, avatar: c.avatar, age, turning: age + 1, nextBirthday: nb, daysToBirthday: daysBetween(today(), nb), publicMessage: c.public_message, goalText: c.goal_text },
    events: S.events.filter((e) => e.child_id === c.id && e.active && e.date >= cutoff).sort((a, b) => (a.date < b.date ? -1 : 1)),
    wall: paid.filter((x) => x.is_public).sort((a, b) => (a.paid_at < b.paid_at ? 1 : -1)).slice(0, 30).map((w) => ({ giverName: w.giver_name, sealedUntil: w.unlock_age && age < w.unlock_age ? w.unlock_age : null, message: w.unlock_age && age < w.unlock_age ? null : w.message, date: w.paid_at.slice(0, 10) })),
    giverCount: paid.length, limits: { min: GIFT_MIN, max: GIFT_MAX }, suggested: [5200, 10000, 18000, 36000],
  };
});
on('POST', '/gift/:code/contribute', (r, [code]) => {
  const c = byCode(code), amount = money(r.body.amount);
  if (amount < GIFT_MIN || amount > GIFT_MAX) throw err(400, 'amount_out_of_range');
  const x: Row = { id: nid(), child_id: c.id, event_id: r.body.eventId || null, giver_name: str(r.body.giverName, 'giver_name', 60), giver_email: r.body.giverEmail || null, amount, message: r.body.message || null, is_public: r.body.isPublic === false ? 0 : 1, unlock_age: r.body.unlockAge || null, status: 'pending', created_at: now() };
  x.checkout_id = 'chk_' + rid();
  S.contributions.push(x);
  S.checkouts.set(x.checkout_id, { checkoutId: x.checkout_id, amount, description: `מתנה לעתיד של ${c.first_name}`, status: 'open' });
  return { contributionId: x.id, checkoutId: x.checkout_id, redirectUrl: `/pay/${x.checkout_id}` };
});
on('GET', '/gift/:code/receipt/:cid', (_r, [code, cid]) => {
  const c = byCode(code), x = S.contributions.find((y) => y.id === Number(cid) && y.child_id === c.id);
  if (!x) throw err(404, 'not_found');
  return { status: x.status, amount: x.amount, giverName: x.giver_name, childFirstName: c.first_name, avatar: c.avatar, paidAt: x.paid_at, birthDate: c.birth_date };
});
on('GET', '/payments/:id', (_r, [id]) => { const k = S.checkouts.get(id); if (!k) throw err(404, 'not_found'); return { checkout: k, provider: 'Sandbox Payments (mock)' }; });
on('POST', '/payments/:id/complete', (r, [id]) => {
  const k = S.checkouts.get(id), x = S.contributions.find((y) => y.checkout_id === id);
  if (!k || !x) throw err(404, 'not_found');
  if (x.status !== 'pending') throw err(409, 'already_processed');
  k.status = 'paid'; x.status = 'paid'; x.paid_at = now(); x.payment_ref = String(r.body.method || 'card').toUpperCase() + '-' + rid();
  const child = S.children.find((c) => c.id === x.child_id)!;
  invest(child, x);
  const g = S.users.find((u) => u.id === child.guardian_id)!;
  S.outbox.push({ id: nid(), recipient: g.email, subject: `🎁 ${x.giver_name} שלח/ה מתנה לעתיד של ${child.first_name}`, body: `₪${x.amount / 100} הושקעו בחשבון. ${x.message || ''}`, created_at: now() });
  return { ok: true, returnUrl: `/g/${child.gift_code}/thanks/${x.id}` };
});
on('POST', '/payments/:id/cancel', (_r, [id]) => {
  const x = S.contributions.find((y) => y.checkout_id === id);
  if (x?.status === 'pending') x.status = 'cancelled';
  const child = x && S.children.find((c) => c.id === x.child_id);
  return { ok: true, returnUrl: child ? `/g/${child.gift_code}` : '/' };
});
const admin = (r: Req) => { const u = need(r); if (u.role !== 'admin') throw err(403, 'forbidden'); };
on('GET', '/admin/stats', (r) => {
  admin(r);
  const inv = S.contributions.filter((c) => c.status === 'invested');
  const months = new Map<string, Row>();
  for (const c of inv) { const m = c.paid_at.slice(0, 7); const e = months.get(m) || { month: m, gifts: 0, amount: 0 }; e.gifts++; e.amount += c.amount; months.set(m, e); }
  const aum = S.children.reduce((s, c) => s + holdings(c.id).reduce((a, h) => a + h.units * partner.navOn(h.track, today()) * 100, 0), 0);
  return {
    users: S.users.length, verifiedGuardians: S.users.filter((u) => u.kyc_status === 'verified').length, children: S.children.length, gifts: inv.length,
    giftVolume: inv.reduce((s, c) => s + c.amount, 0), avgGift: Math.round(inv.reduce((s, c) => s + c.amount, 0) / (inv.length || 1)),
    pending: S.contributions.filter((c) => c.status === 'pending').length, aum: Math.round(aum), monthly: [...months.values()].sort((a, b) => (a.month < b.month ? -1 : 1)).slice(-12),
  };
});
on('GET', '/admin/users', (r) => { admin(r); return { users: S.users.slice().reverse().map((u) => ({ ...u, password: undefined, children: S.children.filter((c) => c.guardian_id === u.id).length })) }; });
on('GET', '/admin/contributions', (r) => { admin(r); return { contributions: S.contributions.slice().reverse().map((x) => ({ ...x, child: S.children.find((c) => c.id === x.child_id)?.first_name })) }; });
on('GET', '/admin/outbox', (r) => { admin(r); return { messages: S.outbox.slice().reverse() }; });

export async function mockApi(path: string, opts: { method?: string; body?: unknown }, tok: string | null) {
  const method = opts.method || (opts.body ? 'POST' : 'GET');
  const [p, q] = path.split('?');
  const user = tok ? S.users.find((u) => 'demo.' + u.id === tok) || null : null;
  await new Promise((r) => setTimeout(r, 120));
  for (const [m, re, h] of routes) {
    const hit = m === method && p.match(re);
    if (hit) return JSON.parse(JSON.stringify(h({ method, path: p, body: (opts.body as Row) || {}, user, query: new URLSearchParams(q) }, hit.slice(1).map(decodeURIComponent))));
  }
  throw err(404, 'not_found');
}

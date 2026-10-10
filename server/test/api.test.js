import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db.js';
import { createApp } from '../src/app.js';
import { SandboxInvestmentPartner } from '../src/adapters/investment-partner.js';
import { SandboxPayments } from '../src/adapters/payments.js';
import { validIsraeliId } from '../src/routes/auth.js';
import { activateFund, remindMissingDocs } from '../src/lib/fund.js';
import { OutboxNotifier } from '../src/adapters/notifier.js';

let server, base, token, childId, giftCode;
const db = openDb(':memory:');
const ctx = { db, partner: new SandboxInvestmentPartner(), payments: new SandboxPayments(), notifier: new OutboxNotifier(db) };

const DOCS = {
  guardian_id: { fileName: 'id.jpg', size: 200000 },
  second_guardian_id: { fileName: 'id2.pdf', size: 200000 },
  child_birth: { fileName: 'sefach.png', size: 300000 },
  bank_confirmation: { fileName: 'bank.pdf', size: 90000 },
  kyc_form: { answers: { occupation: 'מהנדסת', sourceOfFunds: 'מתנות משפחה', pep: false } },
  application_signed: { signerName: 'הורה', secondSignerName: 'הורה שני', agree: true },
};
/** Complete the checklist through the API, then confirm as the investment house would. */
async function openFund(id) {
  let st;
  for (const [doc, body] of Object.entries(DOCS)) st = (await api(`/children/${id}/documents/${doc}`, { method: 'POST', body })).body;
  assert.equal(st.accountStatus, 'in_review');
  return activateFund(ctx, db.prepare('SELECT * FROM children WHERE id=?').get(id));
}

async function api(path, { method = 'GET', body, auth = true } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', ...(auth && token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
}

before(async () => {
  const app = createApp(ctx);
  await new Promise((r) => (server = app.listen(0, r)));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => server.close());

test('israeli id check digit', () => {
  assert.equal(validIsraeliId('000000018'), true);
  assert.equal(validIsraeliId('123456789'), false);
});

test('register, reject duplicate, login', async () => {
  const r = await api('/auth/register', { method: 'POST', body: { email: 'p@x.com', password: 'secret123', name: 'הורה' } });
  assert.equal(r.status, 201);
  token = r.body.token;
  assert.equal((await api('/auth/register', { method: 'POST', body: { email: 'P@x.com', password: 'secret123', name: 'x' } })).status, 409);
  assert.equal((await api('/auth/login', { method: 'POST', body: { email: 'p@x.com', password: 'nope' } })).status, 401);
  assert.equal((await api('/auth/login', { method: 'POST', body: { email: 'p@x.com', password: 'secret123' } })).status, 200);
});

test('child creation requires KYC', async () => {
  const r = await api('/children', { method: 'POST', body: { firstName: 'דני', birthDate: '2020-01-01' } });
  assert.equal(r.status, 403);
  assert.equal(r.body.error, 'kyc_required');
  assert.equal((await api('/auth/kyc', { method: 'POST', body: { nationalId: '123456789', consent: true } })).status, 400);
  const k = await api('/auth/kyc', { method: 'POST', body: { nationalId: '18', consent: true } });
  assert.equal(k.body.user.kycStatus, 'verified');
});

test('create child gets QR code and birthday event; fund opens after the document checklist', async () => {
  const r = await api('/children', { method: 'POST', body: { firstName: 'דני', birthDate: '2020-01-01', track: 'conservative', provider: 'meitav' } });
  assert.equal(r.status, 201);
  childId = r.body.child.id;
  giftCode = r.body.child.giftCode;
  assert.match(giftCode, /^[a-z0-9]{10}$/);
  assert.equal(r.body.child.accountStatus, 'pending_docs');
  assert.equal(r.body.child.providerName, 'מיטב');
  assert.equal(r.body.documents.missing.length, 6);
  assert.equal((await api(`/children/${childId}/documents/guardian_id`, { method: 'POST', body: { fileName: 'virus.exe' } })).body.error, 'invalid_file');
  assert.equal((await api(`/children/${childId}/documents/application_signed`, { method: 'POST', body: { signerName: 'x', agree: true } })).body.error, 'both_signatures_required');
  const { accountId } = await openFund(childId);
  assert.match(accountId, /^MEI-GML-/);
  const d = await api(`/children/${childId}`);
  assert.equal(d.body.child.accountStatus, 'active');
  assert.equal(d.body.events.length, 1);
  assert.equal(d.body.portfolio.value, 0);
});

test('gift flow: public page -> checkout -> invested', async () => {
  const page = await api(`/gift/${giftCode}`, { auth: false });
  assert.equal(page.body.child.firstName, 'דני');
  assert.equal(page.body.child.lastName, undefined, 'public page must not leak surname');
  assert.equal((await api(`/gift/${giftCode}/contribute`, { method: 'POST', auth: false, body: { amount: 5, giverName: 'x' } })).status, 400);

  const c = await api(`/gift/${giftCode}/contribute`, {
    method: 'POST', auth: false,
    body: { amount: 180, giverName: 'סבתא', giverEmail: 'g@x.com', message: 'לעתיד', unlockAge: 18 },
  });
  assert.equal(c.status, 201);
  const pay = await api(`/payments/${c.body.checkoutId}/complete`, { method: 'POST', auth: false, body: { method: 'bit' } });
  assert.equal(pay.status, 200);
  assert.equal((await api(`/payments/${c.body.checkoutId}/complete`, { method: 'POST', auth: false, body: {} })).status, 409);

  const d = await api(`/children/${childId}`);
  assert.equal(d.body.portfolio.deposited, 18000);
  assert.ok(Math.abs(d.body.portfolio.value - 18000) <= 1);
  const list = await api(`/children/${childId}/contributions`);
  assert.equal(list.body.contributions[0].sealed, true);
  assert.equal(list.body.contributions[0].message, null, 'time capsule stays sealed');
  const wall = await api(`/gift/${giftCode}`, { auth: false });
  assert.equal(wall.body.wall[0].sealedUntil, 18);
  assert.equal(wall.body.giverCount, 1);
});

test('switch track keeps value; both parents sign; once per quarter', async () => {
  const before = (await api(`/children/${childId}`)).body.portfolio.value;
  assert.equal((await api(`/children/${childId}/track`, { method: 'POST', body: { track: 'equity' } })).body.error, 'second_guardian_signature_required');
  await api(`/children/${childId}/track`, { method: 'POST', body: { track: 'equity', coSigned: true } });
  const d = await api(`/children/${childId}`);
  assert.equal(d.body.child.track, 'equity');
  assert.ok(Math.abs(d.body.portfolio.value - before) <= 2);
  assert.equal(d.body.portfolio.holdings.length, 1);
  assert.ok(d.body.child.nextTrackSwitch > new Date().toISOString().slice(0, 10));
  assert.equal((await api(`/children/${childId}/track`, { method: 'POST', body: { track: 'solid', coSigned: true } })).body.error, 'track_switch_quarter');
});

test('gifts before the fund opens wait, then are invested on opening; parents get reminders', async () => {
  const kid = (await api('/children', { method: 'POST', body: { firstName: 'מיה', birthDate: '2026-01-15', provider: 'altshuler' } })).body.child;
  const c = await api(`/gift/${kid.giftCode}/contribute`, { method: 'POST', auth: false, body: { amount: 360, giverName: 'סבא' } });
  await api(`/payments/${c.body.checkoutId}/complete`, { method: 'POST', auth: false, body: {} });
  let d = (await api(`/children/${kid.id}`)).body;
  assert.equal(d.portfolio.held, 36000);
  assert.equal(d.portfolio.value, 0);
  assert.equal(remindMissingDocs(ctx).reminded, 1);
  assert.equal(remindMissingDocs(ctx).reminded, 0, 'not again within 3 days');
  await openFund(kid.id);
  d = (await api(`/children/${kid.id}`)).body;
  assert.equal(d.portfolio.held, 0);
  assert.equal(d.portfolio.deposited, 36000);
});

test('lessons graded and stars counted', async () => {
  const wrong = await api(`/children/${childId}/lessons/what-is-money/complete`, { method: 'POST', body: { answers: [1, 1] } });
  assert.equal(wrong.body.passed, false);
  const ok = await api(`/children/${childId}/lessons/what-is-money/complete`, { method: 'POST', body: { answers: [0, 1] } });
  assert.equal(ok.body.passed, true);
  const l = await api(`/children/${childId}/lessons`);
  assert.equal(l.body.totalStars, 3);
  assert.equal(l.body.band, 'little');
});

test('another parent cannot see the child; admin endpoints locked', async () => {
  const other = await api('/auth/register', { method: 'POST', body: { email: 'o@x.com', password: 'secret123', name: 'אחר' } });
  const mine = token;
  token = other.body.token;
  assert.equal((await api(`/children/${childId}`)).status, 404);
  assert.equal((await api('/admin/stats')).status, 403);
  token = mine;
});

test('login portals admit their own role only', async () => {
  const r = await api('/auth/login', { method: 'POST', body: { email: 'p@x.com', password: 'secret123', portal: 'admin' } });
  assert.equal(r.status, 403);
  assert.equal(r.body.error, 'wrong_portal');
  assert.equal((await api('/auth/login', { method: 'POST', body: { email: 'p@x.com', password: 'secret123', portal: 'parent' } })).status, 200);
});

test('kid portal: parent sets login, child signs in and sees only own data', async () => {
  assert.equal((await api(`/children/${childId}/kid-login`, { method: 'POST', body: { username: 'Dani', pin: '12' } })).status, 400);
  const set = await api(`/children/${childId}/kid-login`, { method: 'POST', body: { username: 'Dani', pin: '2468' } });
  assert.equal(set.body.child.kidUsername, 'dani');
  assert.equal(set.body.child.stage, 'young');

  assert.equal((await api('/kid/login', { method: 'POST', auth: false, body: { username: 'dani', pin: '0000' } })).status, 401);
  const login = await api('/kid/login', { method: 'POST', auth: false, body: { username: 'DANI', pin: '2468' } });
  assert.equal(login.status, 200);
  const parentToken = token;
  token = login.body.token;
  const me = await api('/kid/me');
  assert.equal(me.body.child.firstName, 'דני');
  assert.equal(me.body.child.partnerAccountId, undefined);
  assert.ok(me.body.portfolio.value > 0);
  const gifts = await api('/kid/gifts');
  assert.equal(gifts.body.gifts[0].giverEmail, undefined, 'kids never see giver emails');
  assert.equal((await api(`/children/${childId}`)).status, 401, 'child token cannot use parent routes');
  assert.equal((await api('/kid/lessons/three-jars/complete', { method: 'POST', body: { answers: [1, 1] } })).body.passed, true);
  token = parentToken;
  assert.equal((await api(`/children/${childId}/lessons`)).body.totalStars, 6);
});

test('school grade and stage', async () => {
  const { schoolGrade, stageOf } = await import('../src/lib/dates.js');
  assert.equal(schoolGrade('2019-05-12', '2026-10-10'), 2);
  assert.equal(schoolGrade('2013-11-03', '2026-10-10'), 8);
  assert.equal(stageOf('2019-05-12', '2026-10-10'), 'young');
  assert.equal(stageOf('2013-11-03', '2026-10-10'), 'middle');
  assert.equal(stageOf('2009-03-20', '2026-10-10'), 'senior');
  assert.equal(stageOf('2006-01-01', '2026-10-10'), 'senior');
});

test('payment methods: bit is one-time only, masav is monthly only', async () => {
  const base = { amount: 100, giverName: 'דוד' };
  assert.equal((await api(`/gift/${giftCode}/contribute`, { method: 'POST', auth: false, body: { ...base, method: 'bit', frequency: 'monthly' } })).body.error, 'method_not_recurring');
  assert.equal((await api(`/gift/${giftCode}/contribute`, { method: 'POST', auth: false, body: { ...base, method: 'masav' } })).body.error, 'method_recurring_only');
  const bit = await api(`/gift/${giftCode}/contribute`, { method: 'POST', auth: false, body: { ...base, method: 'paybox' } });
  const chk = await api(`/payments/${bit.body.checkoutId}`, { auth: false });
  assert.equal(chk.body.checkout.method, 'paybox');
  const bank = await api(`/gift/${giftCode}/contribute`, { method: 'POST', auth: false, body: { ...base, method: 'bank_transfer' } });
  assert.ok((await api(`/payments/${bank.body.checkoutId}`, { auth: false })).body.checkout.bank.reference);
});

test('monthly gift by card: first month charged, then scheduler charges the next', async () => {
  const before = (await api(`/children/${childId}`)).body.portfolio.deposited;
  const r = await api(`/gift/${giftCode}/contribute`, { method: 'POST', auth: false, body: { amount: 100, giverName: 'סבתא', method: 'card', frequency: 'monthly' } });
  assert.ok(r.body.pledgeToken);
  await api(`/payments/${r.body.checkoutId}/complete`, { method: 'POST', auth: false, body: {} });
  let p = (await api(`/pledge/${r.body.pledgeToken}`, { auth: false })).body.pledge;
  assert.equal(p.status, 'active');
  assert.equal(p.charges, 1);
  const { runDuePledges } = await import('../src/lib/pledges.js');
  const { SandboxPayments } = await import('../src/adapters/payments.js');
  const { SandboxInvestmentPartner } = await import('../src/adapters/investment-partner.js');
  const ctx = { db, partner: new SandboxInvestmentPartner(), payments: new SandboxPayments(), notifier: { send() {} } };
  assert.equal(runDuePledges(ctx).charged, 0, 'nothing due until next month');
  assert.equal(runDuePledges(ctx, p.nextDate).charged, 1);
  p = (await api(`/pledge/${r.body.pledgeToken}`, { auth: false })).body.pledge;
  assert.equal(p.charges, 2);
  assert.equal((await api(`/children/${childId}`)).body.portfolio.deposited, before + 20000);
  await api(`/pledge/${r.body.pledgeToken}/cancel`, { method: 'POST', auth: false });
  assert.equal(runDuePledges(ctx, '2099-01-01').charged, 0, 'cancelled gifts are never charged');
});

test('monthly gift by bank direct debit waits for bank authorization', async () => {
  const r = await api(`/gift/${giftCode}/contribute`, { method: 'POST', auth: false, body: { amount: 150, giverName: 'סבא', method: 'masav', frequency: 'monthly' } });
  let p = (await api(`/pledge/${r.body.pledgeToken}`, { auth: false })).body.pledge;
  assert.equal(p.status, 'pending');
  assert.ok(p.institutionCode && p.mandateRef);
  p = (await api(`/pledge/${r.body.pledgeToken}/authorize`, { method: 'POST', auth: false })).body.pledge;
  assert.equal(p.status, 'active');
  assert.equal(p.charges, 1);
  const list = await api(`/children/${childId}/pledges`);
  assert.ok(list.body.pledges.some((x) => x.method === 'masav' && x.status === 'active'));
});

test('addMonth clamps to month length', async () => {
  const { addMonth } = await import('../src/lib/pledges.js');
  assert.equal(addMonth('2026-01-31'), '2026-02-28');
  assert.equal(addMonth('2026-12-15'), '2027-01-15');
});

test('planned gifts: child requests within the yearly budget, parent approves the payout', async () => {
  const parentToken = token;
  let plan = (await api(`/children/${childId}/planner`)).body;
  assert.equal(plan.budget.pct, 25);
  assert.ok(plan.budget.available > 0);
  await api(`/children/${childId}/withdraw-pct`, { method: 'POST', body: { pct: 50 } });

  token = (await api('/kid/login', { method: 'POST', auth: false, body: { username: 'dani', pin: '2468' } })).body.token;
  plan = (await api('/kid/wishes', { method: 'POST', body: { title: 'אופניים', icon: '🚲', targetAmount: 300, targetDate: '2027-01-01' } })).body;
  const wish = plan.wishes.find((w) => w.title === 'אופניים');
  assert.ok(wish.costAt21 > wish.targetAmount, 'shows what the money would grow to');
  assert.equal((await api('/kid/withdrawals', { method: 'POST', body: { amount: 999999, wishId: wish.id } })).body.error, 'over_budget');
  const avail = plan.budget.available;
  plan = (await api('/kid/withdrawals', { method: 'POST', body: { amount: Math.floor(avail / 200), wishId: wish.id } })).body;
  const req = plan.withdrawals[0];
  assert.equal(req.status, 'requested');
  assert.equal((await api(`/children/${childId}/withdrawals/${req.id}/approve`, { method: 'POST', body: { method: 'bit', destination: '050' } })).status, 401, 'child cannot approve');

  token = parentToken;
  const valueBefore = (await api(`/children/${childId}`)).body.portfolio.value;
  plan = (await api(`/children/${childId}/withdrawals/${req.id}/approve`, { method: 'POST', body: { method: 'bit', destination: '050-0000000', coSigned: true } })).body;
  assert.equal(plan.withdrawals[0].status, 'paid');
  const valueAfter = (await api(`/children/${childId}`)).body.portfolio.value;
  assert.ok(Math.abs(valueBefore - valueAfter - req.amount) <= 2, 'units sold for the payout');
  assert.equal((await api(`/children/${childId}/withdrawals`, { method: 'POST', body: { amount: 1, method: 'cash', destination: 'x' } })).body.error, 'invalid_payout_method');
});

test('kid deposits own earnings: tagged by source, private, counted as earned', async () => {
  const parentToken = token;
  token = (await api('/kid/login', { method: 'POST', auth: false, body: { username: 'dani', pin: '2468' } })).body.token;
  const d = await api('/kid/deposits', { method: 'POST', body: { amount: 120, source: 'babysitting', method: 'paybox' } });
  assert.equal(d.status, 201);
  await api(`/payments/${d.body.checkoutId}/complete`, { method: 'POST', auth: false, body: {} });
  const m = await api('/kid/deposits', { method: 'POST', body: { amount: 500, source: 'salary', method: 'card', frequency: 'monthly' } });
  assert.equal(m.status, 201);
  assert.ok(m.body.pledgeToken);
  await api(`/payments/${m.body.checkoutId}/complete`, { method: 'POST', auth: false, body: {} });
  const list = (await api('/kid/deposits')).body;
  assert.deepEqual(list.deposits.map((x) => x.source).sort(), ['babysitting', 'salary']);
  assert.equal(list.pledges[0].status, 'active');
  const me = (await api('/kid/me')).body;
  assert.equal(me.portfolio.earned, 62000);
  const wall = await api(`/gift/${giftCode}`, { auth: false });
  assert.ok(!wall.body.wall.some((w) => w.amount === 12000), 'earnings stay off the public wall');
  token = parentToken;
});

test('parent deposits part of the bar mitzvah gifts, tagged to the event', async () => {
  const r = await api(`/children/${childId}/deposits`, { method: 'POST', body: { amount: 2500, method: 'bank_transfer', eventType: 'bar_mitzvah', eventTitle: 'בר המצווה של דני', eventDate: '2026-09-01', message: 'חצי מהצ\'קים' } });
  assert.equal(r.status, 201);
  await api(`/payments/${r.body.checkoutId}/complete`, { method: 'POST', auth: false, body: {} });
  const g = (await api(`/children/${childId}/contributions`)).body.contributions.find((x) => x.source === 'event_gifts');
  assert.equal(g.amount, 250000);
  assert.equal(g.eventTitle, 'בר המצווה של דני');
  assert.equal((await api(`/children/${childId}/deposits`, { method: 'POST', body: { amount: 82000, method: 'card' } })).body.error, 'annual_ceiling');
});

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db.js';
import { createApp } from '../src/app.js';
import { SandboxInvestmentPartner } from '../src/adapters/investment-partner.js';
import { SandboxPayments } from '../src/adapters/payments.js';
import { validIsraeliId } from '../src/routes/auth.js';

let server, base, token, childId, giftCode;
const db = openDb(':memory:');

async function api(path, { method = 'GET', body, auth = true } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', ...(auth && token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
}

before(async () => {
  const app = createApp({ db, partner: new SandboxInvestmentPartner(), payments: new SandboxPayments() });
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

test('create child gets QR code, partner account and birthday event', async () => {
  const r = await api('/children', { method: 'POST', body: { firstName: 'דני', birthDate: '2020-01-01', track: 'balanced' } });
  assert.equal(r.status, 201);
  childId = r.body.child.id;
  giftCode = r.body.child.giftCode;
  assert.match(giftCode, /^[a-z0-9]{10}$/);
  assert.match(r.body.child.partnerAccountId, /^SBX-/);
  const d = await api(`/children/${childId}`);
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

test('switch track keeps value', async () => {
  const before = (await api(`/children/${childId}`)).body.portfolio.value;
  await api(`/children/${childId}/track`, { method: 'POST', body: { track: 'equity' } });
  const d = await api(`/children/${childId}`);
  assert.equal(d.body.child.track, 'equity');
  assert.ok(Math.abs(d.body.portfolio.value - before) <= 2);
  assert.equal(d.body.portfolio.holdings.length, 1);
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
  plan = (await api(`/children/${childId}/withdrawals/${req.id}/approve`, { method: 'POST', body: { method: 'bit', destination: '050-0000000' } })).body;
  assert.equal(plan.withdrawals[0].status, 'paid');
  const valueAfter = (await api(`/children/${childId}`)).body.portfolio.value;
  assert.ok(Math.abs(valueBefore - valueAfter - req.amount) <= 2, 'units sold for the payout');
  assert.equal((await api(`/children/${childId}/withdrawals`, { method: 'POST', body: { amount: 1, method: 'cash', destination: 'x' } })).body.error, 'invalid_payout_method');
});

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

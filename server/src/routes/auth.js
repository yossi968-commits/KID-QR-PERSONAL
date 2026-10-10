import { Router } from 'express';
import { hashPassword, verifyPassword, issueToken } from '../lib/auth.js';
import { h, bad, requireString, HttpError } from '../lib/http.js';
import { requireUser, audit, publicUser } from '../lib/guards.js';
import { normalizePhone, normalizeId, maskPhone, findByIdAndPhone, sendCode, checkCode } from '../lib/otp.js';
import crypto from 'node:crypto';

const r = Router();
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Parents register with their Israeli ID and mobile phone (plus an email for receipts).
 * The phone is confirmed with an SMS code before the first sign-in. A password is
 * optional and only kept for the email sign-in fallback.
 */
r.post('/register', h((req, res) => {
  const { db } = req.ctx;
  const email = requireString(req.body.email, 'email', { max: 120 }).toLowerCase();
  if (!EMAIL.test(email)) throw bad('invalid_email');
  const password = req.body.password;
  if (password !== undefined && (typeof password !== 'string' || password.length < 8)) throw bad('weak_password');
  const name = requireString(req.body.name, 'name', { max: 80 });
  if (db.prepare('SELECT 1 FROM users WHERE email=?').get(email)) throw new HttpError(409, 'email_taken');
  const byPhone = req.body.nationalId !== undefined || req.body.phone !== undefined;
  let nationalId = null, phone = null;
  if (byPhone) {
    nationalId = normalizeId(req.body.nationalId);
    if (!validIsraeliId(nationalId)) throw bad('invalid_national_id');
    phone = normalizePhone(req.body.phone);
    if (!phone) throw bad('invalid_phone');
    if (db.prepare('SELECT 1 FROM users WHERE national_id=?').get(nationalId)) throw new HttpError(409, 'id_taken');
  } else if (password === undefined) throw bad('weak_password');
  const locale = ['he', 'en'].includes(req.body.locale) ? req.body.locale : 'he';
  const { lastInsertRowid } = db
    .prepare('INSERT INTO users (email, password_hash, name, phone, locale, national_id) VALUES (?,?,?,?,?,?)')
    .run(email, hashPassword(password || crypto.randomBytes(24).toString('hex')), name, phone, locale, nationalId);
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(lastInsertRowid);
  audit(db, user.id, 'register');
  if (byPhone) {
    const sent = sendCode(req.ctx, user);
    return res.status(201).json({ codeSent: true, phone: maskPhone(phone), ...(req.ctx.exposeOtp && { devCode: sent.code }) });
  }
  res.status(201).json({ token: issueToken(user), user: publicUser(user) });
}));

/** Step 1 of the parent sign-in: ID + phone. Same answer whether or not they match, so IDs can't be probed. */
r.post('/otp/request', h((req, res) => {
  const { db } = req.ctx;
  if (!normalizePhone(req.body.phone)) throw bad('invalid_phone');
  if (!validIsraeliId(normalizeId(req.body.nationalId))) throw bad('invalid_national_id');
  const user = findByIdAndPhone(db, req.body.nationalId, req.body.phone);
  let devCode;
  if (user && user.role === 'parent') {
    const sent = sendCode(req.ctx, user);
    if (sent.error) throw new HttpError(429, sent.error);
    devCode = sent.code;
  }
  res.json({ codeSent: true, phone: maskPhone(normalizePhone(req.body.phone)), ...(req.ctx.exposeOtp && devCode && { devCode }) });
}));

/** Step 2: the 6-digit code from the SMS. */
r.post('/otp/verify', h((req, res) => {
  const { db } = req.ctx;
  const user = findByIdAndPhone(db, req.body.nationalId, req.body.phone);
  if (!user || user.role !== 'parent') throw new HttpError(401, 'bad_code');
  const out = checkCode(db, user, req.body.code);
  if (out.error) throw new HttpError(out.error === 'code_locked' ? 429 : 401, out.error);
  audit(db, user.id, 'login_otp');
  res.json({ token: issueToken(user), user: publicUser(user) });
}));

r.post('/login', h((req, res) => {
  const { db } = req.ctx;
  const user = db.prepare('SELECT * FROM users WHERE email=?').get(String(req.body.email || '').toLowerCase());
  if (!user || !verifyPassword(String(req.body.password || ''), user.password_hash)) throw new HttpError(401, 'bad_credentials');
  // Each entry point admits its own role only.
  if (req.body.portal === 'admin' && user.role !== 'admin') throw new HttpError(403, 'wrong_portal');
  if (req.body.portal === 'parent' && user.role !== 'parent') throw new HttpError(403, 'wrong_portal');
  audit(db, user.id, 'login');
  res.json({ token: issueToken(user), user: publicUser(user) });
}));

r.get('/me', requireUser, (req, res) => res.json({ user: publicUser(req.user) }));

r.patch('/me', requireUser, h((req, res) => {
  const { db } = req.ctx;
  const name = req.body.name !== undefined ? requireString(req.body.name, 'name', { max: 80 }) : req.user.name;
  const phone = req.body.phone !== undefined ? String(req.body.phone).slice(0, 30) : req.user.phone;
  const locale = ['he', 'en'].includes(req.body.locale) ? req.body.locale : req.user.locale;
  db.prepare('UPDATE users SET name=?, phone=?, locale=? WHERE id=?').run(name, phone, locale, req.user.id);
  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id)) });
}));

/**
 * Guardian identity verification (KYC). In production this hands off to the
 * investment partner's onboarding (ID scan + liveness + AML screening). The
 * sandbox validates the Israeli ID check digit and approves instantly.
 */
r.post('/kyc', requireUser, h((req, res) => {
  const { db } = req.ctx;
  // Parents who signed up with their ID only confirm; older accounts type it here.
  const id = req.body.nationalId ? String(req.body.nationalId).replace(/\D/g, '').padStart(9, '0') : req.user.national_id || '';
  if (!validIsraeliId(id)) throw bad('invalid_national_id');
  if (!req.body.consent) throw bad('consent_required');
  if (req.user.national_id && req.user.national_id !== id) throw bad('id_mismatch');
  if (db.prepare('SELECT 1 FROM users WHERE national_id=? AND id<>?').get(id, req.user.id)) throw new HttpError(409, 'id_taken');
  db.prepare(`UPDATE users SET national_id=?, kyc_status='verified' WHERE id=?`).run(id, req.user.id);
  audit(db, req.user.id, 'kyc_verified');
  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id)) });
}));

export function validIsraeliId(id) {
  if (!/^\d{9}$/.test(id)) return false;
  const sum = [...id].reduce((s, d, i) => {
    let x = Number(d) * ((i % 2) + 1);
    if (x > 9) x -= 9;
    return s + x;
  }, 0);
  return sum % 10 === 0;
}

export default r;

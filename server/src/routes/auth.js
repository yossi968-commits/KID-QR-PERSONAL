import { Router } from 'express';
import { hashPassword, verifyPassword, issueToken } from '../lib/auth.js';
import { h, bad, requireString, HttpError } from '../lib/http.js';
import { requireUser, audit, publicUser } from '../lib/guards.js';

const r = Router();
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

r.post('/register', h((req, res) => {
  const { db } = req.ctx;
  const email = requireString(req.body.email, 'email', { max: 120 }).toLowerCase();
  if (!EMAIL.test(email)) throw bad('invalid_email');
  const password = req.body.password;
  if (typeof password !== 'string' || password.length < 8) throw bad('weak_password');
  const name = requireString(req.body.name, 'name', { max: 80 });
  if (db.prepare('SELECT 1 FROM users WHERE email=?').get(email)) throw new HttpError(409, 'email_taken');
  const locale = ['he', 'en'].includes(req.body.locale) ? req.body.locale : 'he';
  const { lastInsertRowid } = db
    .prepare('INSERT INTO users (email, password_hash, name, phone, locale) VALUES (?,?,?,?,?)')
    .run(email, hashPassword(password), name, req.body.phone || null, locale);
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(lastInsertRowid);
  audit(db, user.id, 'register');
  res.status(201).json({ token: issueToken(user), user: publicUser(user) });
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
  const id = String(req.body.nationalId || '').replace(/\D/g, '').padStart(9, '0');
  if (!validIsraeliId(id)) throw bad('invalid_national_id');
  if (!req.body.consent) throw bad('consent_required');
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

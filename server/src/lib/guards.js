import { HttpError } from './http.js';

export function requireUser(req, _res, next) {
  if (!req.user) return next(new HttpError(401, 'unauthorized'));
  next();
}

export function requireAdmin(req, _res, next) {
  if (!req.user) return next(new HttpError(401, 'unauthorized'));
  if (req.user.role !== 'admin') return next(new HttpError(403, 'forbidden'));
  next();
}

export function audit(db, userId, action, details) {
  db.prepare('INSERT INTO audit_log (user_id, action, details) VALUES (?,?,?)').run(userId ?? null, action, details ? JSON.stringify(details) : null);
}

export function publicUser(u) {
  return { id: u.id, email: u.email, name: u.name, phone: u.phone, role: u.role, locale: u.locale, kycStatus: u.kyc_status, hasNationalId: Boolean(u.national_id), community: u.community || 'general' };
}

import crypto from 'node:crypto';

/**
 * Sign-in by Israeli ID + the phone the parent registered with: a one-time 6-digit
 * code goes to that phone by SMS. Codes live 5 minutes, allow 5 tries, and at most
 * 3 are sent per 10 minutes. Only a hash of the code is stored.
 */
export const CODE_TTL_MIN = 5;
export const MAX_TRIES = 5;
export const MAX_SENDS = 3;

/** 050-123-4567, +972 50 1234567 and 0501234567 are the same phone. */
export function normalizePhone(p) {
  let d = String(p || '').replace(/\D/g, '');
  if (d.startsWith('972')) d = '0' + d.slice(3);
  return /^05\d{8}$/.test(d) ? d : null;
}

export const normalizeId = (id) => String(id || '').replace(/\D/g, '').padStart(9, '0').slice(-9);
export const maskPhone = (p) => `${p.slice(0, 3)}-•••-${p.slice(-4)}`;
/** Constant-time compare of two hex strings. */
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
const hashCode = (userId, code) => crypto.createHash('sha256').update(`${userId}:${code}`).digest('hex');

export function findByIdAndPhone(db, nationalId, phone) {
  const p = normalizePhone(phone);
  if (!p) return null;
  return db.prepare('SELECT * FROM users WHERE national_id=? AND phone=?').get(normalizeId(nationalId), p) || null;
}

/** Create and send a code. Returns the code only so a sandbox can show it on screen. */
export function sendCode({ db, notifier }, user) {
  const recent = db.prepare(`SELECT COUNT(*) AS n FROM login_codes WHERE user_id=? AND created_at >= datetime('now','-10 minutes')`).get(user.id).n;
  if (recent >= MAX_SENDS) return { error: 'too_many_codes' };
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  db.prepare(`INSERT INTO login_codes (user_id, code_hash, expires_at) VALUES (?,?,datetime('now','+${CODE_TTL_MIN} minutes'))`).run(user.id, hashCode(user.id, code));
  notifier.send({ channel: 'sms', to: user.phone, subject: 'קוד כניסה', body: `הקוד שלך ל-QR לעתיד: ${code}. בתוקף ${CODE_TTL_MIN} דקות. אל תמסרו אותו לאף אחד.` });
  return { code };
}

export function checkCode(db, user, code) {
  const row = db.prepare(`SELECT * FROM login_codes WHERE user_id=? AND used_at IS NULL AND expires_at > datetime('now') ORDER BY id DESC LIMIT 1`).get(user.id);
  if (!row) return { error: 'code_expired' };
  if (row.attempts >= MAX_TRIES) return { error: 'code_locked' };
  const ok = /^\d{6}$/.test(String(code)) && safeEqual(row.code_hash, hashCode(user.id, String(code)));
  if (!ok) {
    db.prepare('UPDATE login_codes SET attempts=attempts+1 WHERE id=?').run(row.id);
    return { error: row.attempts + 1 >= MAX_TRIES ? 'code_locked' : 'bad_code' };
  }
  db.prepare(`UPDATE login_codes SET used_at=datetime('now') WHERE id=?`).run(row.id);
  return { ok: true };
}

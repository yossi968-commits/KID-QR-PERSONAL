/**
 * Demo replacement for server/src/lib/auth.js. Everything runs in the visitor's own
 * browser with made-up data, so tokens are unsigned and passwords are not hashed.
 */
export const hashPassword = (password: string) => 'demo:' + password;
export const verifyPassword = (password: string, stored: string) => stored === 'demo:' + password;
export const issueToken = (user: { id: number; role: string }) => `u.${user.id}.${user.role}`;
export const issueChildToken = (child: { id: number }) => `c.${child.id}`;
export const issueEmployerToken = (employer: { id: number }) => `e.${employer.id}`;
export function readToken(token?: string | null) {
  const [kind, id, role] = (token || '').split('.');
  if (kind === 'u') return { uid: Number(id), role };
  if (kind === 'c') return { cid: Number(id), role: 'child' };
  if (kind === 'e') return { eid: Number(id), role: 'employer' };
  return null;
}
export function newGiftCode() {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => alphabet[b % alphabet.length]).join('');
}

export class HttpError extends Error {
  constructor(status, code, message) {
    super(message || code);
    this.status = status;
    this.code = code;
  }
}

export const bad = (code, msg) => new HttpError(400, code, msg);
export const notFound = (code = 'not_found') => new HttpError(404, code);
export const forbidden = () => new HttpError(403, 'forbidden');

/** Wrap a sync/async handler so thrown errors reach the error middleware. */
export const h = (fn) => (req, res, next) => {
  try {
    const out = fn(req, res, next);
    if (out && typeof out.catch === 'function') out.catch(next);
  } catch (e) {
    next(e);
  }
};

export function requireString(v, field, { min = 1, max = 200 } = {}) {
  if (typeof v !== 'string' || v.trim().length < min || v.trim().length > max) throw bad('invalid_' + field);
  return v.trim();
}

export function requireDate(v, field) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) throw bad('invalid_' + field);
  return v;
}

/** Shekels (number) -> agorot (integer). */
export function toAgorot(v, field = 'amount') {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) throw bad('invalid_' + field);
  return Math.round(n * 100);
}

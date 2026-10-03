export class ApiError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
  }
}

let token: string | null = null;
try { token = localStorage.getItem('token'); } catch {}

export function setToken(t: string | null) {
  token = t;
  try {
    if (t) localStorage.setItem('token', t);
    else localStorage.removeItem('token');
  } catch {}
}
export const hasToken = () => Boolean(token);

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch('/api' + path, {
    method: opts.method || (opts.body ? 'POST' : 'GET'),
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error || 'server_error');
  return data as T;
}

export type User = { id: number; email: string; name: string; phone?: string; role: 'parent' | 'admin'; locale: 'he' | 'en'; kycStatus: string };
export type Child = {
  id: number; firstName: string; lastName?: string; birthDate: string; age: number; nextBirthday: string; avatar: string;
  giftCode: string; track: string; partnerAccountId: string; goalText?: string; goalAmount?: number; publicMessage?: string;
  value?: number; deposited?: number;
};
export type Track = { id: string; risk: number; expectedReturn: number; annualVol: number; mgmtFee: number; equityShare: number };
export type Portfolio = {
  value: number; deposited: number; gain: number; gainPct: number; giverCount: number;
  holdings: { track: string; units: number; value: number }[];
  history: { date: string; value: number; deposited: number }[];
  projection: { payoutDate: string; payoutAge: number; annualAssumed: number; points: { age: number; low: number; mid: number; high: number }[]; finals: { low: number; mid: number; high: number } };
};
export type EventRow = { id: number; type: string; title: string; date: string; goal_amount: number | null; active: number };

/** Future value of a lump sum after n years at rate r. */
export const fv = (amount: number, years: number, r = 0.065) => amount * Math.pow(1 + r, Math.max(0, years));

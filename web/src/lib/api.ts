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

export const DEMO = import.meta.env.VITE_DEMO === '1';
/** Origin printed in shared links; the demo runs from a file, so it shows the product domain instead. */
export const publicOrigin = () => (DEMO || !location.origin.startsWith('http') ? 'https://kfq.app' : location.origin);

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  if (DEMO) return (await import('../demo/mockApi')).mockApi(path, opts, token);
  const res = await fetch('/api' + path, {
    method: opts.method || (opts.body ? 'POST' : 'GET'),
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error || 'server_error');
  return data as T;
}

export type Stage = 'young' | 'middle' | 'senior';
export type User = { id: number; email: string; name: string; phone?: string; role: 'parent' | 'admin'; locale: 'he' | 'en' | 'ar' | 'ru' | 'fr'; community?: string; kycStatus: string; hasNationalId?: boolean };
export type AccountStatus = 'pending_docs' | 'in_review' | 'active';
export type Child = {
  id: number; firstName: string; lastName?: string; birthDate: string; age: number; grade: number; stage: Stage; nextBirthday: string; avatar: string;
  giftCode: string; track: string; partnerAccountId?: string; goalText?: string; goalAmount?: number; publicMessage?: string; kidUsername?: string | null;
  healthFundId?: number | null; provider: string; providerName: string; prevProvider?: string | null; prevProviderName?: string | null; providerChangedAt?: string | null; accountStatus: AccountStatus; accountOpenedAt?: string | null; nextTrackSwitch?: string | null;
  value?: number; deposited?: number; hidden?: boolean;
  lifecycle: Lifecycle;
};
/** Birth → 18 (young adult takes over) → 21 (moves to a regular fund in their own name). */
export type Lifecycle = {
  phase: 'minor' | 'adult' | 'graduated'; managedBy: 'guardians' | 'self'; handoverDate: string; handedOverAt: string | null;
  graduateFrom: string; canGraduate: boolean; graduatedAt: string | null; minorAccountId: string | null; parentView: boolean; openedAsAdult: boolean;
};
export type Track = { id: string; core: boolean; risk: number; expectedReturn: number; annualVol: number; mgmtFee: number; equityShare: number };
export type Portfolio = {
  value: number; deposited: number; gain: number; gainPct: number; giverCount: number; earned: number; held: number;
  holdings: { track: string; units: number; value: number }[];
  history: { date: string; value: number; deposited: number }[];
  projection: { payoutDate: string; payoutAge: number; annualAssumed: number; points: { age: number; low: number; mid: number; high: number }[]; finals: { low: number; mid: number; high: number } };
};
export type EventRow = { id: number; type: string; title: string; date: string; goal_amount: number | null; active: number };
export type DocItem = { id: string; kind: 'upload' | 'form' | 'sign'; status: 'missing' | 'received' | 'verified' | 'rejected'; fileName: string | null; uploadedAt: string | null };
export type Docs = { items: DocItem[]; missing: string[]; done: number; total: number; accountStatus: AccountStatus; applicationRef: string; adult?: boolean };
export type ChildData = { child: Child; portfolio: Portfolio; events: EventRow[]; documents: Docs };
export type Gift = {
  id: number; giverName: string; giverEmail?: string; amount: number; status: string; source: string; method?: string; monthly: boolean;
  eventTitle?: string; paidAt: string; thankedAt?: string; unlockAge: number | null; sealed: boolean; message: string | null;
};
export type Pledge = { id: number; token: string; giverName: string; amount: number; method: string; status: string; nextDate: string; charges: number; source: string; institutionCode?: string; mandateRef?: string; createdAt: string };
export type Wish = { id: number; title: string; icon: string; targetAmount: number; targetDate: string | null; status: string; createdBy: string; withdrawn: number; costAt21: number };
export type Withdrawal = { id: number; wishId: number | null; purpose: 'general' | 'driving'; amount: number; method: string | null; destination: string | null; note: string | null; status: 'requested' | 'paid' | 'rejected'; requestedBy: string; taxEstimate: number; createdAt: string; decidedAt: string | null };
export type Planner = {
  budget: { pct: number; since: string; resetsOn: string; yearGifts: number; allowed: number; used: number; available: number; value: number; selfManaged?: boolean };
  driving: { eligible: boolean; fromAge: number; cap: number; raised: number; used: number; available: number };
  growthRate: number; yearsTo21: number; wishes: Wish[]; withdrawals: Withdrawal[]; taxRate: number;
};
export type Method = { id: string; kind: string; recurring: boolean; recurringOnly?: boolean };
export type Provider = { id: string; name: string; nameEn: string; nameAr?: string };

export type Employer = {
  id: number; slug: string; name: string; kind: 'employer' | 'committee'; email?: string; contactName?: string; logo: string;
  giftAmount: number; giftMessage?: string; occasions: string[]; amounts: Record<string, number>;
};
export type BirthReport = {
  id: number; employeeName: string; employeeEmail?: string; employeeNumber?: string; babyName?: string; birthDate: string; eventDate?: string | null; occasion: string;
  status: 'reported' | 'invited' | 'linked' | 'gifted'; reportedBy: string; createdAt: string; invitedAt?: string;
  child: { firstName: string; giftCode: string; fundOpen: boolean } | null; gift: { amount: number; status: string; paidAt: string } | null;
};
export const OCCASIONS = ['birth', 'bar_mitzvah', 'bat_mitzvah', 'enlistment'];

export const EARN_SOURCES = ['pocket_money', 'babysitting', 'dog_walking', 'tutoring', 'waiting_tables', 'salary', 'other_work'];
export const EVENT_TYPES = ['birthday', 'brit', 'brita', 'bar_mitzvah', 'bat_mitzvah', 'driving', 'enlistment', 'graduation', 'wedding', 'holiday', 'other'];
/** Occasions offered first for each community (mirrors the server's list). */
const COMMUNITY_EVENTS: Record<string, string[]> = {
  general: EVENT_TYPES,
  dati_leumi: ['birthday', 'brit', 'brita', 'siddur', 'chumash', 'bar_mitzvah', 'tefillin', 'bat_mitzvah', 'mechina', 'enlistment', 'graduation', 'wedding', 'holiday', 'other'],
  haredi: ['brit', 'upsherin', 'siddur', 'chumash', 'tefillin', 'bar_mitzvah', 'bat_mitzvah', 'yeshiva', 'wedding', 'holiday', 'birthday', 'other'],
  arab: ['birthday', 'aqiqa', 'eid', 'graduation', 'driving', 'university', 'wedding', 'holiday', 'other'],
};
export const eventsFor = (community?: string) => COMMUNITY_EVENTS[community || 'general'] || EVENT_TYPES;
/** Occasions a young adult opens on their own QR. */
export const ADULT_EVENT_TYPES = ['enlistment', 'graduation', 'wedding', 'birthday', 'other'];
export const PAYOUT_METHODS = ['bit', 'paybox', 'card', 'bank'];

/** Future value of a lump sum after n years at rate r. */
export const fv = (amount: number, years: number, r = 0.065) => amount * Math.pow(1 + r, Math.max(0, years));

export type Partner = { id: number; slug: string; kind: 'health_fund' | 'formula' | 'other'; name: string; nameEn: string; nameAr?: string | null; logo: string; amount: number; maxChildAge: number | null; active: boolean };
export type PartnerStats = Partner & { gifts: number; total: number; referrals: number; converted: number };
export type CommunityId = 'general' | 'dati_leumi' | 'haredi' | 'arab';
export const COMMUNITIES: CommunityId[] = ['general', 'dati_leumi', 'haredi', 'arab'];
export type Community = { id: CommunityId; events: string[]; goals: { key: string; icon: string; amount: number; age: number }[]; track: string | null };
export type Pregnancy = { id: number; name: string; dueDate: string; partnerId: number | null; remindersSent: string[]; childId: number | null; createdAt: string };
export type Family = { community: Community; pregnancies: Pregnancy[]; partners: Partner[] };

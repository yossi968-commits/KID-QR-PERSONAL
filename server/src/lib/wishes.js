import { tx } from '../db.js';
import { today, ageOn, addYears, nextBirthday } from './dates.js';
import { holdings, PAYOUT_AGE } from './portfolio.js';
import { phaseOf } from './lifecycle.js';

export const CAPITAL_GAINS_TAX = 0.25;
/**
 * Driving lessons: from 16 (when learning to drive may start) a teen may take part of
 * what has built up for lessons and tests, beyond the yearly gift share. Capped at about
 * the cost of a licence, or at what family gave toward driving lessons if that is more.
 */
export const DRIVING_FROM_AGE = 16;
export const DRIVING_CAP = 800000; // ₪8,000

/** Date of the child's most recent birthday (start of the current "gift year"). */
export function lastBirthday(birthDate, on = today()) {
  return addYears(birthDate, ageOn(birthDate, on));
}

function currentValue(db, partner, childId, date = today()) {
  return holdings(db, childId).reduce((s, h) => s + h.units * partner.navOn(h.track, date) * 100, 0);
}

/**
 * Yearly withdrawal budget: the parent lets a share (withdraw_pct) of each gift year's
 * gifts be taken out for physical presents. Unused budget does not roll over, which
 * keeps the rest invested.
 */
export function withdrawalBudget(db, partner, child) {
  const since = lastBirthday(child.birth_date);
  const yearGifts = db.prepare(`SELECT COALESCE(SUM(amount),0) AS s FROM contributions WHERE child_id=? AND status='invested' AND date(paid_at) >= ?`).get(child.id, since).s;
  const used = db.prepare(`SELECT COALESCE(SUM(amount),0) AS s FROM withdrawals WHERE child_id=? AND status IN ('requested','paid') AND purpose<>'driving' AND date(created_at) >= ?`).get(child.id, since).s;
  const allowed = Math.round((yearGifts * child.withdraw_pct) / 100);
  const value = Math.round(currentValue(db, partner, child.id));
  // From 18 the young adult decides; the yearly share no longer applies.
  if (phaseOf(child) !== 'minor') return { pct: 100, since, resetsOn: nextBirthday(child.birth_date), yearGifts, allowed: value, used, available: value, value, selfManaged: true };
  return { pct: child.withdraw_pct, since, resetsOn: nextBirthday(child.birth_date), yearGifts, allowed, used, available: Math.max(0, Math.min(value, allowed - used)), value };
}

export function drivingBudget(db, partner, child) {
  const age = ageOn(child.birth_date);
  const raised = db
    .prepare(`SELECT COALESCE(SUM(c.amount),0) AS s FROM contributions c JOIN events e ON e.id=c.event_id WHERE c.child_id=? AND e.type='driving' AND c.status IN ('paid','invested')`)
    .get(child.id).s;
  const used = db.prepare(`SELECT COALESCE(SUM(amount),0) AS s FROM withdrawals WHERE child_id=? AND purpose='driving' AND status IN ('requested','paid')`).get(child.id).s;
  const cap = Math.max(DRIVING_CAP, raised);
  const value = Math.round(currentValue(db, partner, child.id));
  return { eligible: age >= DRIVING_FROM_AGE && phaseOf(child) === 'minor', fromAge: DRIVING_FROM_AGE, cap, raised, used, available: Math.max(0, Math.min(value, cap - used)) };
}

/** Purpose of a withdrawal, and the budget it is checked against. */
export function withdrawalLimit(db, partner, child, purpose) {
  if (purpose === 'driving') {
    const d = drivingBudget(db, partner, child);
    // Under 16 there is no driving allowance; from 18 the young adult's own rules apply.
    if (!d.eligible) return phaseOf(child) === 'minor' ? { purpose, available: 0 } : { purpose: 'general', available: withdrawalBudget(db, partner, child).available };
    return { purpose, available: d.available };
  }
  return { purpose: 'general', available: withdrawalBudget(db, partner, child).available };
}

/** What a shekel taken out today would have grown to by 21, at the track's expected net return. */
export function costAt21(partner, child, amount) {
  const t = partner.listTracks().find((x) => x.id === child.track);
  const years = Math.max(0, PAYOUT_AGE - ageOn(child.birth_date));
  return Math.round(amount * Math.pow(1 + t.expectedReturn - t.mgmtFee, years));
}

/** Estimated capital-gains tax on the gain share of a withdrawal (simplified, nominal). */
export function taxEstimate(db, partner, childId, amount) {
  const value = currentValue(db, partner, childId);
  const deposited = db.prepare(`SELECT COALESCE(SUM(amount),0) AS s FROM contributions WHERE child_id=? AND status='invested'`).get(childId).s;
  const withdrawn = db.prepare(`SELECT COALESCE(SUM(amount),0) AS s FROM withdrawals WHERE child_id=? AND status='paid'`).get(childId).s;
  const gainShare = value > 0 ? Math.max(0, value - (deposited - withdrawn)) / value : 0;
  return Math.round(amount * gainShare * CAPITAL_GAINS_TAX);
}

/** Sell units pro rata across holdings and pay out to the guardian. */
export function executeWithdrawal(ctx, child, w, { method, destination }, date = today()) {
  const { db, partner, payments, notifier } = ctx;
  return tx(db, () => {
    const hs = holdings(db, child.id, date);
    const total = hs.reduce((s, h) => s + h.units * partner.navOn(h.track, date) * 100, 0);
    if (w.amount > total) throw new Error('insufficient_funds');
    const fraction = w.amount / total;
    for (const h of hs) {
      const units = h.units * fraction;
      const sell = partner.placeSell({ accountId: child.partner_account_id, trackId: h.track, units, date });
      db.prepare(`INSERT INTO transactions (child_id, type, reason, track, amount, units, nav, partner_order_id, date) VALUES (?,?,?,?,?,?,?,?,?)`)
        .run(child.id, 'sell', 'withdrawal', h.track, sell.amount, units, sell.nav, sell.orderId, date);
    }
    const { payoutRef } = payments.payout({ method, destination, amount: w.amount });
    db.prepare(`UPDATE withdrawals SET status='paid', method=?, destination=?, payout_ref=?, decided_at=? WHERE id=?`).run(method, destination, payoutRef, `${date} 12:00:00`, w.id);
    if (w.wish_id) db.prepare(`UPDATE wishes SET status='done' WHERE id=?`).run(w.wish_id);
    const g = db.prepare('SELECT email FROM users WHERE id=?').get(child.guardian_id);
    notifier.send({ to: g.email, subject: `משיכה עבור ${child.first_name} בוצעה`, body: `₪${w.amount / 100} הועברו (${method}). אסמכתא ${payoutRef}.` });
    return payoutRef;
  });
}

export function wishView(w, raised) {
  return { id: w.id, title: w.title, icon: w.icon, targetAmount: w.target_amount, targetDate: w.target_date, status: w.status, createdBy: w.created_by, withdrawn: raised || 0 };
}

export function withdrawalView(w) {
  return { id: w.id, wishId: w.wish_id, purpose: w.purpose || 'general', amount: w.amount, method: w.method, destination: w.destination, note: w.note, status: w.status, requestedBy: w.requested_by, taxEstimate: w.tax_estimate, createdAt: w.created_at, decidedAt: w.decided_at };
}

/** Everything the planning screens need, for parent and child alike. */
export function plannerPayload(db, partner, child) {
  const withdrawals = db.prepare('SELECT * FROM withdrawals WHERE child_id=? ORDER BY id DESC').all(child.id);
  const byWish = new Map();
  for (const w of withdrawals) if (w.wish_id && w.status === 'paid') byWish.set(w.wish_id, (byWish.get(w.wish_id) || 0) + w.amount);
  const wishes = db.prepare(`SELECT * FROM wishes WHERE child_id=? AND status<>'cancelled' ORDER BY COALESCE(target_date,'9999'), id`).all(child.id);
  const budget = withdrawalBudget(db, partner, child);
  const t = partner.listTracks().find((x) => x.id === child.track);
  return {
    budget,
    driving: drivingBudget(db, partner, child),
    growthRate: t.expectedReturn - t.mgmtFee,
    yearsTo21: Math.max(0, PAYOUT_AGE - ageOn(child.birth_date)),
    wishes: wishes.map((w) => ({ ...wishView(w, byWish.get(w.id)), costAt21: costAt21(partner, child, w.target_amount) })),
    withdrawals: withdrawals.map(withdrawalView),
    taxRate: CAPITAL_GAINS_TAX,
  };
}

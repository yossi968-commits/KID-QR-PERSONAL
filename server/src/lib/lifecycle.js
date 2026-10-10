import { tx } from '../db.js';
import { today, ageOn, addYears } from './dates.js';
import { PROVIDERS, providerName } from './fund.js';

/**
 * The app follows a child from birth to 21.
 *   minor   (0–17)  the guardians manage the fund; both sign withdrawals and track switches.
 *   adult   (18–21+) the fund is the young adult's: they manage it themselves and decide
 *                    what the parents may still see.
 *   graduated        from 21 the young adult moves the savings into a regular קופת גמל
 *                    להשקעה in their own name (a transfer between funds, not a withdrawal,
 *                    so no tax is due). The QR stays active for gifts: enlistment,
 *                    graduation, a wedding.
 */
export const MANAGE_AGE = 18;
export const GRADUATE_AGE = 21;

export function phaseOf(c, on = today()) {
  if (c.graduated_at) return 'graduated';
  return ageOn(c.birth_date, on) >= MANAGE_AGE ? 'adult' : 'minor';
}

export function lifecycleView(c, on = today()) {
  const phase = phaseOf(c, on);
  return {
    phase,
    managedBy: phase === 'minor' ? 'guardians' : 'self',
    handoverDate: addYears(c.birth_date, MANAGE_AGE),
    handedOverAt: c.handed_over_at || null,
    graduateFrom: addYears(c.birth_date, GRADUATE_AGE),
    canGraduate: phase === 'adult' && ageOn(c.birth_date, on) >= GRADUATE_AGE && c.account_status === 'active',
    graduatedAt: c.graduated_at || null,
    minorAccountId: c.minor_account_id || null,
    parentView: c.parent_view == null ? true : Boolean(c.parent_view),
  };
}

/**
 * On the 18th birthday management passes to the young adult: the guardians are told,
 * and from now on they cannot act on the fund. Runs from the daily scheduler.
 */
export function runHandovers({ db, notifier }, date = today()) {
  const due = db.prepare('SELECT * FROM children WHERE handed_over_at IS NULL').all().filter((c) => ageOn(c.birth_date, date) >= MANAGE_AGE);
  for (const c of due) {
    db.prepare('UPDATE children SET handed_over_at=? WHERE id=?').run(date, c.id);
    const g = db.prepare('SELECT email FROM users WHERE id=?').get(c.guardian_id);
    notifier.send({ to: g.email, subject: `${c.first_name} בן/בת 18: הקופה עוברת לניהולו/ה`, body: 'מהיום הקופה בניהול עצמי. תוכלו להמשיך לראות אותה אם יאשר/תאשר, ולתת מתנות דרך ה־QR כמו כולם.' });
  }
  return { handedOver: due.length };
}

/**
 * Move the savings into a regular קופת גמל להשקעה in the young adult's name, at the same
 * or another investment house. Units carry over as they are (a fund transfer, not a sale).
 */
export function graduate({ db, partner }, child, { provider }) {
  const view = lifecycleView(child);
  if (!view.canGraduate) return { error: view.phase === 'graduated' ? 'already_graduated' : 'too_young' };
  if (!PROVIDERS.some((p) => p.id === provider)) return { error: 'invalid_provider' };
  return tx(db, () => {
    const date = today();
    const fromAccount = child.partner_account_id;
    const { accountId } = partner.openAccount({ child: { ...child, provider } });
    // The ledger keeps its buy/sell history; the transfer is recorded on the child and in the audit log.
    db.prepare('INSERT INTO audit_log (user_id, action, details) VALUES (?,?,?)').run(null, 'fund_transferred', JSON.stringify({ childId: child.id, from: fromAccount, to: accountId }));
    db.prepare('UPDATE children SET graduated_at=?, provider=?, partner_account_id=?, minor_account_id=? WHERE id=?').run(date, provider, accountId, fromAccount, child.id);
    return { accountId, provider, providerName: providerName(provider), graduatedAt: date };
  });
}

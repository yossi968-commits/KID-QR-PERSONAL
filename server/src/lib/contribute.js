import { bad, requireString, toAgorot } from './http.js';
import { ageOn } from './dates.js';
import { GIFT_MIN, GIFT_MAX } from './portfolio.js';
import { newPledgeToken } from './pledges.js';
import { ANNUAL_CEILING, depositedThisYear } from './fund.js';

/**
 * Where money comes from. Gifts are what family gives; the rest is the child's own
 * money: pocket money and earnings paid straight to their QR instead of cash, and
 * part of a soldier's or young worker's salary.
 */
export const SOURCES = ['gift', 'employer_gift', 'event_gifts', 'pocket_money', 'babysitting', 'dog_walking', 'tutoring', 'waiting_tables', 'salary', 'other_work'];
/** event_gifts: a parent depositing part of the cash gifts from a brit, naming, bar or bat mitzvah. */
export const GIFT_SOURCES = ['gift', 'employer_gift', 'event_gifts'];
export const isEarning = (source) => Boolean(source) && !GIFT_SOURCES.includes(source);
export const EVENT_TYPES = ['birthday', 'brit', 'brita', 'bar_mitzvah', 'bat_mitzvah', 'enlistment', 'graduation', 'wedding', 'holiday', 'other'];

/**
 * Start a deposit. One-time deposits open a checkout for the chosen method. Monthly
 * ones (card or bank direct debit only) create a pledge: card charges the first month
 * now and stores a token; a bank direct debit waits for the giver's bank to confirm.
 */
export function startContribution({ db, payments }, c, body) {
  const amount = toAgorot(body.amount);
  const source0 = SOURCES.includes(body.source) ? body.source : 'gift';
  // A parent's deposit from event gifts can be large; guests stay within the gift limit.
  if (amount < GIFT_MIN || amount > (source0 === 'event_gifts' ? ANNUAL_CEILING : GIFT_MAX)) throw bad('amount_out_of_range');
  if (depositedThisYear(db, c.id) + amount > ANNUAL_CEILING) throw bad('annual_ceiling');
  const giverName = requireString(body.giverName, 'giver_name', { max: 60 });
  const giverEmail = body.giverEmail ? requireString(body.giverEmail, 'giver_email', { max: 120 }) : null;
  const message = body.message ? String(body.message).trim().slice(0, 500) : null;
  const source = source0;
  const method = String(body.method || 'card');
  const m = payments.methods.find((x) => x.id === method);
  if (!m) throw bad('invalid_method');
  const monthly = body.frequency === 'monthly';
  if (monthly && !m.recurring) throw bad('method_not_recurring');
  if (!monthly && m.recurringOnly) throw bad('method_recurring_only');
  const label = source === 'gift' ? `מתנה לעתיד של ${c.first_name}` : source === 'event_gifts' ? `הפקדת מתנות האירוע של ${c.first_name}` : `הפקדה לחיסכון של ${c.first_name}`;

  if (monthly) {
    const token = newPledgeToken();
    const { lastInsertRowid: pledgeId } = db
      .prepare(`INSERT INTO pledges (child_id, token, giver_name, giver_email, amount, method, message, source, next_date) VALUES (?,?,?,?,?,?,?,?,date('now'))`)
      .run(c.id, token, giverName, giverEmail, amount, method, message, source);
    if (method === 'masav') {
      const mandate = payments.createMandate({ reference: pledgeId });
      db.prepare('UPDATE pledges SET institution_code=?, mandate_ref=? WHERE id=?').run(mandate.institutionCode, mandate.mandateRef, pledgeId);
      return { pledgeToken: token, redirectUrl: `/pledge/${token}` };
    }
    const { lastInsertRowid } = db
      .prepare(`INSERT INTO contributions (child_id, giver_name, giver_email, amount, message, is_public, method, pledge_id, source) VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(c.id, giverName, giverEmail, amount, message, body.isPublic === false ? 0 : 1, method, pledgeId, source);
    const checkout = payments.createCheckout({ amount, description: `${label} · חודשי`, reference: lastInsertRowid, method, recurring: true });
    db.prepare('UPDATE contributions SET checkout_id=? WHERE id=?').run(checkout.checkoutId, lastInsertRowid);
    return { contributionId: lastInsertRowid, pledgeToken: token, checkoutId: checkout.checkoutId, redirectUrl: checkout.redirectUrl };
  }

  const unlockAge = body.unlockAge ? Number(body.unlockAge) : null;
  if (unlockAge !== null && (!Number.isInteger(unlockAge) || unlockAge <= ageOn(c.birth_date) || unlockAge > 21)) throw bad('invalid_unlock_age');
  let eventId = body.eventId ? Number(body.eventId) : null;
  if (eventId && !db.prepare('SELECT 1 FROM events WHERE id=? AND child_id=?').get(eventId, c.id)) eventId = null;
  const { lastInsertRowid } = db
    .prepare(`INSERT INTO contributions (child_id, event_id, giver_name, giver_email, amount, message, is_public, unlock_age, method, source) VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run(c.id, eventId, giverName, giverEmail, amount, message, body.isPublic === false || source !== 'gift' ? 0 : 1, unlockAge, method, source);
  const checkout = payments.createCheckout({ amount, description: label, reference: lastInsertRowid, method });
  db.prepare('UPDATE contributions SET checkout_id=? WHERE id=?').run(checkout.checkoutId, lastInsertRowid);
  return { contributionId: lastInsertRowid, checkoutId: checkout.checkoutId, redirectUrl: checkout.redirectUrl };
}

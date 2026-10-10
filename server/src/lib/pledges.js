import crypto from 'node:crypto';
import { tx } from '../db.js';
import { today } from './dates.js';
import { investContribution } from './portfolio.js';

/** Same day next month, clamped to the month's length (Jan 31 -> Feb 28). */
export function addMonth(date) {
  const d = new Date(date + 'T00:00:00Z');
  const day = d.getUTCDate();
  const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  const last = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  next.setUTCDate(Math.min(day, last));
  return next.toISOString().slice(0, 10);
}

export const newPledgeToken = () => crypto.randomBytes(12).toString('base64url');

/** Mark a contribution paid, invest it and notify guardian and giver. */
export function settleContribution({ db, partner, notifier }, x, paymentRef, date = today()) {
  db.prepare(`UPDATE contributions SET status='paid', payment_ref=?, paid_at=? WHERE id=?`).run(paymentRef, `${date} ${new Date().toISOString().slice(11, 19)}`, x.id);
  const child = db.prepare('SELECT * FROM children WHERE id=?').get(x.child_id);
  investContribution(db, partner, child, x, date);
  const guardian = db.prepare('SELECT email FROM users WHERE id=?').get(child.guardian_id);
  const monthly = x.pledge_id ? ' (מתנה חודשית)' : '';
  notifier.send({ to: guardian.email, subject: `🎁 ${x.giver_name} שלח/ה מתנה לעתיד של ${child.first_name}${monthly}`, body: `₪${x.amount / 100} הושקעו בחשבון. ${x.message || ''}` });
  if (x.giver_email) notifier.send({ to: x.giver_email, subject: `קבלה: מתנה לעתיד של ${child.first_name}`, body: `תודה! ₪${x.amount / 100} הושקעו עבור ${child.first_name}. אסמכתא ${paymentRef}.` });
  return child;
}

/** Charge one installment of an active monthly gift and schedule the next. */
export function chargePledge(ctx, pledge, date = today()) {
  const { db, payments } = ctx;
  return tx(db, () => {
    const { paymentRef } =
      pledge.method === 'card' ? payments.chargeToken({ token: pledge.card_token, amount: pledge.amount }) : payments.chargeMandate({ mandateRef: pledge.mandate_ref, amount: pledge.amount });
    const { lastInsertRowid } = db
      .prepare(`INSERT INTO contributions (child_id, giver_name, giver_email, amount, message, is_public, method, pledge_id, source) VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(pledge.child_id, pledge.giver_name, pledge.giver_email, pledge.amount, pledge.charges === 0 ? pledge.message : null, pledge.source === 'gift' ? 1 : 0, pledge.method, pledge.id, pledge.source || 'gift');
    settleContribution(ctx, db.prepare('SELECT * FROM contributions WHERE id=?').get(lastInsertRowid), paymentRef, date);
    db.prepare('UPDATE pledges SET charges=charges+1, next_date=? WHERE id=?').run(addMonth(pledge.next_date || date), pledge.id);
    return lastInsertRowid;
  });
}

/** Charge every active monthly gift that is due. Run daily by the scheduler. */
export function runDuePledges(ctx, date = today()) {
  const due = ctx.db.prepare(`SELECT * FROM pledges WHERE status='active' AND next_date <= ?`).all(date);
  let charged = 0;
  for (const p of due) {
    try {
      chargePledge(ctx, p, p.next_date);
      charged++;
    } catch (e) {
      console.error('pledge charge failed', p.id, e.message);
    }
  }
  return { due: due.length, charged };
}

export function pledgeView(p) {
  return {
    id: p.id, token: p.token, giverName: p.giver_name, amount: p.amount, method: p.method, status: p.status,
    nextDate: p.next_date, charges: p.charges, source: p.source || 'gift', institutionCode: p.institution_code, mandateRef: p.mandate_ref, createdAt: p.created_at,
  };
}

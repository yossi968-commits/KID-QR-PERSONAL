import { today } from './dates.js';
import { settleContribution } from './pledges.js';
import { ANNUAL_CEILING, depositedThisYear } from './fund.js';

/**
 * Employer and workers'-committee birth gifts. Instead of a school bag or headphones,
 * the organization deposits a gift straight into the newborn's QR. Employees report
 * the birth (or HR adds it); the report links to the child's QR by the parent's email
 * and birth date, or by the gift code the parent shares.
 */
export const OCCASIONS = ['birth', 'first_grade', 'bar_mitzvah', 'bat_mitzvah'];

export function employerView(e) {
  return {
    id: e.id, slug: e.slug, name: e.name, kind: e.kind, email: e.email, contactName: e.contact_name, logo: e.logo,
    giftAmount: e.gift_amount, giftMessage: e.gift_message, occasions: e.occasions.split(',').filter(Boolean),
  };
}

export function reportView(db, r) {
  const c = r.child_id ? db.prepare('SELECT first_name, gift_code, account_status FROM children WHERE id=?').get(r.child_id) : null;
  const x = r.contribution_id ? db.prepare('SELECT amount, status, paid_at FROM contributions WHERE id=?').get(r.contribution_id) : null;
  return {
    id: r.id, employeeName: r.employee_name, employeeEmail: r.employee_email, employeeNumber: r.employee_number, babyName: r.baby_name || c?.first_name || null,
    birthDate: r.birth_date, occasion: r.occasion, status: r.status, reportedBy: r.reported_by, createdAt: r.created_at, invitedAt: r.invited_at,
    child: c ? { firstName: c.first_name, giftCode: c.gift_code, fundOpen: c.account_status === 'active' } : null,
    gift: x ? { amount: x.amount, status: x.status, paidAt: x.paid_at } : null,
  };
}

const days = (a, b) => Math.abs(Date.parse(a) - Date.parse(b)) / 86400000;

/** Link open reports to a child: by gift code, or by guardian email and a birth date within 3 days. */
export function linkReports(db) {
  const open = db.prepare(`SELECT * FROM birth_reports WHERE child_id IS NULL`).all();
  let linked = 0;
  for (const r of open) {
    if (!r.employee_email) continue;
    const kids = db.prepare(`SELECT c.* FROM children c JOIN users u ON u.id=c.guardian_id WHERE u.email=?`).all(r.employee_email.toLowerCase());
    const k = kids.find((c) => days(c.birth_date, r.birth_date) <= 3);
    if (!k) continue;
    db.prepare(`UPDATE birth_reports SET child_id=?, status='linked' WHERE id=?`).run(k.id, r.id);
    linked++;
  }
  return linked;
}

export function linkByCode(db, report, code) {
  const c = db.prepare('SELECT id FROM children WHERE gift_code=?').get(String(code || '').trim().toLowerCase());
  if (!c) return false;
  db.prepare(`UPDATE birth_reports SET child_id=?, status='linked' WHERE id=?`).run(c.id, report.id);
  return true;
}

/**
 * Deposit the gift for each linked report. The organization pays by one bulk transfer
 * (invoiced monthly); each gift settles into the child's fund, or waits until it opens.
 */
export function sendGifts(ctx, employer, reportIds, { amount, message } = {}) {
  const { db } = ctx;
  const sum = amount || employer.gift_amount;
  const out = { sent: 0, skipped: [] };
  for (const id of reportIds) {
    const r = db.prepare('SELECT * FROM birth_reports WHERE id=? AND employer_id=?').get(Number(id), employer.id);
    if (!r || r.status !== 'linked') { out.skipped.push(Number(id)); continue; }
    if (depositedThisYear(db, r.child_id) + sum > ANNUAL_CEILING) { out.skipped.push(r.id); continue; }
    const { lastInsertRowid } = db
      .prepare(`INSERT INTO contributions (child_id, giver_name, giver_email, amount, message, is_public, method, source) VALUES (?,?,?,?,?,?,?,?)`)
      .run(r.child_id, employer.name, employer.email, sum, message || employer.gift_message, 1, 'employer_transfer', 'employer_gift');
    settleContribution(ctx, db.prepare('SELECT * FROM contributions WHERE id=?').get(lastInsertRowid), `EMP-${employer.id}-${r.id}`, today());
    db.prepare(`UPDATE birth_reports SET status='gifted', contribution_id=? WHERE id=?`).run(lastInsertRowid, r.id);
    out.sent++;
  }
  return out;
}

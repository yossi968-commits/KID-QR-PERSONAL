import { addYears, ageOn, today } from './dates.js';
import { holdings } from './portfolio.js';
import { GIFT_SOURCES } from './contribute.js';

/** What a deposit was: family gifts, a standing order, the child's own work, or army pay. */
function kindOf(source, pledgeId) {
  if (source === 'salary') return 'army';
  if (!GIFT_SOURCES.includes(source || 'gift')) return 'work';
  return pledgeId ? 'monthly' : 'gifts';
}

/**
 * The child's savings year by year since birth: money in by kind, money taken out (and for
 * which planned gift, against what was planned), and the value at the end of each year.
 * Also every dated cash flow, so the screen can replay the same money at other risk levels.
 */
export function journeyFor(db, partner, child) {
  const now = today();
  const ins = db.prepare(
    `SELECT t.date, t.amount, c.source, c.pledge_id FROM transactions t JOIN contributions c ON c.id = t.contribution_id
     WHERE t.child_id = ? AND t.type = 'buy' AND t.reason = 'gift' ORDER BY t.date`).all(child.id);
  const outs = db.prepare(
    `SELECT w.amount, substr(w.decided_at, 1, 10) AS date, w.purpose, x.title, x.icon, x.target_amount FROM withdrawals w LEFT JOIN wishes x ON x.id = w.wish_id
     WHERE w.child_id = ? AND w.status = 'paid' ORDER BY w.decided_at`).all(child.id);
  const valueOn = (d) => Math.round(holdings(db, child.id, d).reduce((s, h) => s + h.units * partner.navOn(h.track, d) * 100, 0));
  const ageNow = ageOn(child.birth_date, now);
  const years = [];
  for (let a = 0; a <= ageNow; a++) {
    const from = addYears(child.birth_date, a), to = addYears(child.birth_date, a + 1);
    const end = to > now ? now : to;
    const inn = { gifts: 0, monthly: 0, work: 0, army: 0 };
    for (const x of ins) if (x.date >= from && x.date < to) inn[kindOf(x.source, x.pledge_id)] += x.amount;
    const took = outs.filter((w) => w.date >= from && w.date < to)
      .map((w) => ({ amount: w.amount, title: w.title, icon: w.icon, planned: w.target_amount, purpose: w.purpose }));
    years.push({ age: a, from, to: end, partial: to > now, in: inn, out: took.reduce((s, w) => s + w.amount, 0), took, value: valueOn(end) });
  }
  const flows = [...ins.map((x) => ({ date: x.date, amount: x.amount })), ...outs.map((w) => ({ date: w.date, amount: -w.amount }))].sort((x, y) => (x.date < y.date ? -1 : 1));
  return { birthDate: child.birth_date, today: now, track: child.track, years, flows };
}

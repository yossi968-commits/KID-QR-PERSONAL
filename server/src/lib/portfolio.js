import { tx } from '../db.js';
import { today, addYears, ageOn } from './dates.js';

export const GIFT_MIN = 1800; // 18 ₪ (חי) in agorot
export const GIFT_MAX = 500000; // 5,000 ₪ per gift without extra giver verification (AML)
export const PAYOUT_AGE = 21;

/** Holdings per track from the transaction ledger, optionally up to a date. */
export function holdings(db, childId, upTo = null) {
  const rows = db
    .prepare(
      `SELECT track, SUM(CASE WHEN type='buy' THEN units ELSE -units END) AS units
       FROM transactions WHERE child_id = ? ${upTo ? 'AND date <= ?' : ''} GROUP BY track`
    )
    .all(...(upTo ? [childId, upTo] : [childId]));
  return rows.filter((r) => r.units > 1e-9);
}

/** Buy units for a paid contribution and mark it invested. */
export function investContribution(db, partner, child, contribution, date = today()) {
  return tx(db, () => {
    const order = partner.placeBuy({ accountId: child.partner_account_id, trackId: child.track, amount: contribution.amount, date });
    db.prepare(
      `INSERT INTO transactions (child_id, contribution_id, type, reason, track, amount, units, nav, partner_order_id, date)
       VALUES (?,?,?,?,?,?,?,?,?,?)`
    ).run(child.id, contribution.id, 'buy', 'gift', child.track, contribution.amount, order.units, order.nav, order.orderId, date);
    db.prepare(`UPDATE contributions SET status='invested' WHERE id=?`).run(contribution.id);
    return order;
  });
}

/** Move the whole portfolio to a new track (sell everything else, buy target). */
export function switchTrack(db, partner, child, newTrack, date = today()) {
  return tx(db, () => {
    let proceeds = 0;
    for (const h of holdings(db, child.id)) {
      if (h.track === newTrack) continue;
      const sell = partner.placeSell({ accountId: child.partner_account_id, trackId: h.track, units: h.units, date });
      proceeds += sell.amount;
      db.prepare(
        `INSERT INTO transactions (child_id, type, reason, track, amount, units, nav, partner_order_id, date) VALUES (?,?,?,?,?,?,?,?,?)`
      ).run(child.id, 'sell', 'switch', h.track, sell.amount, h.units, sell.nav, sell.orderId, date);
    }
    if (proceeds > 0) {
      const buy = partner.placeBuy({ accountId: child.partner_account_id, trackId: newTrack, amount: proceeds, date });
      db.prepare(
        `INSERT INTO transactions (child_id, type, reason, track, amount, units, nav, partner_order_id, date) VALUES (?,?,?,?,?,?,?,?,?)`
      ).run(child.id, 'buy', 'switch', newTrack, proceeds, buy.units, buy.nav, buy.orderId, date);
    }
    db.prepare('UPDATE children SET track=? WHERE id=?').run(newTrack, child.id);
    return { moved: proceeds };
  });
}

function valueAt(partner, hs, date) {
  return Math.round(hs.reduce((s, h) => s + h.units * partner.navOn(h.track, date) * 100, 0));
}

export function portfolioSummary(db, partner, child) {
  const now = today();
  const hs = holdings(db, child.id);
  const value = valueAt(partner, hs, now);
  const deposited =
    db.prepare(`SELECT COALESCE(SUM(amount),0) AS s FROM contributions WHERE child_id=? AND status='invested'`).get(child.id).s;
  const last12 =
    db
      .prepare(`SELECT COALESCE(SUM(amount),0) AS s FROM contributions WHERE child_id=? AND status='invested' AND date(paid_at) > date('now','-365 days')`)
      .get(child.id).s;
  const earned =
    db.prepare(`SELECT COALESCE(SUM(amount),0) AS s FROM contributions WHERE child_id=? AND status='invested' AND COALESCE(source,'gift') NOT IN ('gift','event_gifts')`).get(child.id).s;
  const held =
    db.prepare(`SELECT COALESCE(SUM(amount),0) AS s FROM contributions WHERE child_id=? AND status='paid'`).get(child.id).s;
  const giverCount = db.prepare(`SELECT COUNT(DISTINCT lower(giver_name)) AS c FROM contributions WHERE child_id=? AND status='invested'`).get(child.id).c;

  // Weekly history of value vs. cumulative deposits.
  const ledger = db.prepare(`SELECT type, reason, track, amount, units, date FROM transactions WHERE child_id=? ORDER BY date, id`).all(child.id);
  const history = [];
  if (ledger.length) {
    const units = new Map();
    let dep = 0, li = 0;
    const start = Date.parse(ledger[0].date + 'T00:00:00Z');
    const end = Date.parse(now + 'T00:00:00Z');
    const span = (end - start) / 86400000;
    const step = Math.max(7, Math.ceil(span / 160)) * 86400000;
    for (let t = start; ; t = Math.min(t + step, end)) {
      const d = new Date(t).toISOString().slice(0, 10);
      while (li < ledger.length && ledger[li].date <= d) {
        const e = ledger[li++];
        units.set(e.track, (units.get(e.track) || 0) + (e.type === 'buy' ? e.units : -e.units));
        if (e.reason === 'gift') dep += e.amount;
      }
      const v = [...units].reduce((s, [tr, u]) => s + u * partner.navOn(tr, d) * 100, 0);
      history.push({ date: d, value: Math.round(v), deposited: dep });
      if (t >= end) break;
    }
  }

  // Projection to payout age, three scenarios around the track's expected return (net of fees).
  const track = partner.listTracks().find((t) => t.id === child.track);
  const payoutDate = addYears(child.birth_date, PAYOUT_AGE);
  const yearsLeft = Math.max(0, PAYOUT_AGE - ageOn(child.birth_date));
  const annual = last12 || 250000;
  const scenarios = { low: -0.02, mid: 0, high: 0.02 };
  const projection = [];
  const finals = {};
  for (const [k, delta] of Object.entries(scenarios)) {
    const r = track.expectedReturn - track.mgmtFee + delta;
    let v = value;
    for (let y = 0; y <= yearsLeft; y++) {
      if (y > 0) v = v * (1 + r) + annual;
      projection[y] = projection[y] || { age: ageOn(child.birth_date) + y };
      projection[y][k] = Math.round(v);
    }
    finals[k] = Math.round(v);
  }

  return {
    value,
    deposited,
    gain: value - deposited,
    gainPct: deposited ? (value - deposited) / deposited : 0,
    giverCount,
    earned,
    held,
    holdings: hs.map((h) => ({ ...h, value: Math.round(h.units * partner.navOn(h.track, now) * 100) })),
    history,
    projection: { payoutDate, payoutAge: PAYOUT_AGE, annualAssumed: annual, points: projection, finals },
  };
}

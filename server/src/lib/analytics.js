import { today, ageOn, addYears } from './dates.js';
import { PROVIDERS } from './fund.js';

/** Age bands for the savers breakdown; the last band is the young adults who stayed on. */
export const AGE_BANDS = [
  { id: '0-5', from: 0, to: 5 }, { id: '6-12', from: 6, to: 12 }, { id: '13-17', from: 13, to: 17 },
  { id: '18-21', from: 18, to: 21 }, { id: '22+', from: 22, to: 200 },
];
export const PROJECTION_YEARS = [1, 5, 10];

/**
 * Admin analytics: who saves with the app and how much is invested, now and ahead.
 *   savers   every child with a QR (graduates included: the QR keeps taking gifts)
 *   joined   the day the QR was created
 *   aum      market value of the units held at the investment houses today
 * Projections compound each saver's value at their track's expected return net of fees,
 * with the money that came in over the last 12 months coming in again every year.
 * The second line adds new savers at the pace of the last 12 months, each bringing
 * the average yearly inflow. These are estimates, not forecasts.
 */
export function analytics({ db, partner }, on = today()) {
  const kids = db.prepare('SELECT id, birth_date, provider, track, account_status, date(created_at) AS joined FROM children').all();
  const yearAgo = addYears(on, -1);
  const y = on.slice(0, 4), ly = String(+y - 1);
  const sameDayLastYear = ly + on.slice(4);

  // Market value per child and track, from the ledger, in one pass.
  const units = db.prepare(`SELECT child_id, track, SUM(CASE WHEN type='buy' THEN units ELSE -units END) AS u FROM transactions GROUP BY child_id, track`).all();
  const nav = new Map(partner.listTracks().map((t) => [t.id, partner.navOn(t.id, on)]));
  const valueOf = new Map();
  for (const r of units) if (r.u > 1e-9) valueOf.set(r.child_id, (valueOf.get(r.child_id) || 0) + r.u * nav.get(r.track) * 100);
  const inflowOf = new Map(db.prepare(`SELECT child_id, SUM(amount) AS s FROM contributions WHERE status='invested' AND date(paid_at) > date(?, '-365 days') GROUP BY child_id`).all(on).map((r) => [r.child_id, r.s]));
  const held = db.prepare(`SELECT COALESCE(SUM(amount),0) AS s FROM contributions WHERE status='paid'`).get().s;

  const ages = AGE_BANDS.map((b) => ({ band: b.id, savers: 0, aum: 0 }));
  const byProvider = new Map(), byTrack = new Map();
  const add = (m, k, v) => { const e = m.get(k) || { savers: 0, aum: 0 }; e.savers++; e.aum += v; m.set(k, e); };
  let aum = 0;
  for (const k of kids) {
    const v = valueOf.get(k.id) || 0;
    aum += v;
    const a = ageOn(k.birth_date, on);
    const band = ages[AGE_BANDS.findIndex((b) => a >= b.from && a <= b.to)];
    if (band) { band.savers++; band.aum += v; }
    add(byProvider, k.provider, v);
    add(byTrack, k.track, v);
  }
  const share = (m) => [...m].map(([id, e]) => ({ id, savers: e.savers, aum: Math.round(e.aum), share: aum ? e.aum / aum : 0 })).sort((p, q) => q.aum - p.aum);

  // Joins: this year so far against the same days last year, and the base a year ago.
  const joinedThisYear = kids.filter((k) => k.joined >= y + '-01-01' && k.joined <= on).length;
  const joinedLastYearToDate = kids.filter((k) => k.joined >= ly + '-01-01' && k.joined <= sameDayLastYear).length;
  const joinedLastYear = kids.filter((k) => k.joined.startsWith(ly)).length;
  const saversYearAgo = kids.filter((k) => k.joined <= yearAgo).length;
  const monthly = Array.from({ length: 12 }, (_, i) => {
    const m = String(i + 1).padStart(2, '0');
    return { month: i + 1, thisYear: (y + '-' + m) <= on.slice(0, 7) ? kids.filter((k) => k.joined.startsWith(`${y}-${m}`)).length : null, lastYear: kids.filter((k) => k.joined.startsWith(`${ly}-${m}`)).length };
  });

  // Projections.
  const ret = new Map(partner.listTracks().map((t) => [t.id, t.expectedReturn - t.mgmtFee]));
  const inflowTotal = kids.reduce((s, k) => s + (inflowOf.get(k.id) || 0), 0);
  const avgInflow = kids.length ? inflowTotal / kids.length : 0;
  const avgReturn = aum ? kids.reduce((s, k) => s + (valueOf.get(k.id) || 0) * ret.get(k.track), 0) / aum : 0.05;
  const newPerYear = kids.filter((k) => k.joined > yearAgo && k.joined <= on).length;
  const horizon = Math.max(...PROJECTION_YEARS);
  const existing = Array(horizon + 1).fill(0);
  for (const k of kids) {
    let v = valueOf.get(k.id) || 0;
    const r = ret.get(k.track) ?? avgReturn, inflow = inflowOf.get(k.id) || 0;
    existing[0] += v;
    for (let t = 1; t <= horizon; t++) { v = v * (1 + r) + inflow; existing[t] += v; }
  }
  const withNew = existing.slice();
  for (let cohort = 1; cohort <= horizon; cohort++) {
    let v = 0;
    for (let t = cohort; t <= horizon; t++) { v = v * (1 + avgReturn) + newPerYear * avgInflow; withNew[t] += v; }
  }
  const points = existing.map((v, t) => ({ year: t, existing: Math.round(v), withNew: Math.round(withNew[t]) }));

  return {
    asOf: on,
    savers: kids.length,
    activeFunds: kids.filter((k) => k.account_status === 'active').length,
    saversYearAgo,
    saversGrowth: saversYearAgo ? kids.filter((k) => k.joined <= on).length / saversYearAgo - 1 : null,
    joinedThisYear, joinedLastYearToDate, joinedLastYear,
    joinsGrowth: joinedLastYearToDate ? joinedThisYear / joinedLastYearToDate - 1 : null,
    monthly,
    ages: ages.map((b) => ({ ...b, aum: Math.round(b.aum) })),
    byProvider: share(byProvider).map((r) => ({ ...r, name: PROVIDERS.find((p) => p.id === r.id)?.name || r.id })),
    byTrack: share(byTrack),
    aum: Math.round(aum),
    held,
    yearlyInflow: inflowTotal,
    projection: {
      points,
      at: PROJECTION_YEARS.map((t) => ({ years: t, date: addYears(on, t), existing: points[t].existing, withNew: points[t].withNew })),
      assumptions: { avgReturn, avgInflowPerSaver: Math.round(avgInflow), newSaversPerYear: newPerYear },
    },
  };
}

/** Communities, first-gift partners and expecting parents, for the admin outlook. */
export function growthChannels({ db }, on = today()) {
  const communities = db.prepare(`SELECT u.community AS id, COUNT(c.id) AS savers FROM children c JOIN users u ON u.id=c.guardian_id GROUP BY u.community ORDER BY 2 DESC`).all();
  const families = db.prepare(`SELECT COUNT(*) AS families, SUM(n>1) AS multi, SUM(n) AS kids FROM (SELECT guardian_id, COUNT(*) AS n FROM children GROUP BY guardian_id)`).get();
  const preg = db.prepare(`SELECT COUNT(*) AS total, SUM(child_id IS NOT NULL) AS converted, SUM(child_id IS NULL AND cancelled_at IS NULL AND due_date >= ?) AS upcoming FROM pregnancies`).get(on);
  return {
    communities,
    siblings: { families: families.families || 0, withSiblings: families.multi || 0, kidsPerFamily: families.families ? families.kids / families.families : 0 },
    expecting: { total: preg.total || 0, converted: preg.converted || 0, upcoming: preg.upcoming || 0 },
  };
}

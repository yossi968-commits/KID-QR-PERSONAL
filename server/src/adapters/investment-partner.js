/**
 * InvestmentPartner adapter.
 *
 * The app is NOT the regulated investment manager: money and units are held by a
 * licensed Israeli investment house. Every partner integration implements this
 * interface; the app only talks to it.
 *
 * interface InvestmentPartner {
 *   name: string
 *   listTracks(): Track[]
 *   openAccount({ guardian, child }): { accountId }
 *   navOn(trackId, date): number                     // price per unit on/before date
 *   navHistory(trackId, from, to, stepDays?): {date, nav}[]
 *   placeBuy({ accountId, trackId, amount, date }): { orderId, units, nav }
 *   placeSell({ accountId, trackId, units, date }): { orderId, amount, nav }
 * }
 *
 * SandboxInvestmentPartner below simulates a partner with deterministic,
 * seeded daily prices so the dashboard has realistic history. It is a mock.
 */
import crypto from 'node:crypto';

// `core` tracks are the three offered when the fund is opened (solid, conservative,
// equities); the others show up as "more tracks" and the list can grow.
export const TRACKS = [
  { id: 'conservative', core: true, risk: 2, expectedReturn: 0.04, annualVol: 0.05, mgmtFee: 0.006, equityShare: 0.25 },
  { id: 'balanced', core: false, risk: 3, expectedReturn: 0.055, annualVol: 0.09, mgmtFee: 0.006, equityShare: 0.5 },
  { id: 'equity', core: true, risk: 5, expectedReturn: 0.075, annualVol: 0.16, mgmtFee: 0.006, equityShare: 1 },
  { id: 'sp500', core: false, risk: 5, expectedReturn: 0.08, annualVol: 0.17, mgmtFee: 0.005, equityShare: 1 },
  { id: 'solid', core: true, risk: 1, expectedReturn: 0.03, annualVol: 0.02, mgmtFee: 0.006, equityShare: 0 },
  // Values-based tracks some houses run: under rabbinical supervision (היתר עסקה), and Sharia-compliant.
  { id: 'halacha', values: true, risk: 3, expectedReturn: 0.055, annualVol: 0.1, mgmtFee: 0.007, equityShare: 0.5 },
  { id: 'sharia', values: true, risk: 4, expectedReturn: 0.065, annualVol: 0.14, mgmtFee: 0.007, equityShare: 0.8 },
];

const START = Date.UTC(2004, 0, 1);
const DAY = 86400000;

function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rand) {
  const u = Math.max(rand(), 1e-12), v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export class SandboxInvestmentPartner {
  constructor({ seed = 21 } = {}) {
    this.name = 'Sandbox Investment House (mock)';
    this.series = new Map();
    const days = Math.ceil((Date.now() + 400 * DAY - START) / DAY);
    TRACKS.forEach((t, i) => {
      const rand = mulberry32(seed * 100 + i);
      const navs = new Float64Array(days);
      const mu = Math.log(1 + t.expectedReturn) / 365;
      const sigma = t.annualVol / Math.sqrt(365);
      let nav = 100;
      for (let d = 0; d < days; d++) {
        navs[d] = nav;
        nav *= Math.exp(mu - (sigma * sigma) / 2 + sigma * gaussian(rand));
      }
      this.series.set(t.id, navs);
    });
  }

  listTracks() {
    return TRACKS;
  }

  openAccount({ child }) {
    const house = (child.provider || 'sbx').slice(0, 3).toUpperCase();
    return { accountId: `${house}-GML-` + crypto.randomBytes(4).toString('hex').toUpperCase() + '-' + child.id };
  }

  #index(date) {
    const ms = typeof date === 'string' ? Date.parse(date + 'T00:00:00Z') : date;
    const i = Math.floor((ms - START) / DAY);
    return Math.max(0, i);
  }

  navOn(trackId, date) {
    const s = this.series.get(trackId);
    if (!s) throw new Error('unknown_track');
    return s[Math.min(this.#index(date), s.length - 1)];
  }

  navHistory(trackId, from, to, stepDays = 7) {
    const out = [];
    for (let t = Date.parse(from + 'T00:00:00Z'); t <= Date.parse(to + 'T00:00:00Z'); t += stepDays * DAY) {
      const date = new Date(t).toISOString().slice(0, 10);
      out.push({ date, nav: this.navOn(trackId, date) });
    }
    return out;
  }

  placeBuy({ trackId, amount, date }) {
    const nav = this.navOn(trackId, date);
    return { orderId: 'BUY-' + crypto.randomBytes(6).toString('hex'), units: amount / 100 / nav, nav };
  }

  placeSell({ trackId, units, date }) {
    const nav = this.navOn(trackId, date);
    return { orderId: 'SELL-' + crypto.randomBytes(6).toString('hex'), amount: Math.round(units * nav * 100), nav };
  }
}

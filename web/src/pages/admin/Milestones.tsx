import { useI18n } from '../../i18n';
import { Kpis } from '../../components/ui';

/**
 * What this console could look like at points after launch, from the business plan's
 * realistic scenario ("מודל עסקי: מתנה שצומחת") and the partner-meeting deck (90-day pilot in 100
 * birthdays, ~₪5M seed). Projections, not data. Year-5 costs are an estimate; children per family is taken as about 1.35.
 */
export type MilestoneId = 'm6' | 'm12' | 'm24' | 'm36' | 'm60';
type M = {
  id: MilestoneId; families: number; children: number; share?: string; aum: number; birthdays: number;
  revenue: { fees: number; premium: number; feeShare: number; b2b: number }; costs: number; costsEstimated?: boolean; revenueEstimated?: boolean;
  team: number; employers: number; partnerFees: number;
  /** Cumulative result since launch; year 4 is not in the plan, so the year-5 figure is an estimate. */
  cum: number; cumEstimated?: boolean;
  /** "Israel + abroad" scenario, all my estimates: a leading strategic partner opens a pilot country after year 1. */
  abroad: { countries: number; children: number; aum: number; rev: number; costs: number; cum: number };
};
export const MILESTONES: M[] = [
  { id: 'm6', families: 1000, children: 1350, aum: 1.5e6, birthdays: 350, revenue: { fees: 12e3, premium: 10e3, feeShare: 2e3, b2b: 0 }, costs: 0.5e6, team: 3, employers: 0, partnerFees: 4e3, cum: -0.476e6, abroad: { countries: 0, children: 0, aum: 0, rev: 0, costs: 0, cum: 0 } },
  { id: 'm12', families: 3000, children: 4000, aum: 6.6e6, birthdays: 1100, revenue: { fees: 60e3, premium: 30e3, feeShare: 10e3, b2b: 0 }, costs: 1.0e6, team: 3, employers: 0, partnerFees: 25e3, cum: -0.9e6, abroad: { countries: 0, children: 0, aum: 0, rev: 0, costs: 0.5e6, cum: -0.5e6 } },
  { id: 'm24', families: 15000, children: 20000, aum: 52e6, birthdays: 6000, revenue: { fees: 350e3, premium: 150e3, feeShare: 100e3, b2b: 200e3 }, costs: 1.8e6, team: 6, employers: 25, partnerFees: 0.2e6, cum: -1.9e6, abroad: { countries: 1, children: 30000, aum: 15e6, rev: 0.3e6, costs: 2.5e6, cum: -2.7e6 } },
  { id: 'm36', families: 40000, children: 54000, aum: 180e6, birthdays: 16000, revenue: { fees: 1.2e6, premium: 0.4e6, feeShare: 0.4e6, b2b: 0.6e6 }, costs: 2.6e6, team: 10, employers: 80, partnerFees: 0.8e6, cum: -1.9e6, abroad: { countries: 2, children: 150000, aum: 60e6, rev: 1.5e6, costs: 4.5e6, cum: -5.7e6 } },
  { id: 'm60', families: 190000, children: 256000, share: '8%', aum: 1.5e9, birthdays: 80000, revenue: { fees: 9e6, premium: 2e6, feeShare: 3.5e6, b2b: 0.5e6 }, costs: 9e6, costsEstimated: true, team: 35, employers: 600, partnerFees: 6.5e6, cum: 6.1e6, cumEstimated: true, abroad: { countries: 3, children: 800000, aum: 0.4e9, rev: 8e6, costs: 6e6, cum: -5.2e6 } },
];

/** Seed round in the partner deck; going abroad also needs a Series A of about ₪20M in year 2 (my estimate). */
const SEED = 5e6, SERIES_A = 20e6;
export type Scope = 'il' | 'global';
/** Break-even facts per scope. Israel follows the plan (year 4 interpolated); global is my estimate. */
const BE = {
  il: { maxBurnYear: 2, maxBurn: -1.9e6, point: 3, profit: 4, payback: 5 },
  global: { maxBurnYear: 3, maxBurn: -7.6e6, point: 4, profit: 4, payback: 7 },
};

export function Milestone({ id, scope = 'il' }: { id: MilestoneId; scope?: Scope }) {
  const { t, locale } = useI18n();
  const m = MILESTONES.find((x) => x.id === id)!;
  const n = (v: number) => v.toLocaleString(locale === 'he' ? 'he-IL' : 'en-US');
  const big = (v: number) => {
    const a = Math.abs(v), sign = v < 0 ? '-' : '';
    const r = (x: number) => (Math.round(x * 10) / 10).toLocaleString('en-US');
    if (a >= 1e9) return sign + t('ms.bil', { n: r(a / 1e9) });
    if (a >= 1e6) return sign + t('ms.mil', { n: r(a / 1e6) });
    return sign + t('ms.k', { n: r(a / 1e3) });
  };
  const g = scope === 'global';
  const ilRev = (x: M) => x.revenue.fees + x.revenue.premium + x.revenue.feeShare + x.revenue.b2b;
  const tot = (x: M) => ({
    children: x.children + (g ? x.abroad.children : 0), aum: x.aum + (g ? x.abroad.aum : 0),
    rev: ilRev(x) + (g ? x.abroad.rev : 0), costs: x.costs + (g ? x.abroad.costs : 0), cum: x.cum + (g ? x.abroad.cum : 0),
    est: !!x.costsEstimated || (g && x.abroad.costs > 0),
  });
  const v = tot(m), be = BE[scope];
  const raised = SEED + (g && id !== 'm6' && id !== 'm12' ? SERIES_A : 0);
  const rev = v.rev;
  const result = rev - v.costs;
  const period = t(id === 'm6' ? 'ms.periodHalf' : 'ms.periodYear');
  return (
    <div className="stack">
      <div className="banner small">📈 {t('ms.banner')}</div>
      <p style={{ margin: 0 }}><b>{t(`ms.${id}.title` as any)}</b> · {t(`ms.${id}.story` as any)}</p>
      {g && <p className="small" style={{ margin: 0 }}>🌍 {t(`ms.g.${id}` as any)}</p>}
      <div className="ms-kpis"><Kpis items={[
        { label: t('ms.children'), value: n(v.children), sub: g && m.abroad.children ? t('ms.g.kidsSub', { n: n(m.abroad.children), c: m.abroad.countries }) : m.share ? t('ms.ofKids', { p: m.share }) : t('ms.families', { n: n(m.families) }) },
        { label: t('ms.aum'), value: big(v.aum), sub: g && m.abroad.aum ? t('ms.g.aumSub', { a: big(m.abroad.aum) }) : t('ms.atPartner') },
        { label: t('ms.revenue'), value: big(rev), sub: m.revenueEstimated ? t('ms.est', { p: period }) : period },
        { label: t('ms.result'), value: Math.abs(result) < rev * 0.05 + 1 ? t('ms.breakeven') : big(result), tone: result >= 0 ? 'pos' : 'neg', sub: (v.est ? t('ms.costsEst', { c: big(v.costs) }) : t('ms.costs', { c: big(v.costs) })) },
        { label: t('ms.birthdays'), value: n(m.birthdays), sub: period },
        { label: t('ms.team'), value: n(m.team), sub: m.employers ? t('ms.employers', { n: n(m.employers) }) : t('ms.noB2b') },
      ]} /></div>
      <div className="grid grid-2">
        <div className="card">
          <div className="card-head"><h3>{t('ms.revBreak')}</h3><span className="small muted">{period}</span></div>
          <table className="table ms-small"><tbody>
            {(['fees', 'premium', 'feeShare', 'b2b'] as const).map((k) => <tr key={k}><td>{t(`ms.rev.${k}` as any)}</td><td className="num">{m.revenue[k] ? big(m.revenue[k]) : '—'}</td></tr>)}
            {g && <tr><td>{t('ms.g.rev')}</td><td className="num">{m.abroad.rev ? big(m.abroad.rev) + '*' : '—'}</td></tr>}
            <tr><td><b>{t('ms.total')}</b></td><td className="num"><b>{big(rev)}</b></td></tr>
            <tr><td className="muted">{t('ms.partnerFees')}</td><td className="num muted">{big(m.partnerFees)}</td></tr>
          </tbody></table>
        </div>
        <div className="card">
          <div className="card-head"><h3>{t('ms.kpiTitle')}</h3></div>
          <table className="table ms-small"><tbody>
            <tr><td>{t('ms.kpi.deposit')}</td><td className="num">30%+</td></tr>
            <tr><td>{t('ms.kpi.newFam')}</td><td className="num">1+</td></tr>
            <tr><td>{t('ms.kpi.avg')}</td><td className="num">₪80</td></tr>
            <tr><td>{t('ms.kpi.perChild')}</td><td className="num">₪2,200</td></tr>
            <tr><td>{t('ms.kpi.ret')}</td><td className="num">6%</td></tr>
          </tbody></table>
        </div>
      </div>
      <div className="card">
        <div className="card-head"><h3>{t('ms.be.title')}</h3></div>
        <table className="table ms-small"><tbody>
          <tr><td>{t('ms.be.cum')}</td><td className="num"><b className={v.cum >= 0 ? 'pos' : 'neg'}>{big(v.cum)}{m.cumEstimated || (g && m.abroad.cum) ? '*' : ''}</b></td></tr>
          <tr><td>{t('ms.be.raised')}</td><td className="num">{big(raised)}{raised > SEED ? '*' : ''}</td></tr>
          <tr><td>{t('ms.be.left')}</td><td className="num">{big(raised + v.cum)}</td></tr>
          <tr><td>{t('ms.be.maxBurn')}</td><td className="num">{big(be.maxBurn)}{g ? '*' : ''} · {t('ms.be.endY', { y: be.maxBurnYear })}</td></tr>
          <tr><td>{t('ms.be.point')}</td><td className="num">{t('ms.be.year', { y: be.point })}{g ? '*' : ''}</td></tr>
          <tr><td>{t('ms.be.profit')}</td><td className="num">{t(g ? 'ms.be.profitG' : 'ms.be.profitV')}*</td></tr>
          <tr><td>{t('ms.be.payback')}</td><td className="num">{t(g ? 'ms.be.paybackG' : 'ms.be.paybackV')}*</td></tr>
        </tbody></table>
        <p className="tiny muted" style={{ margin: '8px 0 0' }}>{t(g ? 'ms.g.note' : 'ms.be.note')}</p>
      </div>
      <div className="card">
        <div className="card-head"><h3>{t('ms.path')}</h3></div>
        <div className="table-wrap"><table className="table">
          <thead><tr><th>{t('ms.col.when')}</th><th className="num">{t('ms.children')}</th><th className="num">{t('ms.aum')}</th><th className="num">{t('ms.revenue')}</th><th className="num">{t('ms.result')}</th><th className="num">{t('ms.be.cumCol')}</th></tr></thead>
          <tbody>{MILESTONES.map((x) => {
            const y = tot(x), star = (b: boolean) => (b ? '*' : '');
            return <tr key={x.id} style={x.id === id ? { background: 'var(--brand-soft)', fontWeight: 600 } : undefined}><td>{t(`ms.${x.id}` as any)}</td><td className="num">{n(y.children)}</td><td className="num">{big(y.aum)}</td><td className="num">{big(y.rev)}{star(!!x.revenueEstimated || (g && x.abroad.rev > 0))}</td><td className="num">{big(y.rev - y.costs)}{star(y.est)}</td><td className="num">{big(y.cum)}{star(!!x.cumEstimated || (g && x.abroad.cum !== 0))}</td></tr>;
          })}</tbody>
        </table></div>
        <p className="tiny muted" style={{ margin: '8px 0 0' }}>{t('ms.foot')}{g ? ' ' + t('ms.g.foot') : ''}</p>
      </div>
    </div>
  );
}

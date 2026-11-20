import { useI18n } from '../../i18n';
import { Kpis } from '../../components/ui';

/**
 * What this console could look like at points after launch, from the business plan's
 * realistic scenario, draft 2.0 (October 2026): 90-day pilot in 100
 * birthdays, ~₪9M raise. Projections, not data. Year-5 costs are an estimate; children per family is taken as about 1.35.
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
  { id: 'm6', families: 1650, children: 4000, aum: 1.5e6, birthdays: 800, revenue: { fees: 2e4, premium: 2e3, feeShare: 1e3, b2b: 0 }, costs: 1.4e6, team: 3, employers: 0, partnerFees: 1e4, cum: -1.4e6, abroad: { countries: 0, children: 0, aum: 0, rev: 0, costs: 0, cum: 0 } },
  { id: 'm12', families: 6700, children: 16200, aum: 10.7e6, birthdays: 8100, revenue: { fees: 15e4, premium: 1e4, feeShare: 1e4, b2b: 0 }, costs: 2.58e6, team: 5, employers: 10, partnerFees: 7e4, cum: -3.22e6, abroad: { countries: 0, children: 0, aum: 0, rev: 0, costs: 4e5, cum: -4e5 } },
  { id: 'm24', families: 29400, children: 71400, share: '2%', aum: 107e6, birthdays: 43800, revenue: { fees: 131e4, premium: 9e4, feeShare: 9e4, b2b: 0 }, costs: 4.76e6, team: 7, employers: 60, partnerFees: 7e5, cum: -6.48e6, abroad: { countries: 1, children: 5e3, aum: 6e6, rev: 4e4, costs: 4e5, cum: -7.6e5 } },
  { id: 'm36', families: 71600, children: 174e3, share: '5%', aum: 377e6, birthdays: 122700, revenue: { fees: 368e4, premium: 5e5, feeShare: 36e4, b2b: 0 }, costs: 6.17e6, team: 9, employers: 150, partnerFees: 2.32e6, cum: -8.11e6, abroad: { countries: 2, children: 4e4, aum: 55e6, rev: 32e4, costs: 5e5, cum: -9.4e5 } },
  { id: 'm60', families: 230200, children: 559300, share: '17%', aum: 1935e6, birthdays: 449300, revenue: { fees: 1348e4, premium: 183e4, feeShare: 216e4, b2b: 0 }, costs: 9.2e6, costsEstimated: true, team: 14, employers: 400, partnerFees: 10.97e6, cum: 2.2e6, cumEstimated: true, abroad: { countries: 3, children: 3e5, aum: 716e6, rev: 32e5, costs: 7e5, cum: 2.19e6 } },
];

/** Draft 2.0: about ₪9M raised for Israel; abroad adds about ₪1M (the global partner funds its own launch). */
const SEED = 9e6, SERIES_A = 1e6;
export type Scope = 'il' | 'global';
/** Break-even facts per scope. Israel follows the plan (year 4 interpolated); global is my estimate. */
const BE = {
  il: { maxBurnYear: 3, maxBurn: -8.11e6, point: 4, profit: 4, payback: 5 },
  global: { maxBurnYear: 3, maxBurn: -9.05e6, point: 4, profit: 4, payback: 5 },
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
            <tr><td>{t('ms.kpi.newFam')}</td><td className="num">0.25</td></tr>
            <tr><td>{t('ms.kpi.avg')}</td><td className="num">₪220</td></tr>
            <tr><td>{t('ms.kpi.perChild')}</td><td className="num">₪2,200</td></tr>
            <tr><td>{t('ms.kpi.ret')}</td><td className="num">6.5%</td></tr>
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

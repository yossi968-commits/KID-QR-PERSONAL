import { useI18n } from '../../i18n';
import { Kpis } from '../../components/ui';

/**
 * What this console could look like at points after launch, from the business plan's
 * realistic scenario ("מודל עסקי: מתנה שצומחת"). Projections, not data. Year-5 costs are not
 * in the plan and are an estimate; children per family is taken as about 1.35.
 */
export type MilestoneId = 'm6' | 'm12' | 'm24' | 'm60';
type M = {
  id: MilestoneId; families: number; children: number; share?: string; aum: number; birthdays: number;
  revenue: { fees: number; premium: number; feeShare: number; b2b: number }; costs: number; costsEstimated?: boolean;
  team: number; employers: number; partnerFees: number;
};
export const MILESTONES: M[] = [
  { id: 'm6', families: 1000, children: 1350, aum: 1.5e6, birthdays: 350, revenue: { fees: 12e3, premium: 10e3, feeShare: 2e3, b2b: 0 }, costs: 0.5e6, team: 3, employers: 0, partnerFees: 4e3 },
  { id: 'm12', families: 3000, children: 4000, aum: 6.6e6, birthdays: 1100, revenue: { fees: 60e3, premium: 30e3, feeShare: 10e3, b2b: 0 }, costs: 1.0e6, team: 3, employers: 0, partnerFees: 25e3 },
  { id: 'm24', families: 15000, children: 20000, aum: 52e6, birthdays: 6000, revenue: { fees: 350e3, premium: 150e3, feeShare: 100e3, b2b: 200e3 }, costs: 1.8e6, team: 6, employers: 25, partnerFees: 0.2e6 },
  { id: 'm60', families: 190000, children: 256000, share: '8%', aum: 1.5e9, birthdays: 80000, revenue: { fees: 9e6, premium: 2e6, feeShare: 3.5e6, b2b: 0.5e6 }, costs: 9e6, costsEstimated: true, team: 35, employers: 600, partnerFees: 6.5e6 },
];

export function Milestone({ id }: { id: MilestoneId }) {
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
  const rev = m.revenue.fees + m.revenue.premium + m.revenue.feeShare + m.revenue.b2b;
  const result = rev - m.costs;
  const period = t(id === 'm6' ? 'ms.periodHalf' : 'ms.periodYear');
  return (
    <div className="stack">
      <div className="banner small">📈 {t('ms.banner')}</div>
      <p style={{ margin: 0 }}><b>{t(`ms.${id}.title` as any)}</b> · {t(`ms.${id}.story` as any)}</p>
      <div className="ms-kpis"><Kpis items={[
        { label: t('ms.children'), value: n(m.children), sub: m.share ? t('ms.ofKids', { p: m.share }) : t('ms.families', { n: n(m.families) }) },
        { label: t('ms.aum'), value: big(m.aum), sub: t('ms.atPartner') },
        { label: t('ms.revenue'), value: big(rev), sub: period },
        { label: t('ms.result'), value: Math.abs(result) < rev * 0.05 + 1 ? t('ms.breakeven') : big(result), tone: result >= 0 ? 'pos' : 'neg', sub: (m.costsEstimated ? t('ms.costsEst', { c: big(m.costs) }) : t('ms.costs', { c: big(m.costs) })) },
        { label: t('ms.birthdays'), value: n(m.birthdays), sub: period },
        { label: t('ms.team'), value: n(m.team), sub: m.employers ? t('ms.employers', { n: n(m.employers) }) : t('ms.noB2b') },
      ]} /></div>
      <div className="grid grid-2">
        <div className="card">
          <div className="card-head"><h3>{t('ms.revBreak')}</h3><span className="small muted">{period}</span></div>
          <table className="table"><tbody>
            {(['fees', 'premium', 'feeShare', 'b2b'] as const).map((k) => <tr key={k}><td>{t(`ms.rev.${k}` as any)}</td><td className="num">{m.revenue[k] ? big(m.revenue[k]) : '—'}</td></tr>)}
            <tr><td><b>{t('ms.total')}</b></td><td className="num"><b>{big(rev)}</b></td></tr>
            <tr><td className="muted">{t('ms.partnerFees')}</td><td className="num muted">{big(m.partnerFees)}</td></tr>
          </tbody></table>
        </div>
        <div className="card">
          <div className="card-head"><h3>{t('ms.kpiTitle')}</h3></div>
          <table className="table"><tbody>
            <tr><td>{t('ms.kpi.deposit')}</td><td className="num">30%+</td></tr>
            <tr><td>{t('ms.kpi.newFam')}</td><td className="num">1+</td></tr>
            <tr><td>{t('ms.kpi.avg')}</td><td className="num">₪80</td></tr>
            <tr><td>{t('ms.kpi.perChild')}</td><td className="num">₪2,200</td></tr>
          </tbody></table>
        </div>
      </div>
      <div className="card">
        <div className="card-head"><h3>{t('ms.path')}</h3></div>
        <div className="table-wrap"><table className="table">
          <thead><tr><th>{t('ms.col.when')}</th><th className="num">{t('ms.children')}</th><th className="num">{t('ms.aum')}</th><th className="num">{t('ms.revenue')}</th><th className="num">{t('ms.result')}</th></tr></thead>
          <tbody>{MILESTONES.map((x) => {
            const r = x.revenue.fees + x.revenue.premium + x.revenue.feeShare + x.revenue.b2b;
            return <tr key={x.id} style={x.id === id ? { background: 'var(--brand-soft)', fontWeight: 600 } : undefined}><td>{t(`ms.${x.id}` as any)}</td><td className="num">{n(x.children)}</td><td className="num">{big(x.aum)}</td><td className="num">{big(r)}</td><td className="num">{big(r - x.costs)}{x.costsEstimated ? '*' : ''}</td></tr>;
          })}</tbody>
        </table></div>
        <p className="tiny muted" style={{ margin: '8px 0 0' }}>{t('ms.foot')}</p>
      </div>
    </div>
  );
}

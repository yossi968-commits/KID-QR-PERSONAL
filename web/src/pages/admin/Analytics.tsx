import { useEffect, useState } from 'react';
import { useI18n, INTL } from '../../i18n';
import { api } from '../../lib/api';
import { Kpis, useLabels } from '../../components/ui';

type Split = { id: string; name?: string; savers: number; aum: number; share: number };
type A = {
  asOf: string; savers: number; activeFunds: number; saversYearAgo: number; saversGrowth: number | null;
  joinedThisYear: number; joinedLastYearToDate: number; joinedLastYear: number; joinsGrowth: number | null;
  monthly: { month: number; thisYear: number | null; lastYear: number }[];
  ages: { band: string; savers: number; aum: number }[];
  byProvider: Split[]; byTrack: Split[];
  aum: number; held: number; yearlyInflow: number;
  projection: {
    points: { year: number; existing: number; withNew: number }[];
    at: { years: number; date: string; existing: number; withNew: number }[];
    assumptions: { avgReturn: number; avgInflowPerSaver: number; newSaversPerYear: number };
  };
  channels: {
    communities: { id: string; savers: number }[];
    siblings: { families: number; withSiblings: number; kidsPerFamily: number };
    expecting: { total: number; converted: number; upcoming: number };
  };
  partners: { id: number; gifts: number; total: number }[];
};

const W = 640, H = 240, P = { l: 52, r: 16, t: 16, b: 28 };

function useFmt() {
  const { locale } = useI18n();
  const loc = INTL[locale];
  return {
    compact: (agorot: number) => '₪' + new Intl.NumberFormat(loc, { notation: 'compact', maximumFractionDigits: 1 }).format(agorot / 100),
    pct: (x: number) => (x > 0 ? '+' : '') + new Intl.NumberFormat(loc, { style: 'percent', maximumFractionDigits: 0 }).format(x),
    share: (x: number) => new Intl.NumberFormat(loc, { style: 'percent', maximumFractionDigits: 1 }).format(x),
    int: (n: number) => new Intl.NumberFormat(loc).format(n),
    month: (m: number) => new Intl.DateTimeFormat(loc, { month: 'short' }).format(new Date(Date.UTC(2026, m - 1, 15))),
  };
}

const Legend = ({ items }: { items: [string, string][] }) => (
  <div className="an-legend">{items.map(([color, label]) => <span key={label}><i style={{ background: color }} />{label}</span>)}</div>
);

/** New savers per month: this year against last year. */
function JoinsChart({ data, labels }: { data: A['monthly']; labels: [string, string] }) {
  const f = useFmt();
  const max = Math.max(1, ...data.map((d) => Math.max(d.thisYear ?? 0, d.lastYear)));
  const top = Math.ceil(max / 10) * 10;
  const gw = (W - P.l - P.r) / 12, bw = Math.min(16, (gw - 10) / 2);
  const y = (v: number) => H - P.b - (v / top) * (H - P.t - P.b);
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} style={{ direction: 'ltr' }} role="img" aria-label={labels.join(' / ')}>
      {[0, 0.5, 1].map((k) => (
        <g key={k}><line x1={P.l} x2={W - P.r} y1={y(top * k)} y2={y(top * k)} stroke="var(--line)" /><text x={P.l - 8} y={y(top * k) + 4} textAnchor="end" fontSize="10" fill="var(--muted)">{f.int(top * k)}</text></g>
      ))}
      {data.map((d, i) => {
        const x0 = P.l + i * gw + gw / 2 - bw - 1;
        return (
          <g key={d.month}>
            <rect x={x0} y={y(d.lastYear)} width={bw} height={Math.max(0, H - P.b - y(d.lastYear))} rx="3" fill="var(--an-b)"><title>{`${f.month(d.month)} · ${labels[1]}: ${d.lastYear}`}</title></rect>
            {d.thisYear != null && <rect x={x0 + bw + 2} y={y(d.thisYear)} width={bw} height={Math.max(0, H - P.b - y(d.thisYear))} rx="3" fill="var(--an-a)"><title>{`${f.month(d.month)} · ${labels[0]}: ${d.thisYear}`}</title></rect>}
            <text x={P.l + i * gw + gw / 2} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--muted)">{f.month(d.month)}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** Invested amount over the next ten years: today's savers, and with new savers joining. */
function ProjectionLines({ points, labels }: { points: A['projection']['points']; labels: [string, string] }) {
  const f = useFmt();
  const max = Math.max(...points.map((p) => p.withNew)) || 1;
  const x = (yr: number) => P.l + (yr / (points.length - 1)) * (W - P.l - P.r - 60);
  const y = (v: number) => H - P.b - (v / max) * (H - P.t - P.b);
  const path = (k: 'existing' | 'withNew') => points.map((p, i) => `${i ? 'L' : 'M'}${x(p.year)},${y(p[k])}`).join(' ');
  const last = points[points.length - 1];
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} style={{ direction: 'ltr' }} role="img" aria-label={labels.join(' / ')}>
      {[0, 0.5, 1].map((k) => (
        <g key={k}><line x1={P.l} x2={W - P.r - 60} y1={y(max * k)} y2={y(max * k)} stroke="var(--line)" /><text x={P.l - 8} y={y(max * k) + 4} textAnchor="end" fontSize="10" fill="var(--muted)">{f.compact(max * k)}</text></g>
      ))}
      <path d={path('withNew')} fill="none" stroke="var(--an-b)" strokeWidth="2" />
      <path d={path('existing')} fill="none" stroke="var(--an-a)" strokeWidth="2" />
      {points.filter((p) => [0, 1, 5, 10].includes(p.year)).map((p) => (
        <g key={p.year}>
          <circle cx={x(p.year)} cy={y(p.withNew)} r="4.5" fill="var(--an-b)" stroke="var(--surface)" strokeWidth="2"><title>{`${p.year} · ${labels[1]}: ${f.compact(p.withNew)}`}</title></circle>
          <circle cx={x(p.year)} cy={y(p.existing)} r="4.5" fill="var(--an-a)" stroke="var(--surface)" strokeWidth="2"><title>{`${p.year} · ${labels[0]}: ${f.compact(p.existing)}`}</title></circle>
          <text x={x(p.year)} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--muted)">{p.year === 0 ? '0' : '+' + p.year}</text>
        </g>
      ))}
      <text x={x(last.year) + 8} y={y(last.withNew) + 4} fontSize="11" fill="var(--ink-2)">{f.compact(last.withNew)}</text>
      <text x={x(last.year) + 8} y={y(last.existing) + 4} fontSize="11" fill="var(--ink-2)">{f.compact(last.existing)}</text>
    </svg>
  );
}

/** One horizontal bar per row: count of savers, invested amount and share. */
function SplitList({ rows, label, shareLabel, hideAum }: { rows: { key: string; name: string; savers: number; aum: number; share: number }[]; label: string; shareLabel: string; hideAum?: boolean }) {
  const f = useFmt();
  const { t } = useI18n();
  const max = Math.max(...rows.map((r) => r.share), 0.0001);
  return (
    <div className={'an-split' + (hideAum ? ' no-aum' : '')} role="table" aria-label={label}>
      <div className="an-row head" role="row"><span>{label}</span><span>{t('an.savers')}</span>{!hideAum && <span>{t('an.aum')}</span>}<span>{shareLabel}</span></div>
      {rows.map((r) => (
        <div key={r.key} className="an-row" role="row" title={`${r.name}: ${f.int(r.savers)} · ${f.compact(r.aum)} · ${f.share(r.share)}`}>
          <span>{r.name}</span><span className="num">{f.int(r.savers)}</span>{!hideAum && <span className="num">{f.compact(r.aum)}</span>}
          <span className="an-bar"><i style={{ width: `${(r.share / max) * 100}%` }} /><b className="num">{f.share(r.share)}</b></span>
        </div>
      ))}
    </div>
  );
}

export function AdminAnalytics() {
  const { t, fmtMoney, fmtDate } = useI18n();
  const L = useLabels();
  const f = useFmt();
  const [a, setA] = useState<A | null>(null);
  useEffect(() => { api<A>('/admin/analytics').then(setA); }, []);
  if (!a) return null;
  const y = a.asOf.slice(0, 4);
  const joinLabels: [string, string] = [t('an.thisYear', { y }), t('an.lastYear', { y: String(+y - 1) })];
  const projLabels: [string, string] = [t('an.projExisting'), t('an.projWithNew')];
  return (
    <>
      <div className="admin-top"><h1>{t('admin.nav.analytics')}</h1><span className="spacer" /><span className="small muted">{t('an.asOf', { date: fmtDate(a.asOf) })}</span></div>
      <div className="admin-body">
        <Kpis items={[
          { label: t('an.savers'), value: f.int(a.savers), sub: t('an.activeFunds', { n: f.int(a.activeFunds) }) },
          { label: t('an.joined', { y }), value: f.int(a.joinedThisYear), sub: a.joinsGrowth != null ? t('an.vsLastYear', { pct: f.pct(a.joinsGrowth), n: f.int(a.joinedLastYearToDate) }) : undefined, tone: a.joinsGrowth != null && a.joinsGrowth >= 0 ? 'pos' : undefined },
          { label: t('an.growth'), value: a.saversGrowth != null ? f.pct(a.saversGrowth) : '—', sub: t('an.yearAgo', { n: f.int(a.saversYearAgo) }), tone: a.saversGrowth != null && a.saversGrowth >= 0 ? 'pos' : undefined },
          { label: t('an.aumNow'), value: fmtMoney(a.aum), sub: t('an.held', { amount: fmtMoney(a.held) }) },
          { label: t('an.inflow'), value: fmtMoney(a.yearlyInflow), sub: t('an.inflowSub') },
        ]} />

        <div className="card">
          <div className="card-head"><h3>{t('an.joinsTitle')}</h3><Legend items={[['var(--an-a)', joinLabels[0]], ['var(--an-b)', joinLabels[1]]]} /></div>
          <JoinsChart data={a.monthly} labels={joinLabels} />
          <p className="small muted" style={{ margin: 0 }}>{t('an.joinsNote', { last: f.int(a.joinedLastYear) })}</p>
        </div>

        <div className="card">
          <div className="card-head"><h3>{t('an.projTitle')}</h3><Legend items={[['var(--an-a)', projLabels[0]], ['var(--an-b)', projLabels[1]]]} /></div>
          <div className="an-proj">
            <div className="stat"><div className="label">{t('an.today')}</div><div className="value num">{fmtMoney(a.aum)}</div></div>
            {a.projection.at.map((p) => (
              <div key={p.years} className="stat">
                <div className="label">{t('an.inYears', { n: p.years })} · {fmtDate(p.date)}</div>
                <div className="value num">{fmtMoney(p.existing)}</div>
                <div className="sub">{t('an.withNewShort')}: <b className="num">{fmtMoney(p.withNew)}</b></div>
              </div>
            ))}
          </div>
          <ProjectionLines points={a.projection.points} labels={projLabels} />
          <p className="small muted" style={{ margin: 0 }}>{t('an.projNote', { ret: f.share(a.projection.assumptions.avgReturn), inflow: fmtMoney(a.projection.assumptions.avgInflowPerSaver), n: f.int(a.projection.assumptions.newSaversPerYear) })}</p>
        </div>

        <div className="grid grid-2" style={{ alignItems: 'start' }}>
          <div className="card"><h3>{t('an.byProvider')}</h3><SplitList label={t('open.house')} shareLabel={t('an.shareAum')} rows={a.byProvider.map((r) => ({ key: r.id, name: t(`provider.${r.id}` as any) || r.name || r.id, savers: r.savers, aum: r.aum, share: r.share }))} /></div>
          <div className="card"><h3>{t('an.byTrack')}</h3><SplitList label={t('fund.track')} shareLabel={t('an.shareAum')} rows={a.byTrack.map((r) => ({ key: r.id, name: L.track(r.id), savers: r.savers, aum: r.aum, share: r.share }))} /></div>
        </div>
        <div className="card stack">
          <h3 style={{ margin: 0 }}>{t('an.channelsTitle')}</h3>
          <Kpis items={[
            { label: t('an.siblings'), value: f.int(a.channels.siblings.withSiblings), sub: t('an.siblingsSub', { pct: f.share(a.channels.siblings.families ? a.channels.siblings.withSiblings / a.channels.siblings.families : 0), n: a.channels.siblings.kidsPerFamily.toFixed(1) }) },
            { label: t('an.expecting'), value: f.int(a.channels.expecting.total), sub: t('an.expectingSub', { converted: f.int(a.channels.expecting.converted), upcoming: f.int(a.channels.expecting.upcoming) }) },
            { label: t('an.partnerGifts'), value: fmtMoney(a.partners.reduce((s, p) => s + p.total, 0)), sub: t('an.partnerGiftsSub', { n: f.int(a.partners.reduce((s, p) => s + p.gifts, 0)) }) },
          ]} />
          <div><b className="small">{t('an.byCommunity')}</b><SplitList label={t('an.community')} shareLabel={t('an.shareSavers')} rows={a.channels.communities.map((c) => ({ key: c.id, name: t(`community.${c.id}` as any), savers: c.savers, aum: 0, share: a.savers ? c.savers / a.savers : 0 }))} hideAum /></div>
        </div>
        <div className="card"><h3>{t('an.byAge')}</h3><SplitList label={t('an.ageBand')} shareLabel={t('an.shareSavers')} rows={a.ages.map((b) => ({ key: b.band, name: t(`an.age.${b.band}` as any), savers: b.savers, aum: b.aum, share: a.savers ? b.savers / a.savers : 0 }))} /></div>
      </div>
    </>
  );
}

import { useI18n } from '../../i18n';
import { GrowthChart, ProjectionChart } from '../../components/Charts';
import { daysUntil } from '../../lib/util';
import type { ChildData } from './ChildPage';

export default function Overview({ data }: { data: ChildData }) {
  const { t, fmtMoney, fmtDate } = useI18n();
  const { child, portfolio: p } = data;
  const goalPct = child.goalAmount ? Math.min(100, (p.value / child.goalAmount) * 100) : 0;
  return (
    <div className="stack">
      <div className="grid grid-4">
        <div className="card brand stat"><div className="label">{t('child.value')}</div><div className="value num">{fmtMoney(p.value)}</div></div>
        <div className="card stat"><div className="label">{t('dash.deposited')}</div><div className="value num">{fmtMoney(p.deposited)}</div></div>
        <div className="card stat"><div className="label">{t('child.gain')}</div><div className="value num" style={{ color: p.gain >= 0 ? 'var(--good)' : 'var(--bad)' }}>{p.gain >= 0 ? '+' : ''}{fmtMoney(p.gain)}</div><div className="small muted num">{(p.gainPct * 100).toFixed(1)}%</div></div>
        <div className="card stat"><div className="label">{t('child.nextBirthday')}</div><div className="value" style={{ fontSize: '1.2rem' }}>{fmtDate(child.nextBirthday)}</div><div className="small muted">{t('child.inDays', { n: daysUntil(child.nextBirthday) })} · {p.giverCount} {t('child.givers')}</div></div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3>{t('child.chartTitle')}</h3>
          <GrowthChart data={p.history} />
        </div>
        <div className="card">
          <div className="row between"><h3 style={{ margin: 0 }}>{t('child.projTitle')}</h3><span className="small muted">{fmtDate(p.projection.payoutDate)}</span></div>
          <div className="grid" style={{ gap: 8, margin: '12px 0', gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {(['low', 'mid', 'high'] as const).map((k) => (
              <div key={k} className={'card flat center' + (k === 'mid' ? ' gold' : '')} style={{ padding: 10 }}>
                <div className="small muted">{t(`child.proj${k[0].toUpperCase() + k.slice(1)}` as any)}</div>
                <div className="num" style={{ fontWeight: 700 }}>{fmtMoney(p.projection.finals[k])}</div>
              </div>
            ))}
          </div>
          <ProjectionChart points={p.projection.points} />
          <p className="small muted" style={{ marginTop: 8 }}>{t('child.projNote', { amount: fmtMoney(p.projection.annualAssumed) })}</p>
        </div>
      </div>

      <div className="grid grid-2">
        {child.goalAmount ? (
          <div className="card">
            <h3>🎯 {t('child.goal')}: {child.goalText}</h3>
            <div className="row between small"><span className="num">{fmtMoney(p.value)}</span><span className="num">{fmtMoney(child.goalAmount)}</span></div>
            <div className="progress" style={{ marginTop: 6 }}><div style={{ width: goalPct + '%' }} /></div>
          </div>
        ) : null}
        <div className="card">
          <h3>{t('child.holdings')}</h3>
          {p.holdings.map((h) => (
            <div key={h.track} className="row between"><span>{t(('track.' + h.track) as any)}</span><span className="num">{fmtMoney(h.value)}</span></div>
          ))}
          <div className="small muted" style={{ marginTop: 8 }}>{t('child.account')}: <span className="num">{child.partnerAccountId}</span></div>
        </div>
      </div>
    </div>
  );
}

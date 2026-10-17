import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { FutureHero, FutureTiles } from '../../components/Future';
import { ScenarioCalc, riskForTrack } from '../../components/ScenarioCalc';
import { Journey } from '../../components/Journey';
import { ProviderName } from '../../components/ProviderMark';
import { useI18n } from '../../i18n';
import { api, type ChildData } from '../../lib/api';
import { GrowthChart, ProjectionChart } from '../../components/Charts';
import QrPanel from '../../components/QrPanel';
import { Kpis, Loading, Signed, useLabels } from '../../components/ui';
import { gradeLabel } from './Dashboard';
import Money from './Money';
import PlannerTab from './PlannerTab';
import FundTab from './FundTab';
import { EventsTab, LearnTab, SettingsTab } from './MoreTabs';
import { FundPill, LifeTimeline } from '../../components/Lifecycle';
import { ApiError } from '../../lib/api';

const TABS = ['overview', 'money', 'planner', 'fund', 'qr', 'events', 'learn', 'settings'] as const;
/** From 18 the fund is the young adult's: parents see it (if allowed) and can still give. */
const ADULT_TABS = ['overview', 'money', 'qr'] as const;

export default function ChildPage() {
  const { id } = useParams();
  const { t, fmtMoney, fmtDate } = useI18n();
  const [sp, setSp] = useSearchParams();
  const [data, setData] = useState<ChildData | null>(null);
  const [hidden, setHidden] = useState(false);
  const load = useCallback(() => api<ChildData>(`/children/${id}`).then(setData).catch((e) => { if (e instanceof ApiError && e.code === 'private_by_child') setHidden(true); else throw e; }), [id]);
  useEffect(() => { load(); }, [load]);
  if (hidden) return <div className="container page-head"><div className="small muted"><Link to="/parent">{t('parent.nav.portfolio')}</Link></div><div className="banner" style={{ marginTop: 16 }}>🔒 {t('err.private_by_child')}</div></div>;
  if (!data) return <Loading />;
  const { child, portfolio } = data;
  // Once an adult's fund is open it is theirs; until then a parent may help set it up.
  const adult = child.lifecycle.phase !== 'minor' && child.accountStatus === 'active';
  const tabs: readonly string[] = adult ? ADULT_TABS : TABS;
  const tab = tabs.includes(sp.get('tab') || '') ? sp.get('tab')! : 'overview';

  return (
    <div className="container page-head">
      <div className="small muted"><Link to="/parent">{t('parent.nav.portfolio')}</Link> / {child.firstName}</div>
      <div className="row" style={{ margin: '10px 0 18px' }}>
        <div className="avatar lg">{child.avatar}</div>
        <div>
          <h1 style={{ margin: 0 }}>{child.firstName} {child.lastName}</h1>
          <div className="muted small">{t('dash.ageGrade', { age: child.age, grade: gradeLabel(t, child.grade) })} · <ProviderName id={child.provider} name={t(`provider.${child.provider}` as any)} size={20} /> · <span className="num">{child.partnerAccountId || child.giftCode}</span></div>
        </div>
        <span className="spacer" />
        <FundPill child={child} />
        {!adult && <Link className="btn sm secondary" to={`/parent/new?sibling=${child.id}`}>👶 {t('sib.button')}</Link>}
        <div className="stat" style={{ textAlign: 'end' }}><div className="label">{t('child.value')}</div><div className="value num">{fmtMoney(portfolio.value)}</div></div>
      </div>
      {adult && (
        <div className="banner" style={{ marginBottom: 16 }}>
          {child.lifecycle.openedAsAdult ? `🔑 ${t('life.directBanner', { name: child.firstName })}` : child.lifecycle.phase === 'graduated' ? `🎓 ${t('life.graduatedBanner', { name: child.firstName, house: t(`provider.${child.provider}` as any) })}` : `🔑 ${t('life.handedBanner', { name: child.firstName, date: fmtDate(child.lifecycle.handedOverAt || child.lifecycle.handoverDate) })}`}
        </div>
      )}
      {!adult && child.accountStatus !== 'active' && (
        <div className="banner" style={{ marginBottom: 16 }}>
          📄 {child.accountStatus === 'pending_docs' ? t('fund.bannerDocs', { n: data.documents.missing.length, amount: fmtMoney(portfolio.held) }) : t('fund.bannerReview', { house: t(`provider.${child.provider}` as any) })}
          {tab !== 'fund' && <button className="btn sm" onClick={() => setSp({ tab: 'fund' })}>{t('fund.toChecklist')}</button>}
        </div>
      )}
      <div className="tabs" role="tablist">
        {tabs.map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setSp({ tab: k }, { replace: true })}>
            {t(`ctab.${k}` as any)}{k === 'fund' && data.documents.missing.length > 0 && <span className="pill gold num" style={{ marginInlineStart: 6 }}>{data.documents.missing.length}</span>}
          </button>
        ))}
      </div>
      {tab === 'overview' && <Overview data={data} go={(k) => setSp({ tab: k })} />}
      {tab === 'money' && <Money data={data} reload={load} />}
      {tab === 'planner' && <PlannerTab data={data} />}
      {tab === 'fund' && sp.get('new') === '1' && (Number(sp.get('gifts')) > 0 || Number(sp.get('reused')) > 0) && (
        <div className="stack" style={{ gap: 8, marginBottom: 12 }}>
          {Number(sp.get('gifts')) > 0 && <div className="banner small">{t('fund.partnerGifts', { n: Number(sp.get('gifts')) })}</div>}
          {Number(sp.get('reused')) > 0 && <div className="banner small">{t('sib.reused', { n: Number(sp.get('reused')) })}</div>}
        </div>
      )}
      {tab === 'fund' && <FundTab data={data} reload={load} fresh={sp.get('new') === '1'} />}
      {tab === 'qr' && <QrPanel child={child} />}
      {tab === 'events' && <EventsTab data={data} reload={load} />}
      {tab === 'learn' && <LearnTab childId={child.id} />}
      {tab === 'settings' && <SettingsTab data={data} reload={load} />}
    </div>
  );
}

function Overview({ data, go }: { data: ChildData; go: (tab: string) => void }) {
  const { t, fmtMoney, fmtDate } = useI18n();
  const L = useLabels();
  const { child, portfolio: p } = data;
  const goalPct = child.goalAmount ? Math.min(100, (p.value / child.goalAmount) * 100) : 0;
  return (
    <div className="stack">
      <FutureHero child={child} p={p}>
        <div className="row"><button className="btn gold" onClick={() => go('money')}>🎁 {t('future.addGift')}</button></div>
      </FutureHero>
      <FutureTiles onGift={() => go('qr')} onLearn={() => go('learn')} />
      <LifeTimeline child={child} />
      <Kpis items={[
        { label: t('child.value'), value: fmtMoney(p.value) },
        { label: t('dash.deposited'), value: fmtMoney(p.deposited), sub: p.earned ? t('child.earnedSub', { amount: fmtMoney(p.earned) }) : undefined },
        { label: t('child.gain'), value: <Signed value={p.gain} />, sub: `${(p.gainPct * 100).toFixed(1)}%` },
        { label: t('child.projected', { age: p.projection.payoutAge }), value: fmtMoney(p.projection.finals.mid), sub: t('child.projectedSub', { date: fmtDate(p.projection.payoutDate) }) },
      ]} />
      <div className="grid grid-2">
        <div className="card">
          <div className="card-head"><h3>{t('child.chartTitle')}</h3><span className="small muted">{p.giverCount} {t('child.givers')}</span></div>
          <GrowthChart data={p.history} />
        </div>
        <div className="card">
          <div className="card-head"><h3>{t('child.projTitle', { age: p.projection.payoutAge })}</h3><span className="small muted">{t('child.projNote', { amount: fmtMoney(p.projection.annualAssumed) })}</span></div>
          <ProjectionChart points={p.projection.points} />
          <div className="grid" style={{ gap: 8, marginTop: 10, gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {(['low', 'mid', 'high'] as const).map((k) => (
              <div key={k} className="center" style={{ padding: 8, borderRadius: 'var(--radius-sm)', background: k === 'mid' ? 'var(--accent-soft)' : 'var(--surface-2)' }}>
                <div className="small muted">{t(`child.proj${k[0].toUpperCase() + k.slice(1)}` as any)}</div>
                <div className="num" style={{ fontWeight: 700 }}>{fmtMoney(p.projection.finals[k])}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <Journey path={`/children/${child.id}/journey`} self={false} />
      <ScenarioCalc name={child.firstName} startValue={p.value} startAge={(Date.now() - new Date(child.birthDate).getTime()) / 31557600000} risk={riskForTrack(child.track)} />
      <div className="grid grid-2">
        <div className="card">
          <h3>{t('child.account')}</h3>
          <dl className="kv">
            <dt>{t('open.house')}</dt><dd><ProviderName id={child.provider} name={t(`provider.${child.provider}` as any)} size={22} /></dd>
            <dt>{t('fund.productLabel')}</dt><dd>{t('fund.product')}</dd>
            <dt>{t('fund.accountNo')}</dt><dd className="num">{child.partnerAccountId || '—'}</dd>
            <dt>{t('onb.track')}</dt><dd>{L.track(child.track)}</dd>
            {p.holdings.map((h) => [<dt key={h.track + 'd'}>{t('child.holding')}</dt>, <dd key={h.track} className="num">{L.track(h.track)} · {fmtMoney(h.value)}</dd>])}
            <dt>{t('fund.payoutAt', { age: p.projection.payoutAge })}</dt><dd>{fmtDate(p.projection.payoutDate)}</dd>
          </dl>
        </div>
        {child.goalAmount ? (
          <div className="card">
            <h3>🎯 {t('child.goal')}: {child.goalText}</h3>
            <div className="row between small"><span className="num">{fmtMoney(p.value)}</span><span className="num">{fmtMoney(child.goalAmount)}</span></div>
            <div className="progress" style={{ marginTop: 6 }}><div style={{ width: goalPct + '%' }} /></div>
            <p className="small muted" style={{ marginTop: 10 }}>{t('child.goalNote', { pct: Math.round(goalPct) })}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

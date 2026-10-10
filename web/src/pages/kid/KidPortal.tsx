import { useEffect, useState, type FormEvent } from 'react';
import { MoveFund } from '../../components/MoveFund';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useI18n } from '../../i18n';
import { useAuth } from '../../lib/auth';
import { api, ADULT_EVENT_TYPES, PAYOUT_METHODS, type Child, type EventRow, type Pledge, type Planner, type Portfolio, type Provider } from '../../lib/api';
import TrackDialog from '../../components/TrackDialog';
import { LifeTimeline } from '../../components/Lifecycle';
import { DocChecklist } from '../parent/FundTab';
import type { Docs } from '../../lib/api';
import MoneyTree from '../../components/MoneyTree';
import QrPanel from '../../components/QrPanel';
import { GrowthChart, ProjectionChart } from '../../components/Charts';
import { useLessons, LessonModal, type Lesson, type LessonsRes } from '../../components/Lessons';
import { MethodPicker, goPay, useMethods } from '../../components/Pay';
import { LangButton } from '../../components/Shells';
import { Kpis, useLabels } from '../../components/ui';
import { gradeLabel } from '../parent/Dashboard';
import { useErr } from '../Auth';

type Deposit = { id: number; amount: number; source: string; method: string; monthly: boolean; paidAt: string; payer: string };
type KidData = { child: Child; portfolio: Portfolio; planner: Planner; deposits: Deposit[]; pledges: Pledge[]; events: EventRow[]; reload: () => void };

/** Sources a child can tag their own money with, by stage: the older, the more options. */
const SOURCES_BY_STAGE = {
  young: ['pocket_money'],
  middle: ['pocket_money', 'babysitting', 'dog_walking', 'tutoring', 'other_work'],
  senior: ['salary', 'waiting_tables', 'babysitting', 'tutoring', 'dog_walking', 'pocket_money', 'other_work'],
};

function useKidData(): KidData | null {
  const [s, setS] = useState<Omit<KidData, 'reload'> | null>(null);
  const load = async () => {
    const [me, planner, dep] = await Promise.all([api('/kid/me'), api<Planner>('/kid/planner'), api('/kid/deposits')]);
    setS({ child: me.child, portfolio: me.portfolio, planner, deposits: dep.deposits, pledges: dep.pledges, events: me.events || [] });
  };
  useEffect(() => { load(); }, []);
  return s && { ...s, reload: load };
}

/** The child's own app. Its look grows up with them: grades 1–6, 7–9, then high school and army. */
export default function KidPortal() {
  const { kid, loading } = useAuth();
  const data = useKidData();
  const lessons = useLessons('/kid');
  if (loading) return null;
  if (!kid) return <Navigate to="/login/kid" replace />;
  if (!data || !lessons.data) return <div className={`shell theme-${kid.stage}`} style={{ minHeight: '100vh' }} />;
  const props = { d: data, lessons: lessons.data, reloadLessons: lessons.reload };
  return data.child.stage === 'young' ? <Young {...props} /> : data.child.stage === 'middle' ? <Middle {...props} /> : <Senior {...props} />;
}

type P = { d: KidData; lessons: LessonsRes; reloadLessons: () => void };

function useTab<T extends string>(tabs: readonly T[]) {
  const [sp, setSp] = useSearchParams();
  const tab = (tabs.includes(sp.get('tab') as T) ? sp.get('tab') : tabs[0]) as T;
  return [tab, (k: T) => { setSp({ tab: k }, { replace: true }); window.scrollTo(0, 0); }] as const;
}

function Logout({ className = 'btn ghost sm' }: { className?: string }) {
  const { t } = useI18n();
  const { logout } = useAuth();
  const nav = useNavigate();
  return <button className={className} onClick={() => { logout(); nav('/'); }}>{t('nav.logout')}</button>;
}

/* ============ Grades 1–6: playful ============ */
const YOUNG_TABS = ['home', 'learn', 'wishes', 'qr'] as const;
function Young({ d, lessons, reloadLessons }: P) {
  const { t, fmtMoney } = useI18n();
  const [tab, go] = useTab(YOUNG_TABS);
  const [open, setOpen] = useState<Lesson | null>(null);
  const [depositing, setDepositing] = useState(false);
  const { child, portfolio: p } = d;
  const mine = lessons.lessons.filter((l) => l.band === lessons.band);
  const icons = { home: '🌳', learn: '📚', wishes: '🎁', qr: '📷' };
  return (
    <div className="shell theme-young" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="container kid-top">
        <span style={{ fontSize: 30 }}>{child.avatar}</span><b>{child.firstName}</b>
        <span className="spacer" />
        <span className="pill gold" style={{ fontSize: '1rem' }}>⭐ {lessons.totalStars}</span>
        <LangButton className="btn ghost sm" /><Logout />
      </div>
      <main className="container" style={{ flex: 1, paddingBottom: 24 }}>
        {tab === 'home' && (
          <div className="stack">
            <div className="young-hero">
              <h1>{t('kid.hello', { name: child.firstName })}</h1>
              <div className="muted">{t('young.grade', { grade: gradeLabel(t, child.grade) })}</div>
            </div>
            <div className="center"><MoneyTree value={p.value} deposited={p.deposited} size={300} /></div>
            <div className="bubble center">
              <div>{t('kid.treeSays')}</div>
              <div className="young-big num">{fmtMoney(p.value)}</div>
              <div>🌱 {t('kid.grew', { amount: fmtMoney(Math.max(0, p.gain)) })}</div>
              <div>💛 {t('kid.friends', { n: p.giverCount })}</div>
            </div>
            <div className="young-tiles">
              <button className="young-tile" onClick={() => setDepositing(true)}><span className="t-icon">🪙</span><b>{t('young.addPocket')}</b></button>
              <button className="young-tile" onClick={() => go('learn')}><span className="t-icon">📚</span><b>{t('young.learn')}</b></button>
              <button className="young-tile" onClick={() => go('wishes')}><span className="t-icon">🎁</span><b>{t('young.wishes')}</b></button>
            </div>
            <div className="bubble center"><div>🎓 {t('kid.at21')}</div><div className="young-big num" style={{ fontSize: '2rem' }}>{fmtMoney(p.projection.finals.mid)}</div></div>
            {depositing && <div className="bubble"><DepositForm d={d} onCancel={() => setDepositing(false)} returnTab="home" /></div>}
          </div>
        )}
        {tab === 'learn' && (
          <div className="stack">
            <h1 className="center" style={{ marginTop: 16 }}>{t('kid.learn')}</h1>
            <div className="young-tiles">
              {mine.map((l) => (
                <button key={l.id} className={'young-tile' + (l.completed ? ' done' : '')} onClick={() => setOpen(l)}>
                  <span className="t-icon">{l.icon}</span><b>{l.title}</b>
                  <span>{l.completed ? '✅ ' + '⭐'.repeat(Math.min(5, l.starsEarned)) : '⭐ ' + l.stars}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {tab === 'wishes' && <div className="bubble" style={{ marginTop: 16 }}><WishPlanner d={d} simple /></div>}
        {tab === 'qr' && <div style={{ marginTop: 16 }}><QrPanel child={child} /></div>}
      </main>
      <nav className="kid-tabbar" aria-label={t('kid.nav')}>
        {YOUNG_TABS.map((k) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => go(k)} aria-current={tab === k ? 'page' : undefined}><span className="ti" aria-hidden>{icons[k]}</span>{t(`young.tab.${k}` as any)}</button>)}
      </nav>
      {open && <LessonModal base="/kid" lesson={open} onClose={() => { setOpen(null); reloadLessons(); }} />}
    </div>
  );
}

/* ============ Grades 7–9: dark, levels and quests ============ */
const MID_TABS = ['home', 'quests', 'goals', 'earn', 'qr'] as const;
function Middle({ d, lessons, reloadLessons }: P) {
  const { t, fmtMoney } = useI18n();
  const [tab, go] = useTab(MID_TABS);
  const [open, setOpen] = useState<Lesson | null>(null);
  const { child, portfolio: p, planner } = d;
  const level = 1 + Math.floor(lessons.totalStars / 6);
  const xp = ((lessons.totalStars % 6) / 6) * 100;
  const goal = child.goalAmount || p.projection.finals.mid;
  const goalPct = Math.min(100, Math.round((p.value / goal) * 100));
  const badges: [string, string, boolean][] = [
    ['🎓', t('mid.badge.firstLesson'), lessons.lessons.some((l) => l.completed)],
    ['⭐', t('mid.badge.stars10'), lessons.totalStars >= 10],
    ['💼', t('mid.badge.earned'), p.earned > 0],
    ['🎯', t('mid.badge.wish'), planner.wishes.some((w) => w.createdBy === 'child')],
    ['🌳', t('mid.badge.tree'), p.value >= 1000000],
    ['🤝', t('mid.badge.givers'), p.giverCount >= 10],
  ];
  const quests = [...lessons.lessons.filter((l) => l.band === lessons.band), ...lessons.lessons.filter((l) => l.band !== lessons.band && l.band !== 'little')];
  return (
    <div className="shell theme-middle">
      <div className="container mid-top">
        <span style={{ fontSize: 28 }}>{child.avatar}</span>
        <div><b>{child.firstName}</b><div className="small muted">{t('mid.level', { n: level })} · {gradeLabel(t, child.grade)}</div></div>
        <span className="spacer" />
        <LangButton className="btn ghost sm" /><Logout />
      </div>
      <div className="container"><nav className="mid-nav" aria-label={t('kid.nav')}>{MID_TABS.map((k) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => go(k)}>{t(`mid.tab.${k}` as any)}</button>)}</nav></div>
      <main className="container" style={{ paddingTop: 18 }}>
        {tab === 'home' && (
          <div className="stack">
            <div className="level-card">
              <div className="ring" style={{ ['--p' as any]: goalPct }}><div><b className="num">{goalPct}%</b><span className="small muted">{t('mid.ofGoal')}</span></div></div>
              <div className="stack" style={{ gap: 8 }}>
                <div className="small muted">{child.goalText || t('mid.goal21')}</div>
                <div className="big-num num">{fmtMoney(p.value)}</div>
                <div className="small">{t('mid.gain', { amount: fmtMoney(Math.max(0, p.gain)) })}</div>
                <div><div className="row between small"><span>{t('mid.level', { n: level })}</span><span>{lessons.totalStars} XP</span></div><div className="xp"><div style={{ width: xp + '%' }} /></div></div>
              </div>
            </div>
            <div className="grid grid-3">
              <div className="card"><div className="small muted">{t('mid.fromFamily')}</div><div className="big-num num" style={{ fontSize: '1.6rem' }}>{fmtMoney(p.deposited - p.earned)}</div></div>
              <div className="card"><div className="small muted">{t('mid.fromMe')}</div><div className="big-num num" style={{ fontSize: '1.6rem', color: 'var(--accent)' }}>{fmtMoney(p.earned)}</div></div>
              <div className="card"><div className="small muted">{t('kid.at21')}</div><div className="big-num num" style={{ fontSize: '1.6rem' }}>{fmtMoney(p.projection.finals.mid)}</div></div>
            </div>
            <h3>{t('mid.badges')}</h3>
            <div className="badges">{badges.map(([i, l, on]) => <div key={l} className={'badge' + (on ? '' : ' locked')}><span className="b-icon">{i}</span>{l}</div>)}</div>
          </div>
        )}
        {tab === 'quests' && (
          <div className="stack">
            <h2>{t('mid.questsTitle')}</h2>
            {quests.map((l) => (
              <button key={l.id} className={'mid-quest' + (l.completed ? ' done' : '')} onClick={() => setOpen(l)} style={{ font: 'inherit', color: 'inherit', textAlign: 'start', cursor: 'pointer' }}>
                <span className="q-icon">{l.icon}</span>
                <span style={{ flex: 1 }}><b>{l.title}</b><div className="small muted">{t(`band.${l.band}` as any)}</div></span>
                <span className="pill">{l.completed ? `✓ +${l.starsEarned} XP` : `+${l.stars} XP`}</span>
              </button>
            ))}
          </div>
        )}
        {tab === 'goals' && <div className="card"><WishPlanner d={d} /></div>}
        {tab === 'earn' && <Earn d={d} />}
        {tab === 'qr' && <QrPanel child={child} mode="work" />}
      </main>
      <div style={{ height: 40 }} />
      {open && <LessonModal base="/kid" lesson={open} onClose={() => { setOpen(null); reloadLessons(); }} />}
    </div>
  );
}

/* ============ High school + army: clean fintech ============ */
const SEN_TABS = ['overview', 'deposits', 'plan', 'learn', 'qr'] as const;
/** From 18 the young adult also runs the fund: track, privacy, events, and at 21 the move to their own fund. */
const SELF_TABS = ['overview', 'mine', 'deposits', 'plan', 'learn', 'qr'] as const;
function Senior({ d, lessons, reloadLessons }: P) {
  const { t, fmtMoney, fmtDate } = useI18n();
  const L = useLabels();
  const self = d.child.lifecycle.managedBy === 'self';
  const TABS = (self ? SELF_TABS : SEN_TABS) as readonly (typeof SELF_TABS)[number][];
  const [tab, go] = useTab(TABS);
  const [open, setOpen] = useState<Lesson | null>(null);
  const { child, portfolio: p } = d;
  return (
    <div className="shell theme-senior">
      <header className="sen-top">
        <div className="container row" style={{ flexWrap: 'nowrap' }}>
          <b style={{ whiteSpace: 'nowrap' }}>{child.firstName}</b>
          <nav className="sen-nav" aria-label={t('kid.nav')}>{TABS.map((k) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => go(k)}>{t(`sen.tab.${k}` as any)}</button>)}</nav>
          <span className="spacer" />
          <LangButton className="btn ghost sm" /><Logout />
        </div>
      </header>
      <main className="container page-head stack">
        {tab === 'overview' && (
          <>
            <div className="sen-hero">
              <div>
                <div className="eyebrow">{t('sen.portfolio')} · {child.providerName} · {L.track(child.track)}</div>
                <div className="value num">{fmtMoney(p.value)}</div>
                <div className="small"><span className={p.gain >= 0 ? 'pos' : 'neg'}>{p.gain >= 0 ? '+' : ''}{fmtMoney(p.gain)} ({(p.gainPct * 100).toFixed(1)}%)</span> <span className="muted">{t('sen.allTime')}</span></div>
              </div>
              <button className="btn" onClick={() => go('deposits')}>＋ {t('sen.deposit')}</button>
            </div>
            {!self && <div className="banner small">🔑 {t('life.until18', { date: fmtDate(child.lifecycle.handoverDate), n: Math.max(0, Math.round((Date.parse(child.lifecycle.handoverDate) - Date.now()) / 86400000)) })}</div>}
            {self && <LifeTimeline child={child} />}
            <Kpis items={[
              { label: t('sen.fromFamily'), value: fmtMoney(p.deposited - p.earned) },
              { label: t('sen.fromMe'), value: fmtMoney(p.earned), sub: d.pledges.some((x) => x.status === 'active') ? t('sen.standing', { amount: fmtMoney(d.pledges.filter((x) => x.status === 'active').reduce((s, x) => s + x.amount, 0)) }) : undefined },
              { label: p.projection.payoutAge > 21 ? t('kid.atAge', { age: p.projection.payoutAge }) : t('kid.at21'), value: fmtMoney(p.projection.finals.mid), sub: fmtDate(p.projection.payoutDate) },
              self
                ? { label: t('child.gain'), value: fmtMoney(p.gain), sub: `${(p.gainPct * 100).toFixed(1)}%` }
                : { label: t('plan.available'), value: fmtMoney(d.planner.budget.available), sub: t('plan.resets', { date: fmtDate(d.planner.budget.resetsOn) }) },
            ]} />
            <div className="grid grid-2">
              <div className="card"><h3>{t('child.chartTitle')}</h3><GrowthChart data={p.history} /></div>
              <div className="card"><h3>{t('child.projTitle', { age: p.projection.payoutAge })}</h3><ProjectionChart points={p.projection.points} /></div>
            </div>
            <div className="card">
              <h3>{t('sen.mix')}</h3>
              <div className="alloc" aria-hidden><div style={{ width: `${p.deposited ? ((p.deposited - p.earned) / p.value) * 100 : 0}%`, background: 'var(--chart-dep)' }} /><div style={{ width: `${p.value ? (p.earned / p.value) * 100 : 0}%`, background: 'var(--brand)' }} /><div style={{ flex: 1, background: 'var(--good)', opacity: 0.5 }} /></div>
              <div className="legend" style={{ marginTop: 8 }}><span><i style={{ background: 'var(--chart-dep)' }} />{t('sen.fromFamily')}</span><span><i style={{ background: 'var(--brand)' }} />{t('sen.fromMe')}</span><span><i style={{ background: 'var(--good)', opacity: 0.5 }} />{t('sen.growth')}</span></div>
            </div>
          </>
        )}
        {tab === 'mine' && <MyFund d={d} />}
        {tab === 'deposits' && <Earn d={d} />}
        {tab === 'plan' && <>{!self && <Driving d={d} />}<div className="card"><WishPlanner d={d} /></div></>}
        {tab === 'learn' && (
          <div className="card" style={{ padding: 0 }}>
            <div className="card-head" style={{ padding: '16px 20px 0' }}><h3>{t('learn.title')}</h3><span className="pill brand">⭐ {lessons.totalStars}</span></div>
            {lessons.lessons.filter((l) => ['teens', 'young'].includes(l.band)).map((l) => (
              <div key={l.id} className="list-row" style={{ padding: '12px 20px' }}>
                <span aria-hidden style={{ fontSize: 22 }}>{l.icon}</span><span style={{ flex: 1 }}><b>{l.title}</b><div className="small muted">{t(`band.${l.band}` as any)}</div></span>
                {l.completed && <span className="pill good">✓</span>}
                <button className="btn sm secondary" onClick={() => setOpen(l)}>{l.completed ? t('learn.again') : t('learn.start')}</button>
              </div>
            ))}
          </div>
        )}
        {tab === 'qr' && <QrPanel child={child} mode="work" />}
      </main>
      {open && <LessonModal base="/kid" lesson={open} onClose={() => { setOpen(null); reloadLessons(); }} />}
    </div>
  );
}

/* ============ Shared kid pieces ============ */

/** Own money: pocket money, side jobs, part of a salary; one-time or a monthly standing deposit. */
function Earn({ d }: { d: KidData }) {
  const { t, fmtMoney, fmtDate } = useI18n();
  const L = useLabels();
  const senior = d.child.stage === 'senior';
  return (
    <div className="grid grid-2" style={{ alignItems: 'start' }}>
      <div className="card"><DepositForm d={d} returnTab={senior ? 'deposits' : 'earn'} /></div>
      <div className="card">
        <h3>{t('earn.history')}</h3>
        {d.pledges.filter((x) => x.status !== 'cancelled').map((x) => (
          <div key={x.id} className="list-row"><span aria-hidden>🔁</span><span style={{ flex: 1 }}><b>{L.source(x.source)}</b><div className="small muted">{L.method(x.method)} · {x.status === 'active' ? t('money.nextCharge', { date: fmtDate(x.nextDate) }) : t(`pledge.status.${x.status}` as any)}</div></span><b className="num">{fmtMoney(x.amount)}</b></div>
        ))}
        {d.deposits.length === 0 && <p className="muted small">{t('earn.none')}</p>}
        {d.deposits.map((x) => (
          <div key={x.id} className="list-row"><span aria-hidden>{x.monthly ? '🔁' : '💰'}</span><span style={{ flex: 1 }}><b>{L.source(x.source)}</b><div className="small muted">{fmtDate(x.paidAt)} · {x.payer}</div></span><b className="num">{fmtMoney(x.amount)}</b></div>
        ))}
        <p className="small muted" style={{ marginTop: 12 }}>💡 {t('earn.shareTip')}</p>
      </div>
    </div>
  );
}

function DepositForm({ d, onCancel, returnTab }: { d: KidData; onCancel?: () => void; returnTab: string }) {
  const { t, fmtMoney } = useI18n();
  const L = useLabels();
  const nav = useNavigate();
  const errText = useErr();
  const methods = useMethods();
  const sources = SOURCES_BY_STAGE[d.child.stage];
  const [source, setSource] = useState(sources[0]);
  const [amount, setAmount] = useState('');
  const [monthly, setMonthly] = useState(d.child.stage === 'senior');
  const [method, setMethod] = useState(d.child.stage === 'senior' ? 'masav' : 'bit');
  const [err, setErr] = useState('');
  const years = Math.max(0, 21 - d.child.age);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr('');
    try {
      const r = await api('/kid/deposits', { body: { amount: Number(amount), source, method, frequency: monthly ? 'monthly' : 'once' } });
      goPay(nav, r, `/kid?tab=${returnTab}`);
    } catch (x) { setErr(errText(x)); }
  };
  const quick = d.child.stage === 'young' ? [10, 20, 50] : d.child.stage === 'middle' ? [50, 100, 200] : [300, 500, 1000];
  return (
    <form className="stack" onSubmit={submit}>
      <h3 style={{ margin: 0 }}>{t(`earn.title.${d.child.stage}` as any)}</h3>
      <p className="small muted" style={{ margin: 0 }}>{t(`earn.desc.${d.child.stage}` as any)}</p>
      {sources.length > 1 && (
        <label className="field"><span>{t('earn.source')}</span>
          <select value={source} onChange={(e) => setSource(e.target.value)}>{sources.map((s) => <option key={s} value={s}>{L.source(s)}</option>)}</select>
        </label>
      )}
      <div className="row">{quick.map((q) => <button key={q} type="button" className={'chip num' + (Number(amount) === q ? ' on' : '')} onClick={() => setAmount(String(q))}>₪{q}</button>)}</div>
      <label className="field"><span>{t('money.amount')}</span><input type="number" dir="ltr" min={18} value={amount} onChange={(e) => setAmount(e.target.value)} required placeholder="₪" /></label>
      {Number(amount) > 0 && <div className="banner small">📈 {t(monthly ? 'earn.growMonthly' : 'earn.grow', { amount: fmtMoney(Number(amount) * 100), at21: fmtMoney(monthly ? monthlyFv(Number(amount) * 100, years, d.planner.growthRate) : Number(amount) * 100 * Math.pow(1 + d.planner.growthRate, years)) })}</div>}
      <MethodPicker methods={methods} monthly={monthly} setMonthly={setMonthly} value={method} onChange={setMethod} allowMonthly={d.child.stage !== 'young'} />
      {err && <div className="error">{err}</div>}
      <div className="row"><button className="btn">{t('earn.cta')}</button>{onCancel && <button type="button" className="btn ghost" onClick={onCancel}>{t('common.cancel')}</button>}</div>
    </form>
  );
}
const monthlyFv = (m: number, years: number, r: number) => { let v = 0; for (let i = 0; i < years * 12; i++) v = v * (1 + r / 12) + m; return v; };

/** Wishes along the way and the birthday withdrawal request, with a nudge to keep saving. */
function WishPlanner({ d, simple }: { d: KidData; simple?: boolean }) {
  const { t, fmtMoney, fmtDate } = useI18n();
  const errText = useErr();
  const [p, setP] = useState<Planner>(d.planner);
  const [wish, setWish] = useState({ title: '', icon: '🎁', targetAmount: '' });
  const [ask, setAsk] = useState<{ wishId?: number; amount: string; note: string; method?: string; destination?: string } | null>(null);
  const self = Boolean(p.budget.selfManaged);
  const [err, setErr] = useState('');
  const fundOpen = d.child.accountStatus === 'active';
  const at21 = (a: number) => a * Math.pow(1 + p.growthRate, p.yearsTo21);
  const run = async (fn: () => Promise<Planner>) => { setErr(''); try { setP(await fn()); return true; } catch (x) { setErr(errText(x)); return false; } };
  const b = p.budget;
  return (
    <div className="stack">
      <div className="row between">
        <h2 style={{ margin: 0 }}>{t(simple ? 'young.wishesTitle' : 'plan.kidTitle')}</h2>
        {self ? <button className="btn sm" disabled={!fundOpen} onClick={() => setAsk({ amount: '', note: '', method: 'bit', destination: '' })}>{t('plan.withdrawNow')}</button> : <span className="pill gold">{t('plan.kidBudget', { amount: fmtMoney(b.available) })}</span>}
      </div>
      <p className="small muted" style={{ margin: 0 }}>{self ? t('plan.selfDesc') : t('plan.kidBudgetDesc', { pct: b.pct, date: fmtDate(b.resetsOn) })}</p>
      {p.wishes.map((w) => (
        <div key={w.id} className="list-row">
          <span style={{ fontSize: simple ? 34 : 24 }} aria-hidden>{w.icon}</span>
          <span style={{ flex: 1 }}><b>{w.title}</b><div className="small muted">{fmtMoney(w.targetAmount)}{w.targetDate ? ` · ${fmtDate(w.targetDate)}` : ''} · {t('plan.orAt21', { amount: fmtMoney(w.costAt21) })}</div></span>
          {w.status === 'done' ? <span className="pill good">✓</span> : fundOpen && b.available > 0 && <button className="btn sm secondary" onClick={() => setAsk({ wishId: w.id, amount: String(Math.min(w.targetAmount, b.available) / 100), note: '', method: 'bit', destination: '' })}>{t('plan.ask')}</button>}
        </div>
      ))}
      {ask && (
        <div className="card" style={{ background: 'var(--surface-2)' }}>
          <label className="field"><span>{t('plan.askAmount')}</span><input type="number" dir="ltr" value={ask.amount} onChange={(e) => setAsk({ ...ask, amount: e.target.value })} max={b.available / 100} /></label>
          {!self && <div className="banner small" style={{ marginTop: 8 }}>🌱 {t('plan.nudge', { amount: fmtMoney(Number(ask.amount) * 100), at21: fmtMoney(at21(Number(ask.amount) * 100)), half: fmtMoney(Number(ask.amount) * 50) })}</div>}
          <label className="field" style={{ marginTop: 8 }}><span>{t(self ? 'money.note' : 'plan.note')}</span><input value={ask.note} onChange={(e) => setAsk({ ...ask, note: e.target.value })} /></label>
          {self && (
            <div className="row" style={{ marginTop: 8 }}>
              <label className="field" style={{ flex: 1 }}><span>{t('plan.to')}</span><select value={ask.method} onChange={(e) => setAsk({ ...ask, method: e.target.value })}>{PAYOUT_METHODS.map((m) => <option key={m} value={m}>{t(`method.${m}` as any)}</option>)}</select></label>
              <label className="field" style={{ flex: 2 }}><span>{t('plan.dest')}</span><input dir="ltr" value={ask.destination} onChange={(e) => setAsk({ ...ask, destination: e.target.value })} /></label>
            </div>
          )}
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn sm" onClick={async () => { if (await run(() => api('/kid/withdrawals', { body: { amount: Number(ask.amount), wishId: ask.wishId, note: ask.note, ...(self && { method: ask.method, destination: ask.destination }) } }))) setAsk(null); }}>{self ? t('plan.withdrawNow') : t('plan.send')}</button>
            {!self && <button className="btn ghost sm" onClick={() => setAsk({ ...ask, amount: String(Math.floor(Number(ask.amount) / 2)) })}>{t('plan.halfIt')}</button>}
            <button className="btn ghost sm" onClick={() => setAsk(null)}>{t('common.cancel')}</button>
          </div>
          {!self && <p className="small muted" style={{ margin: '8px 0 0' }}>{t('plan.parentsApprove')}</p>}
        </div>
      )}
      <form className="row" onSubmit={async (e) => { e.preventDefault(); if (await run(() => api('/kid/wishes', { body: { ...wish, targetAmount: Number(wish.targetAmount) } }))) setWish({ title: '', icon: '🎁', targetAmount: '' }); }}>
        <select value={wish.icon} onChange={(e) => setWish({ ...wish, icon: e.target.value })} style={{ width: 70 }} aria-label="icon">{['🎁', '🚲', '💻', '📱', '✈️', '🎸', '🚗', '🎮', '⚽'].map((i) => <option key={i}>{i}</option>)}</select>
        <input value={wish.title} onChange={(e) => setWish({ ...wish, title: e.target.value })} placeholder={t('plan.wishPh')} required style={{ flex: 2, minWidth: 120 }} />
        <input type="number" dir="ltr" value={wish.targetAmount} onChange={(e) => setWish({ ...wish, targetAmount: e.target.value })} placeholder="₪" required style={{ flex: 1, minWidth: 80 }} />
        <button className="btn secondary">{t('plan.addWish')}</button>
      </form>
      {err && <div className="error">{err}</div>}
      {p.withdrawals.length > 0 && (
        <div>
          <h4 style={{ marginTop: 8 }}>{t('plan.myRequests')}</h4>
          {p.withdrawals.map((w) => <div key={w.id} className="list-row small"><span style={{ flex: 1 }}>{fmtDate(w.createdAt)}{w.note ? ` · ${w.note}` : ''}</span><b className="num">{fmtMoney(w.amount)}</b><span className={'pill' + (w.status === 'paid' ? ' good' : w.status === 'rejected' ? ' bad' : ' gold')}>{t(`wd.${w.status}` as any)}</span></div>)}
        </div>
      )}
      {!fundOpen && <div className="banner small">{t('plan.fundClosed')}</div>}
    </div>
  );
}


/** The young adult's controls: who sees the fund, its track, gift events, and from 21 the move to a fund in their own name. */
function MyFund({ d }: { d: KidData }) {
  const { t, fmtMoney, fmtDate } = useI18n();
  const L = useLabels();
  const errText = useErr();
  const { child, portfolio: p } = d;
  const lc = child.lifecycle;
  const [err, setErr] = useState('');
  const [dialog, setDialog] = useState(false);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [house, setHouse] = useState(child.provider);
  const [ev, setEv] = useState({ type: 'graduation', title: '', date: '' });
  const [docs, setDocs] = useState<Docs | null>(null);
  useEffect(() => { api<{ providers: Provider[] }>('/providers').then((r) => setProviders(r.providers)); }, []);
  useEffect(() => { if (child.accountStatus !== 'active') api<Docs>('/kid/documents').then(setDocs); }, [child.accountStatus]);
  const run = async (fn: () => Promise<unknown>) => { setErr(''); try { await fn(); d.reload(); return true; } catch (x) { setErr(errText(x)); return false; } };
  const graduated = lc.phase === 'graduated';
  return (
    <div className="stack">
      <div className="sen-hero"><div><div className="eyebrow">🔑 {t('life.selfPill')}</div><h2 style={{ margin: '4px 0' }}>{t('life.mine.title')}</h2><p className="small muted" style={{ margin: 0 }}>{t('life.mine.desc')}</p></div></div>
      {err && <div className="error">{err}</div>}
      {docs && <><div className="banner small">📄 {t('life.finishDocs')}</div><DocChecklist initial={docs} base="/kid" name={child.firstName} onComplete={d.reload} /></>}
      <div className="grid grid-2">
        <div className="card stack">
          <h3 style={{ margin: 0 }}>🎓 {t('life.grad.title')}</h3>
          <p className="small muted" style={{ margin: 0 }}>{t('life.grad.desc')}</p>
          {lc.openedAsAdult ? <div className="banner small">✓ {t('life.grad.direct')}</div> : graduated ? (
            <>
              <div className="banner small">✓ {t('life.grad.done', { date: fmtDate(lc.graduatedAt!), account: child.partnerAccountId || '', house: child.providerName })}</div>
              {lc.minorAccountId && <div className="small muted">{t('life.grad.prev', { account: lc.minorAccountId })}</div>}
            </>
          ) : lc.canGraduate ? (
            <>
              <label className="field"><span>{t('life.grad.house')}</span><select value={house} onChange={(e) => setHouse(e.target.value)}>{providers.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
              <button className="btn" onClick={() => run(() => api('/kid/graduate', { body: { provider: house } }))}>{t('life.grad.cta', { amount: fmtMoney(p.value) })}</button>
            </>
          ) : <span className="pill gold">{t('life.grad.from', { date: fmtDate(lc.graduateFrom) })}</span>}
        </div>
        <div className="card stack">
          <h3 style={{ margin: 0 }}>{t('life.trackNow', { track: L.track(child.track) })}</h3>
          {!graduated && <button className="btn secondary" onClick={() => setDialog(true)}>{t('fund.changeTrack')}</button>}
          <p className="small muted" style={{ margin: 0 }}>{t('track.switchRule')}</p>
          <label className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
            <input type="checkbox" checked={lc.parentView} onChange={(e) => run(() => api('/kid/privacy', { body: { parentView: e.target.checked } }))} style={{ width: 'auto', marginTop: 4 }} />
            <span><b>{t('life.parentView')}</b><div className="small muted">{t('life.parentViewDesc')}</div></span>
          </label>
        </div>
      </div>
      {!graduated && <MoveFund child={child} url="/kid/provider" coSign={false} onDone={d.reload} />}
      <div className="card stack">
        <h3 style={{ margin: 0 }}>🎉 {t('life.events.title')}</h3>
        <p className="small muted" style={{ margin: 0 }}>{t('life.events.desc')}</p>
        {d.events.length === 0 && <p className="small muted">{t('life.events.none')}</p>}
        {d.events.map((e) => (
          <div key={e.id} className="list-row">
            <span style={{ flex: 1 }}><b>{e.title}</b><div className="small muted">{L.event(e.type)} · {fmtDate(e.date)}{e.goal_amount ? ` · ${fmtMoney(e.goal_amount)}` : ''}</div></span>
            <button className="btn ghost sm" onClick={() => run(() => api(`/kid/events/${e.id}`, { method: 'DELETE' }))}>{t('plan.remove')}</button>
          </div>
        ))}
        <form className="row" onSubmit={async (e) => { e.preventDefault(); if (await run(() => api('/kid/events', { body: ev }))) setEv({ type: 'graduation', title: '', date: '' }); }}>
          <select value={ev.type} onChange={(e) => setEv({ ...ev, type: e.target.value })} style={{ width: 150 }} aria-label={t('events.type')}>{ADULT_EVENT_TYPES.map((x) => <option key={x} value={x}>{L.event(x)}</option>)}</select>
          <input value={ev.title} onChange={(e) => setEv({ ...ev, title: e.target.value })} placeholder={t('events.titleField')} required style={{ flex: 2, minWidth: 140 }} />
          <input type="date" value={ev.date} onChange={(e) => setEv({ ...ev, date: e.target.value })} required style={{ flex: 1, minWidth: 130 }} />
          <button className="btn secondary">{t('life.events.add')}</button>
        </form>
      </div>
      {dialog && <TrackDialog value={child.track} coreOnly={false} years={10} onClose={() => setDialog(false)} onPick={(tr) => { setDialog(false); if (tr !== child.track) run(() => api('/kid/track', { body: { track: tr } })); }} />}
    </div>
  );
}

/** From 16: part of the savings for driving lessons and tests, beyond the yearly gift share; parents approve. */
function Driving({ d }: { d: KidData }) {
  const { t, fmtMoney, fmtDate } = useI18n();
  const errText = useErr();
  const dr = d.planner.driving;
  const [ask, setAsk] = useState<{ amount: string; note: string } | null>(null);
  const [err, setErr] = useState('');
  const pending = d.planner.withdrawals.filter((w) => w.purpose === 'driving' && w.status === 'requested');
  if (!dr.eligible) return <div className="banner small">🚗 {t('drive.soon', { date: fmtDate(`${Number(d.child.birthDate.slice(0, 4)) + dr.fromAge}${d.child.birthDate.slice(4)}`) })}</div>;
  return (
    <div className="card stack">
      <div className="row between"><h3 style={{ margin: 0 }}>🚗 {t('drive.title')}</h3><span className="pill gold num">{t('drive.available')}: {fmtMoney(dr.available)}</span></div>
      <p className="small muted" style={{ margin: 0 }}>{t('drive.desc', { cap: fmtMoney(dr.cap) })}</p>
      <Kpis items={[
        { label: t('drive.available'), value: fmtMoney(dr.available) },
        { label: t('drive.raised'), value: fmtMoney(dr.raised) },
        { label: t('drive.used'), value: fmtMoney(dr.used) },
      ]} />
      {pending.map((w) => <div key={w.id} className="list-row small"><span style={{ flex: 1 }}>{fmtDate(w.createdAt)}{w.note ? ` · ${w.note}` : ''}</span><b className="num">{fmtMoney(w.amount)}</b><span className="pill gold">{t('wd.requested')}</span></div>)}
      {ask ? (
        <div className="row">
          <input type="number" dir="ltr" value={ask.amount} onChange={(e) => setAsk({ ...ask, amount: e.target.value })} placeholder="₪" max={dr.available / 100} style={{ flex: 1, minWidth: 90 }} aria-label={t('plan.askAmount')} />
          <input value={ask.note} onChange={(e) => setAsk({ ...ask, note: e.target.value })} placeholder={t('drive.notePh')} style={{ flex: 2, minWidth: 140 }} />
          <button className="btn sm" onClick={async () => { setErr(''); try { await api('/kid/withdrawals', { body: { amount: Number(ask.amount), note: ask.note, purpose: 'driving' } }); setAsk(null); d.reload(); } catch (x) { setErr(errText(x)); } }}>{t('plan.send')}</button>
          <button className="btn ghost sm" onClick={() => setAsk(null)}>{t('common.cancel')}</button>
        </div>
      ) : <div className="row"><button className="btn secondary" disabled={dr.available <= 0 || d.child.accountStatus !== 'active'} onClick={() => setAsk({ amount: '', note: '' })}>{t('drive.ask')}</button><span className="small muted">{t('plan.parentsApprove')}</span></div>}
      {err && <div className="error">{err}</div>}
      <p className="small muted" style={{ margin: 0 }}>🎁 {t('drive.giftHint')}</p>
    </div>
  );
}

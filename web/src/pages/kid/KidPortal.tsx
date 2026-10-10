import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useI18n } from '../../i18n';
import { useAuth } from '../../lib/auth';
import { api, type Child, type Pledge, type Planner, type Portfolio } from '../../lib/api';
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
type KidData = { child: Child; portfolio: Portfolio; planner: Planner; deposits: Deposit[]; pledges: Pledge[]; reload: () => void };

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
    setS({ child: me.child, portfolio: me.portfolio, planner, deposits: dep.deposits, pledges: dep.pledges });
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
function Senior({ d, lessons, reloadLessons }: P) {
  const { t, fmtMoney, fmtDate } = useI18n();
  const L = useLabels();
  const [tab, go] = useTab(SEN_TABS);
  const [open, setOpen] = useState<Lesson | null>(null);
  const { child, portfolio: p } = d;
  return (
    <div className="shell theme-senior">
      <header className="sen-top">
        <div className="container row" style={{ flexWrap: 'nowrap' }}>
          <b style={{ whiteSpace: 'nowrap' }}>{child.firstName}</b>
          <nav className="sen-nav" aria-label={t('kid.nav')}>{SEN_TABS.map((k) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => go(k)}>{t(`sen.tab.${k}` as any)}</button>)}</nav>
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
            <Kpis items={[
              { label: t('sen.fromFamily'), value: fmtMoney(p.deposited - p.earned) },
              { label: t('sen.fromMe'), value: fmtMoney(p.earned), sub: d.pledges.some((x) => x.status === 'active') ? t('sen.standing', { amount: fmtMoney(d.pledges.filter((x) => x.status === 'active').reduce((s, x) => s + x.amount, 0)) }) : undefined },
              { label: t('kid.at21'), value: fmtMoney(p.projection.finals.mid), sub: fmtDate(p.projection.payoutDate) },
              { label: t('plan.available'), value: fmtMoney(d.planner.budget.available), sub: t('plan.resets', { date: fmtDate(d.planner.budget.resetsOn) }) },
            ]} />
            <div className="grid grid-2">
              <div className="card"><h3>{t('child.chartTitle')}</h3><GrowthChart data={p.history} /></div>
              <div className="card"><h3>{t('child.projTitle')}</h3><ProjectionChart points={p.projection.points} /></div>
            </div>
            <div className="card">
              <h3>{t('sen.mix')}</h3>
              <div className="alloc" aria-hidden><div style={{ width: `${p.deposited ? ((p.deposited - p.earned) / p.value) * 100 : 0}%`, background: 'var(--chart-dep)' }} /><div style={{ width: `${p.value ? (p.earned / p.value) * 100 : 0}%`, background: 'var(--brand)' }} /><div style={{ flex: 1, background: 'var(--good)', opacity: 0.5 }} /></div>
              <div className="legend" style={{ marginTop: 8 }}><span><i style={{ background: 'var(--chart-dep)' }} />{t('sen.fromFamily')}</span><span><i style={{ background: 'var(--brand)' }} />{t('sen.fromMe')}</span><span><i style={{ background: 'var(--good)', opacity: 0.5 }} />{t('sen.growth')}</span></div>
            </div>
          </>
        )}
        {tab === 'deposits' && <Earn d={d} />}
        {tab === 'plan' && <div className="card"><WishPlanner d={d} /></div>}
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
  const [ask, setAsk] = useState<{ wishId?: number; amount: string; note: string } | null>(null);
  const [err, setErr] = useState('');
  const fundOpen = d.child.accountStatus === 'active';
  const at21 = (a: number) => a * Math.pow(1 + p.growthRate, p.yearsTo21);
  const run = async (fn: () => Promise<Planner>) => { setErr(''); try { setP(await fn()); return true; } catch (x) { setErr(errText(x)); return false; } };
  const b = p.budget;
  return (
    <div className="stack">
      <div className="row between">
        <h2 style={{ margin: 0 }}>{t(simple ? 'young.wishesTitle' : 'plan.kidTitle')}</h2>
        <span className="pill gold">{t('plan.kidBudget', { amount: fmtMoney(b.available) })}</span>
      </div>
      <p className="small muted" style={{ margin: 0 }}>{t('plan.kidBudgetDesc', { pct: b.pct, date: fmtDate(b.resetsOn) })}</p>
      {p.wishes.map((w) => (
        <div key={w.id} className="list-row">
          <span style={{ fontSize: simple ? 34 : 24 }} aria-hidden>{w.icon}</span>
          <span style={{ flex: 1 }}><b>{w.title}</b><div className="small muted">{fmtMoney(w.targetAmount)}{w.targetDate ? ` · ${fmtDate(w.targetDate)}` : ''} · {t('plan.orAt21', { amount: fmtMoney(w.costAt21) })}</div></span>
          {w.status === 'done' ? <span className="pill good">✓</span> : fundOpen && b.available > 0 && <button className="btn sm secondary" onClick={() => setAsk({ wishId: w.id, amount: String(Math.min(w.targetAmount, b.available) / 100), note: '' })}>{t('plan.ask')}</button>}
        </div>
      ))}
      {ask && (
        <div className="card" style={{ background: 'var(--surface-2)' }}>
          <label className="field"><span>{t('plan.askAmount')}</span><input type="number" dir="ltr" value={ask.amount} onChange={(e) => setAsk({ ...ask, amount: e.target.value })} max={b.available / 100} /></label>
          <div className="banner small" style={{ marginTop: 8 }}>🌱 {t('plan.nudge', { amount: fmtMoney(Number(ask.amount) * 100), at21: fmtMoney(at21(Number(ask.amount) * 100)), half: fmtMoney(Number(ask.amount) * 50) })}</div>
          <label className="field" style={{ marginTop: 8 }}><span>{t('plan.note')}</span><input value={ask.note} onChange={(e) => setAsk({ ...ask, note: e.target.value })} /></label>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn sm" onClick={async () => { if (await run(() => api('/kid/withdrawals', { body: { amount: Number(ask.amount), wishId: ask.wishId, note: ask.note } }))) setAsk(null); }}>{t('plan.send')}</button>
            <button className="btn ghost sm" onClick={() => setAsk({ ...ask, amount: String(Math.floor(Number(ask.amount) / 2)) })}>{t('plan.halfIt')}</button>
            <button className="btn ghost sm" onClick={() => setAsk(null)}>{t('common.cancel')}</button>
          </div>
          <p className="small muted" style={{ margin: '8px 0 0' }}>{t('plan.parentsApprove')}</p>
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


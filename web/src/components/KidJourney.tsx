import { useEffect, useState } from 'react';
import { useI18n } from '../i18n';
import { api } from '../lib/api';
import { RISKS, riskForTrack } from './ScenarioCalc';

type Kind = 'gifts' | 'monthly' | 'work' | 'army';
type Year = { age: number; partial: boolean; in: Record<Kind, number>; took: { amount: number; title?: string; icon?: string; planned?: number }[]; value: number };
type JourneyData = { birthDate: string; today: string; track: string; years: Year[] };

const STAGES = [
  { id: 'early', from: 0, to: 6 },
  { id: 'primary', from: 6, to: 12 },
  { id: 'middle', from: 12, to: 15 },
  { id: 'high', from: 15, to: 18 },
  { id: 'adult', from: 18, to: 21 },
] as const;
const sumIn = (y: Year) => y.in.gifts + y.in.monthly + y.in.work + y.in.army;

/**
 * The child's own view of their savings: what came in and what went to planned goals at each
 * stage, where it stands today, and ideas for the next stage. No "plan vs actual": looking back
 * at a missed ideal only blames past choices, so this looks forward instead.
 */
export function KidJourney({ adult, simple }: { adult?: boolean; simple?: boolean }) {
  const { t, fmtMoney } = useI18n();
  const [j, setJ] = useState<JourneyData | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api<JourneyData>('/kid/journey').then(setJ).catch(() => {}); }, []);
  if (!j || !j.years.length) return null;

  const age = (Date.parse(j.today) - Date.parse(j.birthDate)) / 864e5 / 365.25;
  const risk = riskForTrack(j.track);
  const rate = RISKS.find((r) => r.id === risk)!.rate;
  const riskName = t(`calc.risk.${risk}` as any);
  const now = j.years[j.years.length - 1].value;
  const putIn = j.years.reduce((s, y) => s + sumIn(y), 0);
  const tookAll = j.years.flatMap((y) => y.took);
  const out = tookAll.reduce((s, w) => s + w.amount, 0);
  const grown = Math.max(0, now - (putIn - out));
  const work = j.years.reduce((s, y) => s + y.in.work, 0);
  const army = j.years.reduce((s, y) => s + y.in.army, 0);

  const stages = STAGES.map((st) => {
    const ys = j.years.filter((y) => y.age >= st.from && y.age < st.to);
    if (!ys.length) return null;
    const took = ys.flatMap((y) => y.took);
    return { ...st, current: age < st.to, in: ys.reduce((s, y) => s + sumIn(y), 0), took, value: ys[ys.length - 1].value };
  }).filter(Boolean) as { id: string; from: number; to: number; current: boolean; in: number; took: Year['took']; value: number }[];

  // Ideas for the road to the end of the current stage.
  const cur = STAGES.find((s) => age < s.to);
  const next = cur && STAGES[STAGES.indexOf(cur) + 1];
  const monthly = age < 12 ? 5000 : age < 18 ? 10000 : 20000; // agorot
  const months = cur ? Math.max(1, Math.round((cur.to - age) * 12)) : 0;
  const m = Math.pow(1 + rate, 1 / 12);
  const more = months ? Math.round((monthly * (Math.pow(m, months) - 1)) / (m - 1)) : 0;
  const recs = [
    cur && t('kj.rec.monthly', { amount: fmtMoney(monthly), age: cur.to, more: fmtMoney(more) }),
    t(out > 0 && tookAll.some((w) => w.planned && w.planned > w.amount) ? 'kj.rec.tookPart' : 'kj.rec.planGoal'),
    age >= 14 && (work > 0 ? t('kj.rec.workKeep', { amount: fmtMoney(work) }) : age < 18 && t('kj.rec.workStart')),
    age >= 18 && age < 21 && army === 0 && t('kj.rec.army'),
    t('kj.rec.track'),
  ].filter(Boolean) as string[];

  // Looking forward only: today's value at each risk level, with no further deposits.
  const horizons = [18, 21].filter((a) => a > age + 0.25);
  const ahead = (r: number, a: number) => Math.round(now * Math.pow(1 + r, a - age));
  const minor = !adult && age < 18;

  const book = async () => {
    setBusy(true);
    try { const r = await api<{ house: string }>('/kid/advisor', { body: {} }); setSent(t('kj.booked', { house: r.house })); }
    finally { setBusy(false); }
  };

  return (
    <section className="card stack kj">
      <div className="card-head">
        <h3>📒 {t('kj.title')}</h3>
        <span className="small muted">{t('kj.sub')}</span>
      </div>

      <ol className="kj-stages">
        {stages.map((s) => (
          <li key={s.id} className={s.current ? 'now' : ''}>
            <div className="kj-stage-head">
              <b>{t(`kj.stage.${s.id}` as any)}</b>
              <span className="small muted">{t('kj.ages', { from: s.from, to: s.to })}{s.current && <> · <em>{t('kj.now')}</em></>}</span>
            </div>
            <div className="kj-row"><span>{t('kj.in')}</span><b className="num">{fmtMoney(s.in)}</b></div>
            <div className="kj-row">
              <span>{t('kj.out')}</span>
              {s.took.length ? <b className="num">{fmtMoney(s.took.reduce((a, w) => a + w.amount, 0))}</b> : <span className="small muted">{t('kj.noOut')}</span>}
            </div>
            {s.took.map((w, i) => (
              <div key={i} className="kj-goal small">{w.icon} {w.title} · <b className="num">{fmtMoney(w.amount)}</b>{w.planned && w.planned > w.amount ? <span className="muted"> {t('kj.ofPlanned', { amount: fmtMoney(w.planned) })}</span> : null}</div>
            ))}
            <div className="kj-row kj-value"><span>{s.current ? t('kj.valueNow') : t('kj.value')}</span><b className="num">{fmtMoney(s.value)}</b></div>
          </li>
        ))}
      </ol>

      <div className="kj-now">
        <span className="small muted">{t('kj.current')}</span>
        <b className="num">{fmtMoney(now)}</b>
        <p style={{ margin: 0 }}>{t('kj.currentLine', { value: fmtMoney(now), risk: riskName, grown: fmtMoney(grown) })}</p>
      </div>

      <div className="stack" style={{ gap: 8 }}>
        <h4 style={{ margin: 0 }}>💡 {next ? t('kj.recsTitle', { stage: t(`kj.stage.${next.id}` as any) }) : t('kj.recsTitleEnd')}</h4>
        <ul className="kj-recs">{recs.map((r, i) => <li key={i}>{r}</li>)}</ul>
      </div>

      {!simple && horizons.length > 0 && (
        <div className="stack" style={{ gap: 8 }}>
          <h4 style={{ margin: 0 }}>🧭 {t('kj.tracksTitle')}</h4>
          <p className="small muted" style={{ margin: 0 }}>{t('kj.tracksSub', { value: fmtMoney(now) })}</p>
          <div className="kj-tracks">
            {RISKS.map((r) => (
              <div key={r.id} className={'kj-track' + (r.id === risk ? ' on' : '')}>
                <div className="kj-track-head"><b>{t(`calc.risk.${r.id}` as any)}</b><span className="small muted">~{(r.rate * 100).toLocaleString('en', { maximumFractionDigits: 1 })}%{r.id === risk && <> · <em>{t('kj.yours')}</em></>}</span></div>
                <p className="small" style={{ margin: 0 }}>{t(`kj.mean.${r.id}` as any)}</p>
                <div className="kj-track-vals">{horizons.map((a) => <span key={a}>{t('calc.atAge', { age: a })} <b className="num">{fmtMoney(ahead(r.rate, a))}</b></span>)}</div>
              </div>
            ))}
          </div>
          <p className="tiny muted" style={{ margin: 0 }}>ⓘ {t('calc.noGuarantee')}</p>
        </div>
      )}

      <div className="kj-advice">
        <b>{t('kj.beforeTitle')}</b>
        <p style={{ margin: 0 }}>{t(minor ? 'kj.adviceMinor' : 'kj.advice')}</p>
        {/* Until 18 only a parent books the advisor, from the parent screen (AdvisorCard). */}
        {!minor && (sent ? <p className="kj-sent" role="status">✓ {sent}</p> : <button className="btn sm" onClick={book} disabled={busy}>📅 {t('kj.book')}</button>)}
      </div>
    </section>
  );
}

/** Parent screen: book the fund's investment advisor for a child under 18 (only a parent can). */
export function AdvisorCard({ childId, name }: { childId: number | string; name: string }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState('');
  const book = async () => {
    setBusy(true);
    try { const r = await api<{ house: string }>(`/children/${childId}/advisor`, { body: {} }); setSent(t('kj.booked', { house: r.house }) + t('kj.bookedMinor')); }
    finally { setBusy(false); }
  };
  return (
    <div className="card kj-advice">
      <b>{t('kj.beforeTitle')}</b>
      <p style={{ margin: 0 }}>{t('kj.parentAdvice', { name })}</p>
      {sent ? <p className="kj-sent" role="status">✓ {sent}</p> : <button className="btn sm" onClick={book} disabled={busy}>📅 {t('kj.bookMinor')}</button>}
    </div>
  );
}

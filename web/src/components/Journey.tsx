import { useEffect, useState } from 'react';
import { useI18n } from '../i18n';
import { api } from '../lib/api';
import { DEFAULT_ROWS, RISKS, perYearAt, riskForTrack, type RiskId } from './ScenarioCalc';

type Kind = 'gifts' | 'monthly' | 'work' | 'army';
type Year = { age: number; from: string; to: string; partial: boolean; in: Record<Kind, number>; out: number; took: { amount: number; title?: string; icon?: string; planned?: number; purpose: string }[]; value: number };
type JourneyData = { birthDate: string; today: string; track: string; years: Year[]; flows: { date: string; amount: number }[] };
const KINDS: Kind[] = ['monthly', 'gifts', 'work', 'army'];
const DAY = 86400000;

/** The same dated deposits and withdrawals, grown at a fixed yearly rate until today. */
function replay(flows: JourneyData['flows'], rate: number, until: string) {
  let v = 0, last = flows[0]?.date || until;
  const grow = (to: string) => { v *= Math.pow(1 + rate, (Date.parse(to) - Date.parse(last)) / DAY / 365); last = to; };
  for (const f of flows) { grow(f.date); v = Math.max(0, v + f.amount); }
  grow(until);
  return Math.round(v);
}

/** The model plan (the calculator's sample family) from birth, at a rate: value at the end of each year of age. */
function planByYear(years: Year[], rate: number) {
  const m = Math.pow(1 + rate, 1 / 12);
  let v = 0;
  return years.map((y) => {
    const months = y.partial ? Math.max(0, Math.round((Date.parse(y.to) - Date.parse(y.from)) / DAY / 30.44)) : 12;
    const put = perYearAt(DEFAULT_ROWS, y.age);
    for (let i = 0; i < months; i++) v = v * m + put / 12;
    return { put: Math.round((put * months) / 12), value: Math.round(v) };
  });
}

/**
 * "Plan vs actual": what the family and the child really put in each year, what was taken out
 * for planned gifts (and how much of each was planned), and where that left the savings, next to
 * the model plan and the same money at the other risk levels. `simple` is the version for young kids.
 */
export function Journey({ path, simple, self }: { path: string; simple?: boolean; self?: boolean }) {
  const { t, fmtMoney } = useI18n();
  const [j, setJ] = useState<JourneyData | null>(null);
  const [all, setAll] = useState(false);
  useEffect(() => { api<JourneyData>(path).then(setJ).catch(() => {}); }, [path]);
  if (!j || !j.years.length) return null;
  const mine: RiskId = riskForTrack(j.track);
  const rate = RISKS.find((r) => r.id === mine)!.rate;
  const plan = planByYear(j.years, rate);
  const actual = j.years[j.years.length - 1].value;
  const planNow = plan[plan.length - 1].value;
  const sum = (k: Kind) => j.years.reduce((s, y) => s + y.in[k], 0);
  const putIn = KINDS.reduce((s, k) => s + sum(k), 0);
  const fullYears = Math.max(1, j.years.filter((y) => !y.partial).length);
  const took = j.years.flatMap((y) => y.took);
  const tookSum = took.reduce((s, w) => s + w.amount, 0);
  const plannedSum = took.reduce((s, w) => s + (w.planned || w.amount), 0);
  // The same money at each level, anchored on what really happened on the child's own track.
  const raw = Object.fromEntries(RISKS.map((r) => [r.id, replay(j.flows, r.rate, j.today)])) as Record<RiskId, number>;
  const at = Object.fromEntries(RISKS.map((r) => [r.id, r.id === mine || !raw[mine] ? (r.id === mine ? actual : raw[r.id]) : Math.round((actual * raw[r.id]) / raw[mine])])) as Record<RiskId, number>;
  const riskName = (id: RiskId) => t(`calc.risk.${id}` as any);
  const others = RISKS.filter((r) => r.id !== mine);
  const you = self === false ? 'p' : 'k'; // parent wording vs the child's own

  const story = [
    t(`jr.${you}.avg` as any, { amount: fmtMoney(putIn / fullYears) }),
    tookSum > 0 && t(`jr.${you}.took` as any, { amount: fmtMoney(tookSum), planned: fmtMoney(plannedSum) }),
    sum('work') > 0 && t(`jr.${you}.work` as any, { amount: fmtMoney(sum('work')) }),
    sum('army') > 0 && t(`jr.${you}.army` as any, { amount: fmtMoney(sum('army')) }),
    t(`jr.${you}.risk` as any, { risk: riskName(mine), amount: fmtMoney(actual) }),
    t('jr.other', { a: riskName(others[0].id), x: fmtMoney(at[others[0].id]), b: riskName(others[1].id), y: fmtMoney(at[others[1].id]) }),
  ].filter(Boolean) as string[];

  // Chart: value at the end of each year, actual against the plan.
  const W = 640, H = 200, P = 8;
  const max = Math.max(...j.years.map((y) => y.value), ...plan.map((x) => x.value), 1);
  const xs = (i: number) => P + (i * (W - 2 * P)) / Math.max(1, j.years.length - 1);
  const ys = (v: number) => H - P - (v / max) * (H - 2 * P);
  const line = (vals: number[]) => vals.map((v, i) => `${i ? 'L' : 'M'}${xs(i).toFixed(1)} ${ys(v).toFixed(1)}`).join(' ');
  const shown = all ? j.years : j.years.slice(-6);

  return (
    <section className="card stack journey">
      <div className="card-head">
        <h3>📒 {t(simple ? 'jr.titleKid' : 'jr.title')}</h3>
        <span className="small muted">{t('jr.sub', { n: j.years.length })}</span>
      </div>

      <div className="jr-compare">
        <div className="jr-tile main"><span>{t('jr.actual')}</span><b className="num">{fmtMoney(actual)}</b><small>{t('jr.putIn', { amount: fmtMoney(putIn - tookSum) })}</small></div>
        <div className="jr-tile"><span>{t('jr.plan')}</span><b className="num">{fmtMoney(planNow)}</b><small>{t('jr.planNote', { risk: riskName(mine) })}</small></div>
        <div className={'jr-tile ' + (actual >= planNow ? 'ahead' : 'behind')}><span>{t(actual >= planNow ? 'jr.ahead' : 'jr.behind')}</span><b className="num">{fmtMoney(Math.abs(actual - planNow))}</b><small>{Math.round((actual / Math.max(1, planNow)) * 100)}% {t('jr.ofPlan')}</small></div>
      </div>

      <ul className="jr-story">{story.map((s, i) => <li key={i}>{s}</li>)}</ul>

      <div>
        <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('jr.chartLabel')}>
          {[0.25, 0.5, 0.75].map((f) => <line key={f} x1={P} x2={W - P} y1={ys(max * f)} y2={ys(max * f)} stroke="var(--line)" strokeWidth="1" />)}
          <path d={line(plan.map((x) => x.value))} fill="none" stroke="var(--muted)" strokeWidth="2" strokeDasharray="6 5" />
          <path d={line(j.years.map((y) => y.value))} fill="none" stroke="var(--growth)" strokeWidth="2.5" />
          {j.years.map((y, i) => <circle key={y.age} cx={xs(i)} cy={ys(y.value)} r={y.took.length ? 5 : 3} fill={y.took.length ? 'var(--accent)' : 'var(--growth)'} stroke="var(--surface)" strokeWidth="2"><title>{t('calc.atAge', { age: y.age })}: {fmtMoney(y.value)} · {t('jr.plan')}: {fmtMoney(plan[i].value)}</title></circle>)}
        </svg>
        <div className="legend">
          <span><i style={{ background: 'var(--growth)' }} />{t('jr.actual')}</span>
          <span><i style={{ background: 'var(--muted)' }} />{t('jr.plan')}</span>
          <span><i style={{ background: 'var(--accent)', borderRadius: '50%' }} />{t('jr.tookDot')}</span>
        </div>
      </div>

      <div className="jr-risks">
        {RISKS.map((r) => (
          <div key={r.id} className={'jr-risk' + (r.id === mine ? ' on' : '')}>
            <span>{riskName(r.id)} · {(r.rate * 100).toLocaleString('en', { maximumFractionDigits: 1 })}%{r.id === mine && <em> · {t('jr.yours')}</em>}</span>
            <b className="num">{fmtMoney(at[r.id])}</b>
          </div>
        ))}
      </div>
      <p className="tiny muted" style={{ margin: 0 }}>ⓘ {t('jr.riskNote')}</p>

      {!simple && (
        <div className="table-wrap">
          <table className="table jr-table">
            <thead><tr><th>{t('jr.col.age')}</th><th>{t('jr.col.in')}</th><th className="num">{t('jr.col.planIn')}</th><th>{t('jr.col.out')}</th><th className="num">{t('jr.col.value')}</th><th className="num">{t('jr.col.planValue')}</th></tr></thead>
            <tbody>
              {shown.map((y) => {
                const i = j.years.indexOf(y);
                const inn = KINDS.reduce((s, k) => s + y.in[k], 0);
                return (
                  <tr key={y.age}>
                    <td><b>{y.age}</b>{y.partial && <span className="small muted"> · {t('jr.soFar')}</span>}</td>
                    <td><b className="num">{fmtMoney(inn)}</b><div className="jr-kinds">{KINDS.filter((k) => y.in[k] > 0).map((k) => <span key={k} className={'jr-kind ' + k}>{t(`jr.kind.${k}` as any)} {fmtMoney(y.in[k])}</span>)}</div></td>
                    <td className="num muted">{fmtMoney(plan[i].put)}</td>
                    <td>{y.took.length ? y.took.map((w, n) => <div key={n} className="small">{w.icon} {w.title || t('jr.withdrawal')}: <b className="num">{fmtMoney(w.amount)}</b>{w.planned ? <span className="muted"> {t('jr.ofPlanned', { amount: fmtMoney(w.planned) })}</span> : null}</div>) : <span className="muted">—</span>}</td>
                    <td className="num"><b>{fmtMoney(y.value)}</b></td>
                    <td className="num muted">{fmtMoney(plan[i].value)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {j.years.length > 6 && <button className="btn ghost sm" onClick={() => setAll(!all)}>{all ? t('jr.less') : t('jr.all', { n: j.years.length })}</button>}
        </div>
      )}
      <p className="tiny muted" style={{ margin: 0 }}>{t('jr.planDef')}</p>
    </section>
  );
}

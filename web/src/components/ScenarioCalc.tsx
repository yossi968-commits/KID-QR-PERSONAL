import { useState } from 'react';
import { useI18n } from '../i18n';

/** Assumed yearly returns for the three risk levels. An illustration, never a promise. */
export const RISKS = [
  { id: 'solid', rate: 0.045 },
  { id: 'conservative', rate: 0.065 },
  { id: 'adventurous', rate: 0.085 },
] as const;
export type RiskId = (typeof RISKS)[number]['id'];

/** The calculator's risk level that matches a fund track. */
export function riskForTrack(track?: string): RiskId {
  if (track === 'solid') return 'solid';
  if (track === 'equity' || track === 'sp500') return 'adventurous';
  return 'conservative';
}

/** Who gives what, how often a year, and between which ages (work from 14, army salary 18–21). */
export type Row = { key: string; title?: string; amount: number; times: number; from?: number; to?: number };
export const DEFAULT_ROWS: Row[] = [
  { key: 'parents', amount: 120, times: 12 },
  { key: 'grand', amount: 100, times: 5 },
  { key: 'friends', amount: 100, times: 20 },
  { key: 'work', amount: 100, times: 12, from: 14, to: 18 },
  { key: 'army', amount: 200, times: 12, from: 18, to: 21 },
];
const END = 21;
const active = (r: Row, age: number) => age >= (r.from ?? 0) && age < (r.to ?? END);
/** Yearly amount (agorot) the rows put in at a given age. */
export const perYearAt = (rows: Row[], age: number) => rows.reduce((s, r) => s + (active(r, age) ? (r.amount || 0) * (r.times || 0) : 0), 0) * 100;

/** Value at each target age (all amounts in agorot), money in at the end of every month, compounding monthly. */
export function project(startValue: number, startAge: number, rows: Row[], rate: number, ages: number[]) {
  const m = Math.pow(1 + rate, 1 / 12);
  const out: Record<number, { value: number; deposited: number }> = {};
  for (const a of ages) {
    let v = startValue, dep = startValue;
    for (let i = 0; i < Math.round((a - startAge) * 12); i++) {
      const add = perYearAt(rows, startAge + i / 12) / 12;
      v = v * m + add; dep += add;
    }
    out[a] = { value: Math.round(v), deposited: Math.round(dep) };
  }
  return out;
}

/**
 * "How much could it be?": the parent picks a risk level and edits who gives what and how
 * often (parents monthly, grandparents, friends and family), and sees the total at 13, 18 and 21.
 */
export function ScenarioCalc({ startAge = 0, startValue = 0, risk: initial = 'conservative', name }: { startAge?: number; /** agorot */ startValue?: number; risk?: RiskId; name?: string }) {
  const { t, fmtMoney } = useI18n();
  const [risk, setRisk] = useState<RiskId>(initial);
  const [rows, setRows] = useState<Row[]>(DEFAULT_ROWS);
  const rate = RISKS.find((r) => r.id === risk)!.rate;
  const perYear = perYearAt(rows, startAge);
  const ages = [13, 18, 21].filter((a) => a > startAge);
  if (!ages.length) ages.push(Math.floor(startAge) + 10);
  const res = project(startValue, startAge, rows, rate, ages);
  const set = (i: number, patch: Partial<Row>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const pct = (r: number) => (r * 100).toLocaleString('en', { maximumFractionDigits: 1 }) + '%';

  return (
    <section className="card stack calc">
      <div className="card-head">
        <h3>🧮 {name ? t('calc.titleFor', { name }) : t('calc.title')}</h3>
        <span className="pill brand num">{fmtMoney(perYear)} {t('common.perYear')}</span>
      </div>

      <div>
        <span className="field-label">{t('calc.risk')}</span>
        <div className="risk-pick" role="radiogroup" aria-label={t('calc.risk')}>
          {RISKS.map((r) => (
            <button key={r.id} type="button" role="radio" aria-checked={risk === r.id} className={'chip' + (risk === r.id ? ' on' : '')} onClick={() => setRisk(r.id)}>
              <span>{t(`calc.risk.${r.id}` as any)}</span>
              <b className="num">{pct(r.rate)}</b>
            </button>
          ))}
        </div>
        <p className="tiny muted" style={{ margin: '6px 0 0' }}>ⓘ {t('calc.noGuarantee')}</p>
      </div>

      <div className="calc-rows">
        {rows.map((r, i) => (
          <div key={i} className="calc-row">
            <div className="calc-who">
              {r.title != null
                ? <input value={r.title} onChange={(e) => set(i, { title: e.target.value })} placeholder={t('calc.customPh')} aria-label={t('calc.customPh')} />
                : <span className="calc-line"><b>{t(`calc.row.${r.key}` as any)}</b> <span className="muted">{t(`calc.row.${r.key}Hint` as any)}</span></span>}
              {(r.from != null || r.to != null) && <span className="calc-ages">{t('calc.ages', { from: r.from ?? 0, to: r.to ?? END })}</span>}
            </div>
            <label className="calc-num"><span>₪</span><input type="number" min={0} dir="ltr" value={r.amount} onChange={(e) => set(i, { amount: Math.max(0, +e.target.value) })} aria-label={t('calc.amount')} /></label>
            <span className="muted" aria-hidden>×</span>
            <label className="calc-num"><input type="number" min={0} max={365} dir="ltr" value={r.times} onChange={(e) => set(i, { times: Math.max(0, +e.target.value) })} aria-label={t('calc.times')} /><span>{t('calc.perYear')}</span></label>
            <button type="button" className="btn ghost sm calc-x" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label={t('calc.remove')}>✕</button>
          </div>
        ))}
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="btn ghost sm" onClick={() => setRows([...rows, { key: 'custom', title: '', amount: 100, times: 1 }])}>+ {t('calc.addRow')}</button>
          <button type="button" className="btn ghost sm" onClick={() => setRows(DEFAULT_ROWS)}>{t('calc.reset')}</button>
        </div>
      </div>

      <div className="calc-results">
        {ages.map((a) => {
          const x = res[a];
          const grown = Math.max(0, x.value - x.deposited);
          return (
            <div key={a} className={'calc-res' + (a === 18 ? ' main' : '')}>
              <span className="small muted">{t('calc.atAge', { age: a })}</span>
              <b className="num">{fmtMoney(x.value)}</b>
              <div className="split-bar" aria-hidden><i className="sb-dep" style={{ flexGrow: x.deposited }} />{grown > 0 && <i className="sb-grown" style={{ flexGrow: grown }} />}</div>
              <small className="calc-leg"><span><i className="sb-dep" />{t('calc.dep')} <b className="num">{fmtMoney(x.deposited)}</b></span><span><i className="sb-grown" />{t('calc.grown')} <b className="num">{fmtMoney(grown)}</b></span></small>
            </div>
          );
        })}
      </div>
      <p className="tiny muted" style={{ margin: 0 }}>{startValue > 0 ? t('calc.noteFrom', { amount: fmtMoney(startValue), age: Math.floor(startAge) }) : t('calc.note')}</p>
    </section>
  );
}

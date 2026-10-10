import { useEffect, useState, type FormEvent } from 'react';
import { useI18n } from '../../i18n';
import { api, type ChildData, type Planner, type Withdrawal } from '../../lib/api';
import { Kpis, useLabels } from '../../components/ui';
import { useErr } from '../Auth';

const PAYOUT = ['bit', 'paybox', 'card', 'bank'];

/**
 * Planned gifts and withdrawals. Each year the child may take up to a share of the
 * gifts received since the last birthday; both parents sign, and the money goes to
 * the parent's own Bit, PayBox, card or bank account.
 */
export default function PlannerTab({ data }: { data: ChildData }) {
  const { t, fmtMoney, fmtDate } = useI18n();
  const L = useLabels();
  const errText = useErr();
  const { child } = data;
  const base = `/children/${child.id}`;
  const [p, setP] = useState<Planner | null>(null);
  const [pct, setPct] = useState(25);
  const [wish, setWish] = useState({ title: '', icon: '🎁', targetAmount: '', targetDate: '' });
  const [err, setErr] = useState('');
  useEffect(() => { api<Planner>(`${base}/planner`).then((r) => { setP(r); setPct(r.budget.pct); }); }, [base]);
  if (!p) return null;
  const b = p.budget;
  const run = async (fn: () => Promise<Planner>) => { setErr(''); try { setP(await fn()); } catch (x) { setErr(errText(x)); } };
  const addWish = (e: FormEvent) => { e.preventDefault(); run(() => api(`${base}/wishes`, { body: { ...wish, targetAmount: Number(wish.targetAmount) } })).then(() => setWish({ title: '', icon: '🎁', targetAmount: '', targetDate: '' })); };
  const pending = p.withdrawals.filter((w) => w.status === 'requested');
  const fundOpen = child.accountStatus === 'active';

  return (
    <div className="stack">
      <Kpis items={[
        { label: t('plan.available'), value: fmtMoney(b.available), sub: t('plan.resets', { date: fmtDate(b.resetsOn) }) },
        { label: t('plan.yearGifts'), value: fmtMoney(b.yearGifts), sub: t('plan.since', { date: fmtDate(b.since) }) },
        { label: t('plan.allowed', { pct: b.pct }), value: fmtMoney(b.allowed) },
        { label: t('plan.used'), value: fmtMoney(b.used) },
      ]} />
      {err && <div className="error" role="alert">{err}</div>}

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <div className="card stack">
          <div className="card-head"><h3>{t('plan.requests')}</h3><span className="pill gold num">{pending.length}</span></div>
          {!fundOpen && <div className="banner small">{t('plan.fundClosed')}</div>}
          {pending.length === 0 && <p className="muted small" style={{ margin: 0 }}>{t('plan.noRequests')}</p>}
          {pending.map((w) => <Approve key={w.id} w={w} wishTitle={p.wishes.find((x) => x.id === w.wishId)?.title} growth={p.growthRate} years={p.yearsTo21} onDone={(np) => setP(np)} base={base} />)}
        </div>

        <div className="card stack">
          <h3 style={{ margin: 0 }}>{t('plan.policy')}</h3>
          <p className="small muted" style={{ margin: 0 }}>{t('plan.policyDesc', { name: child.firstName })}</p>
          <label className="field"><span>{t('plan.pct')}: <b className="num">{pct}%</b></span>
            <input type="range" min={0} max={50} step={5} value={pct} onChange={(e) => setPct(+e.target.value)} onMouseUp={() => run(() => api(`${base}/withdraw-pct`, { body: { pct } }))} onTouchEnd={() => run(() => api(`${base}/withdraw-pct`, { body: { pct } }))} onKeyUp={() => run(() => api(`${base}/withdraw-pct`, { body: { pct } }))} />
          </label>
          <ul className="small muted" style={{ margin: 0, paddingInlineStart: 18 }}>
            <li>{t('plan.rule1')}</li><li>{t('plan.rule2')}</li><li>{t('plan.rule3', { pct: Math.round(p.taxRate * 100) })}</li>
          </ul>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="card-head" style={{ padding: '16px 20px 0' }}><h3>{t('plan.wishes')}</h3><span className="small muted">{t('plan.wishesDesc')}</span></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>{t('plan.col.wish')}</th><th>{t('plan.col.when')}</th><th className="num">{t('plan.col.cost')}</th><th className="num">{t('plan.col.at21')}</th><th>{t('plan.col.by')}</th><th>{t('money.col.status')}</th><th /></tr></thead>
            <tbody>
              {p.wishes.map((w) => (
                <tr key={w.id}>
                  <td><span aria-hidden>{w.icon}</span> <b>{w.title}</b></td>
                  <td>{w.targetDate ? fmtDate(w.targetDate) : '—'}</td>
                  <td className="num">{fmtMoney(w.targetAmount)}</td>
                  <td className="num muted">{fmtMoney(w.costAt21)}</td>
                  <td className="small">{t(`plan.by.${w.createdBy}` as any)}</td>
                  <td>{w.status === 'done' ? <span className="pill good">{t('plan.done')}</span> : w.withdrawn ? <span className="pill brand">{fmtMoney(w.withdrawn)}</span> : <span className="pill">{t('plan.planned')}</span>}</td>
                  <td>{w.status !== 'done' && <button className="btn ghost sm" onClick={() => run(() => api(`${base}/wishes/${w.id}`, { method: 'DELETE' }))}>{t('plan.remove')}</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form className="row" style={{ padding: 16, borderTop: 'var(--border)' }} onSubmit={addWish}>
          <select value={wish.icon} onChange={(e) => setWish({ ...wish, icon: e.target.value })} style={{ width: 70 }} aria-label="icon">{['🎁', '🚲', '💻', '📱', '✈️', '🎸', '🚗', '🎓', '⚽'].map((i) => <option key={i}>{i}</option>)}</select>
          <input value={wish.title} onChange={(e) => setWish({ ...wish, title: e.target.value })} placeholder={t('plan.wishPh')} required style={{ flex: 2, minWidth: 140 }} />
          <input type="number" dir="ltr" value={wish.targetAmount} onChange={(e) => setWish({ ...wish, targetAmount: e.target.value })} placeholder="₪" required style={{ flex: 1, minWidth: 90 }} />
          <input type="date" value={wish.targetDate} onChange={(e) => setWish({ ...wish, targetDate: e.target.value })} style={{ flex: 1, minWidth: 140 }} aria-label={t('plan.col.when')} />
          <button className="btn secondary">{t('plan.addWish')}</button>
        </form>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="card-head" style={{ padding: '16px 20px 0' }}><h3>{t('plan.history')}</h3></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>{t('money.col.date')}</th><th className="num">{t('money.col.amount')}</th><th>{t('plan.col.by')}</th><th>{t('plan.col.to')}</th><th className="num">{t('plan.col.tax')}</th><th>{t('money.col.status')}</th></tr></thead>
            <tbody>{p.withdrawals.filter((w) => w.status !== 'requested').map((w) => (
              <tr key={w.id}><td>{fmtDate(w.decidedAt || w.createdAt)}</td><td className="num">{fmtMoney(w.amount)}</td><td className="small">{t(`plan.by.${w.requestedBy}` as any)}</td><td className="small">{w.method ? `${L.method(w.method)} · ${w.destination}` : '—'}</td><td className="num small">{fmtMoney(w.taxEstimate)}</td><td><span className={'pill' + (w.status === 'paid' ? ' good' : ' bad')}>{t(`wd.${w.status}` as any)}</span></td></tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Approve({ w, wishTitle, growth, years, base, onDone }: { w: Withdrawal; wishTitle?: string; growth: number; years: number; base: string; onDone: (p: Planner) => void }) {
  const { t, fmtMoney, fmtDate } = useI18n();
  const errText = useErr();
  const [method, setMethod] = useState('bit');
  const [dest, setDest] = useState('');
  const [co, setCo] = useState(false);
  const [err, setErr] = useState('');
  const act = async (kind: 'approve' | 'reject') => {
    setErr('');
    try { onDone(await api(`${base}/withdrawals/${w.id}/${kind}`, { body: kind === 'approve' ? { method, destination: dest, coSigned: co } : {} })); } catch (x) { setErr(errText(x)); }
  };
  return (
    <div className="card" style={{ background: 'var(--surface-2)', padding: 14 }}>
      <div className="row between"><b>{wishTitle || t('plan.request')}</b><b className="num">{fmtMoney(w.amount)}</b></div>
      <div className="small muted">{fmtDate(w.createdAt)}{w.note ? ` · “${w.note}”` : ''}</div>
      <div className="small" style={{ marginTop: 6 }}>{t('plan.wouldBe', { amount: fmtMoney(w.amount * Math.pow(1 + growth, years)), n: years })} · {t('plan.taxEst', { amount: fmtMoney(w.taxEstimate) })}</div>
      <div className="row" style={{ marginTop: 10 }}>
        <select value={method} onChange={(e) => setMethod(e.target.value)} style={{ width: 'auto' }} aria-label={t('plan.col.to')}>{PAYOUT.map((m) => <option key={m} value={m}>{t(`method.${m}` as any)}</option>)}</select>
        <input value={dest} onChange={(e) => setDest(e.target.value)} placeholder={t(`plan.dest.${method}` as any)} dir="ltr" style={{ flex: 1, minWidth: 140 }} />
      </div>
      <label className="check" style={{ marginTop: 8 }}><input type="checkbox" checked={co} onChange={(e) => setCo(e.target.checked)} />{t('plan.coSign')}</label>
      {err && <div className="error small">{err}</div>}
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn sm" disabled={!dest || !co} onClick={() => act('approve')}>{t('plan.approve')}</button>
        <button className="btn ghost sm" onClick={() => act('reject')}>{t('plan.reject')}</button>
      </div>
    </div>
  );
}

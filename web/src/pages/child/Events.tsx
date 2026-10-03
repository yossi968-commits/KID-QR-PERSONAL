import { useEffect, useState, type FormEvent } from 'react';
import { useI18n } from '../../i18n';
import { api } from '../../lib/api';
import { daysUntil } from '../../lib/util';
import type { ChildData } from './ChildPage';

type Gift = { amount: number; eventTitle?: string };

export default function Events({ data, reload }: { data: ChildData; reload: () => void }) {
  const { t, fmtMoney, fmtDate } = useI18n();
  const { child, events } = data;
  const [f, setF] = useState({ type: 'birthday', title: '', date: '', goalAmount: '' });
  const [raised, setRaised] = useState<Record<string, number>>({});
  useEffect(() => {
    api<{ contributions: Gift[] }>(`/children/${child.id}/contributions`).then((r) => {
      const m: Record<string, number> = {};
      r.contributions.forEach((g) => { if (g.eventTitle) m[g.eventTitle] = (m[g.eventTitle] || 0) + g.amount; });
      setRaised(m);
    });
  }, [child.id, events.length]);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await api(`/children/${child.id}/events`, { body: { ...f, goalAmount: f.goalAmount ? Number(f.goalAmount) : undefined } });
    setF({ type: 'birthday', title: '', date: '', goalAmount: '' });
    reload();
  };
  const close = async (id: number) => { await api(`/children/${child.id}/events/${id}`, { method: 'DELETE' }); reload(); };
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="grid grid-2" style={{ alignItems: 'start' }}>
      <div className="stack">
        <h3>{t('events.title')}</h3>
        <p className="muted small">{t('events.desc')}</p>
        {events.map((e) => {
          const active = e.active && e.date >= today;
          const r = raised[e.title] || 0;
          return (
            <div key={e.id} className="card flat" style={{ padding: 14 }}>
              <div className="row between">
                <div><strong>{e.title}</strong> <span className="small muted">· {fmtDate(e.date)}</span></div>
                {active ? <span className="pill brand">{t('events.active')} · {t('child.inDays', { n: daysUntil(e.date) })}</span> : <span className="pill">{t('events.past')}</span>}
              </div>
              {(r > 0 || e.goal_amount) && (
                <div style={{ marginTop: 8 }}>
                  <div className="row between small"><span>{t('events.raised')}: <b className="num">{fmtMoney(r)}</b></span>{e.goal_amount ? <span className="num muted">{fmtMoney(e.goal_amount)}</span> : null}</div>
                  {e.goal_amount ? <div className="progress" style={{ marginTop: 4 }}><div style={{ width: Math.min(100, (r / e.goal_amount) * 100) + '%' }} /></div> : null}
                </div>
              )}
              {active ? <button className="btn ghost sm" style={{ marginTop: 6 }} onClick={() => close(e.id)}>{t('events.close')}</button> : null}
            </div>
          );
        })}
      </div>
      <form className="card stack" onSubmit={submit}>
        <h3>{t('events.new')}</h3>
        <label className="field"><span>{t('events.type')}</span>
          <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
            {['birthday', 'bar_mitzvah', 'holiday', 'other'].map((k) => <option key={k} value={k}>{t(`events.type.${k}` as any)}</option>)}
          </select>
        </label>
        <label className="field"><span>{t('events.titleField')}</span><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required /></label>
        <label className="field"><span>{t('events.date')}</span><input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} required /></label>
        <label className="field"><span>{t('events.goal')}</span><input type="number" min={0} value={f.goalAmount} onChange={(e) => setF({ ...f, goalAmount: e.target.value })} dir="ltr" /></label>
        <button className="btn">{t('events.create')}</button>
      </form>
    </div>
  );
}

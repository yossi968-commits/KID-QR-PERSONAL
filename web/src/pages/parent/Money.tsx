import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../../i18n';
import { api, EVENT_TYPES, type ChildData, type Gift, type Pledge } from '../../lib/api';
import { MethodPicker, goPay, useMethods } from '../../components/Pay';
import { useLabels } from '../../components/ui';
import { useErr } from '../Auth';

const FAMILY_EVENTS = ['brit', 'brita', 'bar_mitzvah', 'bat_mitzvah', 'birthday', 'other'];

/** Every shekel in: guest gifts, employer gifts, event deposits, the child's own money; plus monthly gifts. */
export default function Money({ data }: { data: ChildData; reload: () => void }) {
  const { t, fmtMoney, fmtDate } = useI18n();
  const L = useLabels();
  const { child } = data;
  const [gifts, setGifts] = useState<Gift[] | null>(null);
  const [pledges, setPledges] = useState<Pledge[]>([]);
  const [filter, setFilter] = useState('all');
  const [thanking, setThanking] = useState<number | null>(null);
  const [text, setText] = useState('');
  const load = () => {
    api<{ contributions: Gift[] }>(`/children/${child.id}/contributions`).then((r) => setGifts(r.contributions));
    api<{ pledges: Pledge[] }>(`/children/${child.id}/pledges`).then((r) => setPledges(r.pledges));
  };
  useEffect(load, [child.id]);
  const thank = async (g: Gift) => { await api(`/children/${child.id}/contributions/${g.id}/thank`, { body: { message: text } }); setThanking(null); setText(''); load(); };
  const groups: Record<string, (g: Gift) => boolean> = {
    all: () => true, gift: (g) => g.source === 'gift', employer_gift: (g) => g.source === 'employer_gift', event_gifts: (g) => g.source === 'event_gifts', own: (g) => !['gift', 'employer_gift', 'event_gifts'].includes(g.source),
  };
  const shown = (gifts || []).filter(groups[filter]);

  return (
    <div className="stack">
      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <EventDeposit data={data} />
        <div className="card">
          <div className="card-head"><h3>{t('money.pledges')}</h3><span className="pill num">{pledges.filter((p) => p.status === 'active').length}</span></div>
          {pledges.length === 0 && <p className="muted small">{t('money.noPledges')}</p>}
          {pledges.map((p) => (
            <div key={p.id} className="list-row">
              <div style={{ flex: 1 }}>
                <strong>{p.giverName}</strong> <span className="small muted">· {L.source(p.source)}</span>
                <div className="small muted">{L.method(p.method)} · {p.status === 'active' ? t('money.nextCharge', { date: fmtDate(p.nextDate) }) : t(`pledge.status.${p.status}` as any)} · {t('money.charges', { n: p.charges })}</div>
              </div>
              <b className="num">{fmtMoney(p.amount)}</b>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="card-head" style={{ padding: '16px 20px 0' }}>
          <h3>{t('money.ledger')}</h3>
          <div className="seg" role="group">
            {Object.keys(groups).map((k) => <button key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{t(`money.f.${k}` as any)}</button>)}
          </div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>{t('money.col.date')}</th><th>{t('money.col.from')}</th><th>{t('money.col.type')}</th><th>{t('money.col.method')}</th><th>{t('money.col.event')}</th><th className="num">{t('money.col.amount')}</th><th>{t('money.col.status')}</th><th /></tr></thead>
            <tbody>
              {shown.map((g) => (
                <tr key={g.id}>
                  <td className="num">{fmtDate(g.paidAt)}</td>
                  <td>{g.giverName}{g.sealed ? <div className="sealed small">🔒 {t('gifts.sealed', { age: g.unlockAge! })}</div> : g.message ? <div className="small muted" style={{ whiteSpace: 'normal', maxWidth: 260 }}>“{g.message}”</div> : null}</td>
                  <td><span className={'pill' + (g.source === 'gift' ? '' : g.source === 'employer_gift' ? ' brand' : g.source === 'event_gifts' ? ' gold' : ' good')}>{L.source(g.source)}</span>{g.monthly && <span className="small muted"> · {t('pay.monthly')}</span>}</td>
                  <td className="small">{L.method(g.method)}</td>
                  <td className="small">{g.eventTitle || '—'}</td>
                  <td className="num"><b>{fmtMoney(g.amount)}</b></td>
                  <td>{g.status === 'invested' ? <span className="pill good">{t('status.invested')}</span> : <span className="pill gold">{t('status.held')}</span>}</td>
                  <td>
                    {g.source === 'gift' && (g.thankedAt ? <span className="small muted">✓ {t('gifts.thanked')}</span> : thanking === g.id ? (
                      <span className="row" style={{ flexWrap: 'nowrap' }}><input value={text} onChange={(e) => setText(e.target.value)} placeholder={t('gifts.thankPh')} style={{ minWidth: 180 }} /><button className="btn sm" disabled={!text.trim()} onClick={() => thank(g)}>{t('gifts.send')}</button></span>
                    ) : <button className="btn ghost sm" onClick={() => setThanking(g.id)}>💌 {t('gifts.thank')}</button>)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {gifts && !shown.length && <p className="muted" style={{ padding: 20 }}>{t('gifts.empty')}</p>}
      </div>
    </div>
  );
}

/** A parent deposits part of the cash and checks from a brit, naming, bar or bat mitzvah. */
function EventDeposit({ data }: { data: ChildData }) {
  const { t, fmtMoney } = useI18n();
  const L = useLabels();
  const nav = useNavigate();
  const errText = useErr();
  const methods = useMethods();
  const { child, events } = data;
  const familyEvents = events.filter((e) => e.type !== 'birthday' || !e.active);
  const [f, setF] = useState({ eventId: '', eventType: child.age >= 11 ? 'bar_mitzvah' : 'brit', eventTitle: '', eventDate: '', amount: '', message: '' });
  const [method, setMethod] = useState('bank_transfer');
  const [err, setErr] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr('');
    try {
      const body: any = { amount: Number(f.amount), method, message: f.message };
      if (f.eventId) body.eventId = Number(f.eventId); else Object.assign(body, { eventType: f.eventType, eventTitle: f.eventTitle || L.event(f.eventType), eventDate: f.eventDate });
      const r = await api(`/children/${child.id}/deposits`, { body });
      goPay(nav, r, `/parent/child/${child.id}?tab=money`);
    } catch (x) { setErr(errText(x)); }
  };
  return (
    <form className="card stack" onSubmit={submit}>
      <div><h3 style={{ margin: 0 }}>{t('money.eventTitle')}</h3><p className="small muted" style={{ margin: '4px 0 0' }}>{t('money.eventDesc', { name: child.firstName })}</p></div>
      <label className="field"><span>{t('money.event')}</span>
        <select value={f.eventId} onChange={(e) => setF({ ...f, eventId: e.target.value })}>
          <option value="">{t('money.newEvent')}</option>
          {familyEvents.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
        </select>
      </label>
      {!f.eventId && (
        <div className="grid grid-2" style={{ gap: 10 }}>
          <label className="field"><span>{t('events.type')}</span>
            <select value={f.eventType} onChange={(e) => setF({ ...f, eventType: e.target.value })}>{FAMILY_EVENTS.filter((x) => EVENT_TYPES.includes(x)).map((x) => <option key={x} value={x}>{L.event(x)}</option>)}</select>
          </label>
          <label className="field"><span>{t('events.date')}</span><input type="date" value={f.eventDate} onChange={(e) => setF({ ...f, eventDate: e.target.value })} required /></label>
        </div>
      )}
      <label className="field"><span>{t('money.amount')}</span><input type="number" dir="ltr" min={18} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} required placeholder="₪" /></label>
      {Number(f.amount) > 0 && <div className="small muted">📈 {t('gift.worth21', { amount: fmtMoney(Number(f.amount) * 100 * Math.pow(1.065, Math.max(0, 21 - child.age))) })}</div>}
      <MethodPicker methods={methods} monthly={false} setMonthly={() => {}} value={method} onChange={setMethod} allowMonthly={false} />
      <label className="field"><span>{t('money.note')}</span><input value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} placeholder={t('money.notePh')} /></label>
      {err && <div className="error">{err}</div>}
      <button className="btn">{t('money.depositCta')}</button>
      <p className="small muted" style={{ margin: 0 }}>{t('money.ceiling')}</p>
    </form>
  );
}

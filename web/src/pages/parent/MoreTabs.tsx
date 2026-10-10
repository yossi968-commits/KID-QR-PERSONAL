import { useEffect, useState, type FormEvent } from 'react';
import { useI18n } from '../../i18n';
import { api, EVENT_TYPES, type ChildData, type Gift } from '../../lib/api';
import { useLessons, LessonModal, type Lesson } from '../../components/Lessons';
import { useLabels } from '../../components/ui';
import { AVATARS } from './OpenFund';
import { useErr } from '../Auth';

export function EventsTab({ data, reload }: { data: ChildData; reload: () => void }) {
  const { t, fmtMoney, fmtDate } = useI18n();
  const L = useLabels();
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
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="grid grid-2" style={{ alignItems: 'start' }}>
      <div className="card" style={{ padding: 0 }}>
        <div className="card-head" style={{ padding: '16px 20px 0' }}><h3>{t('events.title')}</h3></div>
        <p className="muted small" style={{ padding: '0 20px' }}>{t('events.desc')}</p>
        <div className="table-wrap"><table className="table"><tbody>
          {events.map((e) => {
            const active = e.active && e.date >= today;
            return (
              <tr key={e.id}>
                <td><b>{e.title}</b><div className="small muted">{L.event(e.type)}</div></td>
                <td>{fmtDate(e.date)}</td>
                <td className="num">{raised[e.title] ? fmtMoney(raised[e.title]) : '—'}{e.goal_amount ? <span className="small muted"> / {fmtMoney(e.goal_amount)}</span> : null}</td>
                <td>{active ? <button className="btn ghost sm" onClick={async () => { await api(`/children/${child.id}/events/${e.id}`, { method: 'DELETE' }); reload(); }}>{t('events.close')}</button> : <span className="pill">{t('events.past')}</span>}</td>
              </tr>
            );
          })}
        </tbody></table></div>
      </div>
      <form className="card stack" onSubmit={submit}>
        <h3>{t('events.new')}</h3>
        <label className="field"><span>{t('events.type')}</span><select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{EVENT_TYPES.map((k) => <option key={k} value={k}>{L.event(k)}</option>)}</select></label>
        <label className="field"><span>{t('events.titleField')}</span><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required /></label>
        <label className="field"><span>{t('events.date')}</span><input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} required /></label>
        <label className="field"><span>{t('events.goal')}</span><input type="number" min={0} value={f.goalAmount} onChange={(e) => setF({ ...f, goalAmount: e.target.value })} dir="ltr" /></label>
        <button className="btn">{t('events.create')}</button>
      </form>
    </div>
  );
}

export function LearnTab({ childId }: { childId: number }) {
  const { t } = useI18n();
  const base = `/children/${childId}`;
  const { data, reload } = useLessons(base);
  const [open, setOpen] = useState<Lesson | null>(null);
  if (!data) return null;
  return (
    <div className="card" style={{ padding: 0 }}>
      <div className="card-head" style={{ padding: '16px 20px 0' }}><h3>{t('learn.title')}</h3><span className="pill gold">⭐ {data.totalStars} {t('learn.stars')}</span></div>
      <div className="table-wrap"><table className="table"><tbody>
        {data.lessons.map((l) => (
          <tr key={l.id}>
            <td><span aria-hidden>{l.icon}</span> <b>{l.title}</b></td>
            <td className="small muted">{t(`band.${l.band}` as any)}{l.band === data.band && ' · ' + t('learn.forAge')}</td>
            <td>{l.completed ? <span className="pill good">✓ ⭐{l.starsEarned}</span> : <span className="small muted">⭐ {l.stars}</span>}</td>
            <td><button className="btn sm secondary" onClick={() => setOpen(l)}>{l.completed ? t('learn.again') : t('learn.preview')}</button></td>
          </tr>
        ))}
      </tbody></table></div>
      {open && <LessonModal base={base} lesson={open} onClose={() => { setOpen(null); reload(); }} />}
    </div>
  );
}

export function SettingsTab({ data, reload }: { data: ChildData; reload: () => void }) {
  const { t } = useI18n();
  const errText = useErr();
  const { child } = data;
  const [f, setF] = useState({ firstName: child.firstName, lastName: child.lastName || '', avatar: child.avatar, goalText: child.goalText || '', goalAmount: child.goalAmount ? String(child.goalAmount / 100) : '', publicMessage: child.publicMessage || '' });
  const [kid, setKid] = useState({ username: child.kidUsername || '', pin: '' });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const set = (k: keyof typeof f) => (e: any) => setF({ ...f, [k]: e.target.value });
  const save = async () => {
    await api(`/children/${child.id}`, { method: 'PATCH', body: { ...f, goalAmount: f.goalAmount ? Number(f.goalAmount) : null } });
    setMsg(t('settings.saved')); setTimeout(() => setMsg(''), 1500); reload();
  };
  const saveKid = async (e: FormEvent) => {
    e.preventDefault(); setErr('');
    try { await api(`/children/${child.id}/kid-login`, { body: kid }); setKid({ ...kid, pin: '' }); setMsg(t('kidlogin.saved')); reload(); } catch (x) { setErr(errText(x)); }
  };
  return (
    <div className="grid grid-2" style={{ alignItems: 'start' }}>
      <div className="card stack">
        <h3>{t('settings.profileTitle')}</h3>
        <div className="grid grid-2" style={{ gap: 12 }}>
          <label className="field"><span>{t('onb.firstName')}</span><input value={f.firstName} onChange={set('firstName')} /></label>
          <label className="field"><span>{t('onb.lastName')}</span><input value={f.lastName} onChange={set('lastName')} /></label>
        </div>
        <div className="row" style={{ gap: 6 }}>{AVATARS.map((a) => <button type="button" key={a} onClick={() => setF({ ...f, avatar: a })} className={'chip' + (f.avatar === a ? ' on' : '')} style={{ fontSize: 20, padding: 4, width: 40 }}>{a}</button>)}</div>
        <label className="field"><span>{t('onb.goal')}</span><input value={f.goalText} onChange={set('goalText')} /></label>
        <label className="field"><span>{t('events.goal')}</span><input type="number" dir="ltr" value={f.goalAmount} onChange={set('goalAmount')} /></label>
        <label className="field"><span>{t('onb.publicMessage')}</span><input value={f.publicMessage} onChange={set('publicMessage')} /></label>
        <button className="btn" onClick={save}>{t('settings.save')}</button>
      </div>
      <form className="card stack" onSubmit={saveKid}>
        <h3>{t('kidlogin.title', { name: child.firstName })}</h3>
        <p className="small muted" style={{ margin: 0 }}>{t('kidlogin.desc')}</p>
        <label className="field"><span>{t('login.username')}</span><input dir="ltr" value={kid.username} onChange={(e) => setKid({ ...kid, username: e.target.value })} required minLength={3} /></label>
        <label className="field"><span>{t('kidlogin.pin')}</span><input dir="ltr" inputMode="numeric" value={kid.pin} onChange={(e) => setKid({ ...kid, pin: e.target.value.replace(/\D/g, '') })} required minLength={4} maxLength={6} /></label>
        {err && <div className="error">{err}</div>}
        <button className="btn secondary">{child.kidUsername ? t('kidlogin.update') : t('kidlogin.create')}</button>
        {msg && <div className="ok small" role="status">✓ {msg}</div>}
      </form>
    </div>
  );
}

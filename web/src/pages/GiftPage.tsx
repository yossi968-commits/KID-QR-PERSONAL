import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useI18n } from '../i18n';
import { api, fv } from '../lib/api';
import MoneyTree from '../components/MoneyTree';
import { useErr } from './Auth';

type GiftInfo = {
  child: { firstName: string; avatar: string; age: number; turning: number; nextBirthday: string; daysToBirthday: number; publicMessage?: string; goalText?: string };
  events: { id: number; type: string; title: string; date: string; goal_amount: number | null }[];
  wall: { giverName: string; message: string | null; sealedUntil: number | null; date: string }[];
  giverCount: number;
  limits: { min: number; max: number };
  suggested: number[];
};

export default function GiftPage() {
  const { code } = useParams();
  const { t, fmtMoney } = useI18n();
  const nav = useNavigate();
  const errText = useErr();
  const [info, setInfo] = useState<GiftInfo | null>(null);
  const [missing, setMissing] = useState(false);
  const [amount, setAmount] = useState(18000);
  const [custom, setCustom] = useState('');
  const [f, setF] = useState({ giverName: '', giverEmail: '', message: '', unlockAge: '', isPublic: true, eventId: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<GiftInfo>(`/gift/${code}`).then((r) => { setInfo(r); if (r.events[0]) setF((x) => ({ ...x, eventId: String(r.events[0].id) })); }).catch(() => setMissing(true));
  }, [code]);
  if (missing) return <div className="container narrow page-head"><div className="card center">🔍 {t('gift.notFound')}</div></div>;
  if (!info) return <div className="container page-head muted">{t('common.loading')}</div>;
  const { child } = info;
  const value = custom ? Math.round(Number(custom) * 100) : amount;
  const yearsTo21 = 21 - child.age;
  const capsuleAges = [13, 16, 18, 21].filter((a) => a > child.age);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      const r = await api(`/gift/${code}/contribute`, { body: { ...f, amount: value / 100, unlockAge: f.unlockAge ? Number(f.unlockAge) : undefined, eventId: f.eventId ? Number(f.eventId) : undefined } });
      nav(r.redirectUrl);
    } catch (x) { setErr(errText(x)); setBusy(false); }
  };

  return (
    <div className="container page-head">
      <div className="gift-grid">
          <div className="card center g-hero" style={{ background: 'linear-gradient(160deg, var(--brand-soft), var(--surface))' }}>
            <div className="avatar lg" style={{ margin: '0 auto' }}>{child.avatar}</div>
            <h1 style={{ fontSize: '1.9rem', marginTop: 12 }}>{t('gift.title', { name: child.firstName })}</h1>
            <div className="pill gold" style={{ fontSize: '0.95rem' }}>
              🎂 {child.daysToBirthday === 0 ? t('gift.turningToday', { name: child.firstName }) : t('gift.turning', { name: child.firstName, n: child.turning, d: child.daysToBirthday })}
            </div>
            {child.publicMessage && <p style={{ marginTop: 14, fontSize: '1.1rem' }}>“{child.publicMessage}”</p>}
            <MoneyTree value={info.giverCount * 15000} deposited={info.giverCount * 10000} size={220} />
            <p className="muted small">{t('gift.explain', { name: child.firstName })}</p>
          </div>
          {info.wall.length > 0 && (
            <div className="card g-wall">
              <h3>{t('gift.people', { n: info.giverCount })}</h3>
              <div className="wall">
                {info.wall.slice(0, 6).map((w, i) => (
                  <div key={i} className="wall-item" style={{ flexDirection: 'column', gap: 2 }}>
                    <span className="who">{w.giverName}</span>
                    {w.sealedUntil ? <span className="sealed">🔒 {t('gifts.sealed', { age: w.sealedUntil })}</span> : w.message && <span className="muted">“{w.message}”</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

        <form className="card stack g-form" onSubmit={submit}>
          <h3>{t('gift.amount')}</h3>
          <div className="chips">
            {info.suggested.map((a) => (
              <button type="button" key={a} className={'chip num' + (!custom && amount === a ? ' on' : '')} onClick={() => { setAmount(a); setCustom(''); }}>{fmtMoney(a)}</button>
            ))}
          </div>
          <label className="field"><span>{t('gift.other')}</span><input type="number" dir="ltr" min={info.limits.min / 100} max={info.limits.max / 100} value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="₪" /></label>
          <div className="card gold flat center" style={{ padding: 12 }}>
            📈 {t('gift.worth21', { amount: fmtMoney(fv(value, yearsTo21)) })}
          </div>
          {info.events.length > 0 && (
            <label className="field"><span>{t('gift.event')}</span>
              <select value={f.eventId} onChange={(e) => setF({ ...f, eventId: e.target.value })}>
                {info.events.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
                <option value="">—</option>
              </select>
            </label>
          )}
          <label className="field"><span>{t('gift.yourName')}</span><input value={f.giverName} onChange={(e) => setF({ ...f, giverName: e.target.value })} placeholder={t('gift.yourNamePh')} required /></label>
          <label className="field"><span>{t('gift.email')}</span><input type="email" dir="ltr" value={f.giverEmail} onChange={(e) => setF({ ...f, giverEmail: e.target.value })} /></label>
          <label className="field"><span>{t('gift.message')}</span><textarea value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} placeholder={t('gift.messagePh')} maxLength={500} /></label>
          {capsuleAges.length > 0 && (
            <label className="field"><span>⏳ {t('gift.capsule')}</span>
              <select value={f.unlockAge} onChange={(e) => setF({ ...f, unlockAge: e.target.value })}>
                <option value="">{t('gift.capsuleNone')}</option>
                {capsuleAges.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </label>
          )}
          <label className="check"><input type="checkbox" checked={f.isPublic} onChange={(e) => setF({ ...f, isPublic: e.target.checked })} />{t('gift.public')}</label>
          {err && <div className="error">{err}</div>}
          <button className="btn gold block" disabled={busy || value < info.limits.min}>{t('gift.submit', { amount: fmtMoney(value) })}</button>
          <div className="small muted center">🔒 {t('gift.secure')}</div>
          <div className="small muted center">{t('gift.limits', { min: fmtMoney(info.limits.min), max: fmtMoney(info.limits.max) })}</div>
        </form>
      </div>
      <div className="center small muted" style={{ marginTop: 24 }}><Link to="/">{t('appName')}</Link> · {t('land.trust')}</div>
    </div>
  );
}

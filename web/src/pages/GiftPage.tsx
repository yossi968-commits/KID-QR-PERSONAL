import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useI18n } from '../i18n';
import { api, fv, type Method } from '../lib/api';
import MoneyTree from '../components/MoneyTree';
import { MethodPicker, goPay } from '../components/Pay';
import { useLabels } from '../components/ui';
import { useErr } from './Auth';

type GiftInfo = {
  child: { firstName: string; avatar: string; age: number; turning: number; nextBirthday: string; daysToBirthday: number; publicMessage?: string; goalText?: string };
  events: { id: number; type: string; title: string; date: string; goal_amount: number | null }[];
  wall: { giverName: string; message: string | null; sealedUntil: number | null; date: string; fromHouse?: boolean }[];
  giverCount: number; limits: { min: number; max: number }; suggested: number[]; methods: Method[]; sources: string[];
};
const WORK = ['babysitting', 'dog_walking', 'tutoring', 'waiting_tables', 'other_work'];

/** What a guest sees after scanning the QR: give a gift, or pay the child for a job. */
export default function GiftPage() {
  const { code } = useParams();
  const { t, fmtMoney } = useI18n();
  const L = useLabels();
  const nav = useNavigate();
  const errText = useErr();
  const [info, setInfo] = useState<GiftInfo | null>(null);
  const [missing, setMissing] = useState(false);
  const [purpose, setPurpose] = useState<'gift' | 'work'>('gift');
  const [work, setWork] = useState('babysitting');
  const [amount, setAmount] = useState(18000);
  const [custom, setCustom] = useState('');
  const [monthly, setMonthly] = useState(false);
  const [method, setMethod] = useState('bit');
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
  const years = Math.max(0, 21 - child.age);
  const capsuleAges = [13, 16, 18, 21].filter((a) => a > child.age);
  const isGift = purpose === 'gift';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      const r = await api(`/gift/${code}/contribute`, {
        body: {
          ...f, amount: value / 100, method, frequency: monthly ? 'monthly' : 'once', source: isGift ? 'gift' : work,
          isPublic: isGift && f.isPublic, unlockAge: isGift && !monthly && f.unlockAge ? Number(f.unlockAge) : undefined, eventId: isGift && f.eventId ? Number(f.eventId) : undefined,
        },
      });
      goPay(nav, r);
    } catch (x) { setErr(errText(x)); setBusy(false); }
  };

  return (
    <div className="container page-head">
      <div className="gift-grid">
        <div className="card center g-hero">
          <div className="avatar lg" style={{ margin: '0 auto' }}>{child.avatar}</div>
          <h1 style={{ marginTop: 12 }}>{t('gift.title', { name: child.firstName })}</h1>
          <span className="pill gold" style={{ fontSize: '0.9rem' }}>🎂 {child.daysToBirthday === 0 ? t('gift.turningToday', { name: child.firstName }) : t('gift.turning', { name: child.firstName, n: child.turning, d: child.daysToBirthday })}</span>
          {child.publicMessage && <p style={{ marginTop: 14, fontSize: '1.05rem' }}>“{child.publicMessage}”</p>}
          <MoneyTree value={info.giverCount * 15000} deposited={info.giverCount * 10000} size={200} />
          <p className="muted small">{t('gift.explain', { name: child.firstName })}</p>
        </div>
        {info.wall.length > 0 && (
          <div className="card g-wall">
            <h3>{t('gift.people', { n: info.giverCount })}</h3>
            <div className="wall">
              {info.wall.slice(0, 6).map((w, i) => (
                <div key={i} className="wall-item" style={{ flexDirection: 'column', gap: 2 }}>
                  <span className="who">{w.fromHouse && '🏦 '}{w.giverName}{w.fromHouse && <span className="pill gold" style={{ marginInlineStart: 6 }}>{t('gift.fromHouse')}</span>}</span>
                  {w.sealedUntil ? <span className="sealed">🔒 {t('gifts.sealed', { age: w.sealedUntil })}</span> : w.message && <span className="muted">“{w.message}”</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        <form className="card stack g-form" onSubmit={submit}>
          <div className="seg" role="group" aria-label={t('gift.purpose')} style={{ alignSelf: 'flex-start' }}>
            <button type="button" className={isGift ? 'on' : ''} onClick={() => setPurpose('gift')}>🎁 {t('gift.purposeGift')}</button>
            <button type="button" className={!isGift ? 'on' : ''} onClick={() => { setPurpose('work'); setMonthly(false); }}>💼 {t('gift.purposeWork', { name: child.firstName })}</button>
          </div>
          {!isGift && (
            <label className="field"><span>{t('gift.workType')}</span>
              <select value={work} onChange={(e) => setWork(e.target.value)}>{WORK.filter((w) => info.sources.includes(w)).map((w) => <option key={w} value={w}>{L.source(w)}</option>)}</select>
            </label>
          )}
          <h3 style={{ margin: 0 }}>{t('gift.amount')}</h3>
          <div className="chips">
            {info.suggested.map((a) => <button type="button" key={a} className={'chip num' + (!custom && amount === a ? ' on' : '')} onClick={() => { setAmount(a); setCustom(''); }}>{fmtMoney(a)}</button>)}
          </div>
          <label className="field"><span>{t('gift.other')}</span><input type="number" dir="ltr" min={info.limits.min / 100} max={info.limits.max / 100} value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="₪" /></label>
          <div className="card gold center" style={{ padding: 10 }}>📈 {monthly ? t('gift.worth21Monthly', { amount: fmtMoney(value), at21: fmtMoney(Array.from({ length: years * 12 }).reduce<number>((v) => v * (1 + 0.065 / 12) + value, 0)) }) : t('gift.worth21', { amount: fmtMoney(fv(value, years)) })}</div>

          <span className="field-label" style={{ marginBottom: -6 }}>{t('pay.method')}</span>
          <MethodPicker methods={info.methods} monthly={monthly} setMonthly={setMonthly} value={method} onChange={setMethod} allowMonthly={isGift} />

          {isGift && info.events.length > 0 && !monthly && (
            <label className="field"><span>{t('gift.event')}</span>
              <select value={f.eventId} onChange={(e) => setF({ ...f, eventId: e.target.value })}>{info.events.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}<option value="">—</option></select>
            </label>
          )}
          <label className="field"><span>{t('gift.yourName')}</span><input value={f.giverName} onChange={(e) => setF({ ...f, giverName: e.target.value })} placeholder={t('gift.yourNamePh')} required /></label>
          <label className="field"><span>{t('gift.email')}</span><input type="email" dir="ltr" value={f.giverEmail} onChange={(e) => setF({ ...f, giverEmail: e.target.value })} required={monthly} /></label>
          {isGift && <label className="field"><span>{t('gift.message')}</span><textarea value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} placeholder={t('gift.messagePh')} maxLength={500} /></label>}
          {isGift && !monthly && capsuleAges.length > 0 && (
            <label className="field"><span>⏳ {t('gift.capsule')}</span>
              <select value={f.unlockAge} onChange={(e) => setF({ ...f, unlockAge: e.target.value })}><option value="">{t('gift.capsuleNone')}</option>{capsuleAges.map((a) => <option key={a} value={a}>{a}</option>)}</select>
            </label>
          )}
          {isGift && <label className="check"><input type="checkbox" checked={f.isPublic} onChange={(e) => setF({ ...f, isPublic: e.target.checked })} />{t('gift.public')}</label>}
          {err && <div className="error" role="alert">{err}</div>}
          <button className="btn gold block" disabled={busy || value < info.limits.min}>{isGift ? (monthly ? t('gift.submitMonthly', { amount: fmtMoney(value) }) : t('gift.submit', { amount: fmtMoney(value) })) : t('gift.submitWork', { amount: fmtMoney(value) })}</button>
          <div className="small muted center">🔒 {t('gift.secure')}</div>
        </form>
      </div>
      <div className="center small muted" style={{ marginTop: 24 }}><Link to="/">{t('appName')}</Link> · {t('land.trust')}</div>
    </div>
  );
}

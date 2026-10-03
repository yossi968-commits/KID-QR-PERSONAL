import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import { useAuth } from '../lib/auth';
import { api, type Track, type Child } from '../lib/api';
import TrackPicker from '../components/TrackPicker';
import { useErr } from './Auth';

export const AVATARS = ['🦁', '🐻', '🦊', '🐼', '🐨', '🐯', '🦄', '🐬', '🦋', '🐢', '🚀', '⭐'];

export default function Onboarding() {
  const { t } = useI18n();
  const { user, setUser } = useAuth();
  const nav = useNavigate();
  const errText = useErr();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [nationalId, setNationalId] = useState('');
  const [consent, setConsent] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ firstName: '', lastName: '', birthDate: '', avatar: AVATARS[0], track: 'equity', goalText: '', publicMessage: '' });
  useEffect(() => { api<{ tracks: Track[] }>('/tracks').then((r) => setTracks(r.tracks)); }, []);
  const verified = user?.kycStatus === 'verified';

  const verify = async (e: FormEvent) => {
    e.preventDefault();
    setErr('');
    try {
      const r = await api('/auth/kyc', { body: { nationalId, consent } });
      setUser(r.user);
    } catch (x) { setErr(errText(x)); }
  };

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      const r = await api<{ child: Child }>('/children', { body: f });
      nav(`/app/child/${r.child.id}?tab=qr`);
    } catch (x) { setErr(errText(x)); } finally { setBusy(false); }
  };
  const set = (k: keyof typeof f) => (e: any) => setF({ ...f, [k]: e.target.value });

  return (
    <div className="container narrow page-head stack">
      <h1 style={{ fontSize: '1.8rem' }}>{t('onb.title')}</h1>
      <form className="card stack" onSubmit={verify} style={{ opacity: verified ? 0.7 : 1 }}>
        <div className="row between"><h3 style={{ margin: 0 }}>1. {t('onb.kycTitle')}</h3>{verified && <span className="pill good">✓ {t('onb.verified')}</span>}</div>
        {!verified && (
          <>
            <p className="muted small" style={{ margin: 0 }}>{t('onb.kycDesc')}</p>
            <label className="field"><span>{t('onb.nationalId')}</span><input inputMode="numeric" dir="ltr" value={nationalId} onChange={(e) => setNationalId(e.target.value)} required maxLength={9} /></label>
            <label className="check"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />{t('onb.consent')}</label>
            {err && <div className="error">{err}</div>}
            <button className="btn">{t('onb.verify')}</button>
            <div className="sandbox-tag">Sandbox · 000000018</div>
          </>
        )}
      </form>

      {verified && (
        <form className="card stack" onSubmit={create}>
          <h3 style={{ margin: 0 }}>2. {t('onb.childTitle')}</h3>
          <div className="grid grid-2" style={{ gap: 12 }}>
            <label className="field"><span>{t('onb.firstName')}</span><input value={f.firstName} onChange={set('firstName')} required /></label>
            <label className="field"><span>{t('onb.lastName')}</span><input value={f.lastName} onChange={set('lastName')} /></label>
          </div>
          <label className="field"><span>{t('onb.birthDate')}</span><input type="date" value={f.birthDate} onChange={set('birthDate')} required max={new Date().toISOString().slice(0, 10)} /></label>
          <div className="field">
            <span className="small muted">{t('onb.avatar')}</span>
            <div className="row" style={{ gap: 6, marginTop: 6 }}>
              {AVATARS.map((a) => (
                <button type="button" key={a} onClick={() => setF({ ...f, avatar: a })} className="chip" style={{ fontSize: 24, padding: 6, width: 48, ...(f.avatar === a ? { borderColor: 'var(--brand)', background: 'var(--brand-soft)' } : {}) }}>{a}</button>
              ))}
            </div>
          </div>
          <div><span className="small muted">{t('onb.track')}</span><div style={{ marginTop: 6 }}><TrackPicker tracks={tracks} value={f.track} onChange={(track) => setF({ ...f, track })} /></div></div>
          <label className="field"><span>{t('onb.goal')}</span><input value={f.goalText} onChange={set('goalText')} placeholder={t('onb.goalPh')} /></label>
          <label className="field"><span>{t('onb.publicMessage')}</span><input value={f.publicMessage} onChange={set('publicMessage')} placeholder={t('onb.publicMessagePh')} /></label>
          {err && <div className="error">{err}</div>}
          <button className="btn" disabled={busy}>{t('onb.create')}</button>
        </form>
      )}
    </div>
  );
}

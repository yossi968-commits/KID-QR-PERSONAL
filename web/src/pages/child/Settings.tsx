import { useEffect, useState } from 'react';
import { useI18n } from '../../i18n';
import { api, type Track } from '../../lib/api';
import TrackPicker from '../../components/TrackPicker';
import { AVATARS } from '../Onboarding';
import type { ChildData } from './ChildPage';

type Tx = { id: number; type: string; reason: string; track: string; amount: number; units: number; nav: number; date: string };

export default function Settings({ data, reload }: { data: ChildData; reload: () => void }) {
  const { t, fmtMoney, fmtDate } = useI18n();
  const { child } = data;
  const [tracks, setTracks] = useState<Track[]>([]);
  const [track, setTrack] = useState(child.track);
  const [f, setF] = useState({ firstName: child.firstName, lastName: child.lastName || '', avatar: child.avatar, goalText: child.goalText || '', goalAmount: child.goalAmount ? String(child.goalAmount / 100) : '', publicMessage: child.publicMessage || '' });
  const [saved, setSaved] = useState(false);
  const [txs, setTxs] = useState<Tx[] | null>(null);
  useEffect(() => { api<{ tracks: Track[] }>('/tracks').then((r) => setTracks(r.tracks)); }, []);

  const switchTrack = async () => {
    if (!confirm(t('settings.confirmSwitch', { track: t(('track.' + track) as any) }))) return;
    await api(`/children/${child.id}/track`, { body: { track } });
    reload();
  };
  const save = async () => {
    await api(`/children/${child.id}`, { method: 'PATCH', body: { ...f, goalAmount: f.goalAmount ? Number(f.goalAmount) : null } });
    setSaved(true); setTimeout(() => setSaved(false), 1500);
    reload();
  };
  const set = (k: keyof typeof f) => (e: any) => setF({ ...f, [k]: e.target.value });

  return (
    <div className="grid grid-2" style={{ alignItems: 'start' }}>
      <div className="card stack">
        <h3>{t('settings.trackTitle')}</h3>
        <p className="small muted" style={{ margin: 0 }}>{t('settings.trackDesc')}</p>
        <div className="small">{t('settings.current')}: <b>{t(('track.' + child.track) as any)}</b></div>
        <TrackPicker tracks={tracks} value={track} onChange={setTrack} />
        <button className="btn" disabled={track === child.track} onClick={switchTrack}>{t('settings.switch')} {t(('track.' + track) as any)}</button>
      </div>
      <div className="card stack">
        <h3>{t('settings.profileTitle')}</h3>
        <div className="grid grid-2" style={{ gap: 12 }}>
          <label className="field"><span>{t('onb.firstName')}</span><input value={f.firstName} onChange={set('firstName')} /></label>
          <label className="field"><span>{t('onb.lastName')}</span><input value={f.lastName} onChange={set('lastName')} /></label>
        </div>
        <div className="row" style={{ gap: 6 }}>
          {AVATARS.map((a) => <button type="button" key={a} onClick={() => setF({ ...f, avatar: a })} className="chip" style={{ fontSize: 22, padding: 4, width: 42, ...(f.avatar === a ? { borderColor: 'var(--brand)', background: 'var(--brand-soft)' } : {}) }}>{a}</button>)}
        </div>
        <label className="field"><span>{t('onb.goal')}</span><input value={f.goalText} onChange={set('goalText')} /></label>
        <label className="field"><span>{t('events.goal')}</span><input type="number" dir="ltr" value={f.goalAmount} onChange={set('goalAmount')} /></label>
        <label className="field"><span>{t('onb.publicMessage')}</span><input value={f.publicMessage} onChange={set('publicMessage')} /></label>
        <button className="btn" onClick={save}>{saved ? '✓ ' + t('settings.saved') : t('settings.save')}</button>
      </div>
      <div className="card" style={{ gridColumn: '1 / -1' }}>
        <div className="row between"><h3 style={{ margin: 0 }}>{t('settings.statement')}</h3>{!txs && <button className="btn sm secondary" onClick={() => api(`/children/${child.id}/statement`).then((r) => setTxs(r.transactions))}>↓</button>}</div>
        {txs && (
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="table">
              <thead><tr><th>{t('events.date')}</th><th></th><th>{t('onb.track')}</th><th>₪</th><th>NAV</th></tr></thead>
              <tbody>{txs.map((x) => (
                <tr key={x.id}><td>{fmtDate(x.date)}</td><td>{x.type === 'buy' ? (x.reason === 'gift' ? '🎁' : '↪') : '↩'}</td><td>{t(('track.' + x.track) as any)}</td><td className="num">{x.type === 'sell' ? '−' : ''}{fmtMoney(x.amount, { cents: true })}</td><td className="num">{x.nav.toFixed(2)}</td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

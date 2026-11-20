import { useEffect, useState } from 'react';
import { useI18n } from '../i18n';
import { api, type Track } from '../lib/api';
import Modal from './Modal';

/**
 * Guided choice of the long-term track: three core tracks (solid, conservative,
 * equities), with the more tracks the investment house may add listed separately.
 */
export default function TrackDialog({ value, years, onPick, onClose, coreOnly = true, communityTrack }: { value: string; years: number; onPick: (id: string) => void; onClose: () => void; coreOnly?: boolean; communityTrack?: string | null }) {
  const { t } = useI18n();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [pick, setPick] = useState(value);
  useEffect(() => { api<{ tracks: Track[] }>('/tracks').then((r) => setTracks(r.tracks)); }, []);
  const order = ['solid', 'conservative', 'equity'];
  const core = tracks.filter((x) => x.core).sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  const more = tracks.filter((x) => !x.core);
  // A values-based track for the family's community (kosher, Sharia-compliant), offered even when only core tracks are.
  const fit = communityTrack ? tracks.find((x) => x.id === communityTrack && !x.core) : undefined;
  const recommended = years >= 10 ? 'equity' : years >= 4 ? 'conservative' : 'solid';
  const at = (tr: Track) => Math.round(10000 * Math.pow(1 + tr.expectedReturn - tr.mgmtFee, years)) / 100;
  const Card = ({ tr }: { tr: Track }) => (
    <button type="button" className={'quiz-opt' + (pick === tr.id ? ' on' : '')} style={{ marginTop: 0 }} onClick={() => setPick(tr.id)} aria-pressed={pick === tr.id}>
      <div className="row between">
        <strong>{t(`track.${tr.id}` as any)}</strong>
        <span className="row" style={{ gap: 6 }}>
          {tr.id === recommended && <span className="pill gold">{t('track.recommended')}</span>}
          {tr.id === communityTrack && <span className="pill good">{t('track.communityPick')}</span>}
          <span className="pill" aria-label={t('track.risk')}>{'●'.repeat(tr.risk)}{'○'.repeat(5 - tr.risk)}</span>
        </span>
      </div>
      <div className="small muted" style={{ marginTop: 4 }}>{t(`track.${tr.id}.desc` as any)}</div>
      <div className="small" style={{ marginTop: 6 }}>
        {t('track.equityShare')}: <b className="num">{Math.round(tr.equityShare * 100)}%</b> · {t('track.expected')}: <b className="num">{(tr.expectedReturn * 100).toFixed(1)}%</b> · {t('track.fee')}: <b className="num">{(tr.mgmtFee * 100).toFixed(2)}%</b>
      </div>
      <div className="small muted">{t('track.hundredBecomes', { n: years, amount: `₪${at(tr).toLocaleString()}` })}</div>
    </button>
  );
  return (
    <Modal onClose={onClose}>
      <div className="stack">
        <div>
          <div className="eyebrow">{t('track.dialogEyebrow')}</div>
          <h2 style={{ margin: '4px 0 0' }}>{t('track.dialogTitle')}</h2>
        </div>
        <p className="muted small" style={{ margin: 0 }}>{t('track.dialogDesc', { n: years })}</p>
        {coreOnly && fit && <Card tr={fit} />}
        {core.map((tr) => <Card key={tr.id} tr={tr} />)}
        {!coreOnly && more.length > 0 && (<><div className="eyebrow">{t('track.more')}</div>{more.map((tr) => <Card key={tr.id} tr={tr} />)}</>)}
        {coreOnly && <p className="small muted" style={{ margin: 0 }}>➕ {t('track.moreSoon')}</p>}
        <div className="banner small">ℹ️ {t('track.switchRule')}</div>
        <div className="row">
          <button className="btn" onClick={() => onPick(pick)}>{t('track.choose', { track: t(`track.${pick}` as any) })}</button>
          <button className="btn ghost" onClick={onClose}>{t('common.cancel')}</button>
        </div>
      </div>
    </Modal>
  );
}

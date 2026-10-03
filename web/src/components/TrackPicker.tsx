import type { Track } from '../lib/api';
import { useI18n } from '../i18n';

export default function TrackPicker({ tracks, value, onChange }: { tracks: Track[]; value: string; onChange: (id: string) => void }) {
  const { t } = useI18n();
  return (
    <div className="grid grid-2" style={{ gap: 10 }}>
      {tracks.map((tr) => (
        <button type="button" key={tr.id} className={'quiz-opt' + (value === tr.id ? ' on' : '')} onClick={() => onChange(tr.id)} style={{ marginTop: 0 }}>
          <div className="row between"><strong>{t(('track.' + tr.id) as any)}</strong><span className="pill">{'●'.repeat(tr.risk)}{'○'.repeat(5 - tr.risk)}</span></div>
          <div className="small muted">
            {t('track.expected')}: <span className="num">{(tr.expectedReturn * 100).toFixed(1)}%</span> · {t('track.fee')}: <span className="num">{(tr.mgmtFee * 100).toFixed(2)}%</span>
          </div>
        </button>
      ))}
    </div>
  );
}

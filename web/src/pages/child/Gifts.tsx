import { useEffect, useState } from 'react';
import { useI18n } from '../../i18n';
import { api, type Child } from '../../lib/api';

type Gift = { id: number; giverName: string; giverEmail?: string; amount: number; message: string | null; sealed: boolean; unlockAge: number | null; eventTitle?: string; paidAt: string; thankedAt?: string };

export default function Gifts({ child }: { child: Child }) {
  const { t, fmtMoney, fmtDate } = useI18n();
  const [gifts, setGifts] = useState<Gift[] | null>(null);
  const [thanking, setThanking] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const load = () => api<{ contributions: Gift[] }>(`/children/${child.id}/contributions`).then((r) => setGifts(r.contributions));
  useEffect(() => { load(); }, [child.id]);
  if (!gifts) return <p className="muted">{t('common.loading')}</p>;
  if (!gifts.length) return <div className="card center muted">{t('gifts.empty')}</div>;

  const send = async (g: Gift) => {
    const r = await api(`/children/${child.id}/contributions/${g.id}/thank`, { body: { message: text } });
    setNote(r.delivered ? '' : t('gifts.noEmail'));
    setThanking(null); setText('');
    load();
  };

  return (
    <div className="stack">
      <h3>{t('gifts.title')}</h3>
      {note && <div className="banner small">{note}</div>}
      <div className="wall">
        {gifts.map((g) => (
          <div key={g.id} className="wall-item" style={{ flexDirection: 'column' }}>
            <div className="row between">
              <div>
                <span className="who">{g.giverName}</span>
                <span className="small muted"> · {fmtDate(g.paidAt)}{g.eventTitle ? ` · ${g.eventTitle}` : ''}</span>
              </div>
              <strong className="num">{fmtMoney(g.amount)}</strong>
            </div>
            {g.sealed ? <span className="sealed">🔒 {t('gifts.sealed', { age: g.unlockAge! })}</span> : g.message && <div>“{g.message}”</div>}
            <div className="row">
              {g.thankedAt ? <span className="pill good">✓ {t('gifts.thanked')}</span> : thanking === g.id ? null : (
                <button className="btn ghost sm" onClick={() => { setThanking(g.id); setText(''); }}>💌 {t('gifts.thank')}</button>
              )}
            </div>
            {thanking === g.id && (
              <div className="stack" style={{ marginTop: 4 }}>
                <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={t('gifts.thankPh')} />
                <div className="row"><button className="btn sm" disabled={!text.trim()} onClick={() => send(g)}>{t('gifts.send')}</button><button className="btn ghost sm" onClick={() => setThanking(null)}>{t('common.cancel')}</button></div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

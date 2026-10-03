import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useI18n } from '../i18n';
import { api } from '../lib/api';
import MoneyTree from '../components/MoneyTree';
import { useLessons, LessonModal, type Lesson } from './child/Learn';
import type { ChildData } from './child/ChildPage';

export default function KidMode() {
  const { id } = useParams();
  const { t, fmtMoney } = useI18n();
  const [data, setData] = useState<ChildData | null>(null);
  const { data: lessons, reload } = useLessons(Number(id));
  const [open, setOpen] = useState<Lesson | null>(null);
  useEffect(() => { api<ChildData>(`/children/${id}`).then(setData); }, [id]);
  if (!data) return null;
  const { child, portfolio: p } = data;
  const mine = lessons?.lessons.filter((l) => l.band === lessons.band) || [];

  return (
    <div className="kid">
      <div className="container" style={{ paddingTop: 20, paddingBottom: 40 }}>
        <div className="row between">
          <Link to={`/app/child/${child.id}`} className="btn ghost sm" style={{ color: '#0f5257' }}>← {t('kid.back')}</Link>
          {lessons && <span className="pill gold" style={{ fontSize: '1rem' }}>⭐ {lessons.totalStars}</span>}
        </div>
        <div className="center" style={{ marginTop: 12 }}>
          <div style={{ fontSize: 64 }}>{child.avatar}</div>
          <h1 style={{ color: '#0f5257' }}>{t('kid.hello', { name: child.firstName })}</h1>
        </div>
        <div className="grid grid-2" style={{ alignItems: 'center', marginTop: 12 }}>
          <div className="tree-wrap"><MoneyTree value={p.value} deposited={p.deposited} size={340} /></div>
          <div className="stack">
            <div className="bubble">
              <div>{t('kid.treeSays')}</div>
              <div className="big num">{fmtMoney(p.value)}</div>
              <div>🌱 {t('kid.grew', { amount: fmtMoney(Math.max(0, p.gain)) })}</div>
              <div>💛 {t('kid.friends', { n: p.giverCount })}</div>
            </div>
            <div className="bubble">
              <div>🎓 {t('kid.at21')}</div>
              <div className="big num" style={{ fontSize: '2rem' }}>{fmtMoney(p.projection.finals.mid)}</div>
            </div>
          </div>
        </div>
        <h2 className="center" style={{ marginTop: 32, color: '#0f5257' }}>{t('kid.learn')}</h2>
        <div className="grid grid-3">
          {mine.map((l) => (
            <button key={l.id} className="bubble" style={{ border: 0, cursor: 'pointer', textAlign: 'center', font: 'inherit' }} onClick={() => setOpen(l)}>
              <div style={{ fontSize: 48 }}>{l.icon}</div>
              <div style={{ fontWeight: 700, fontSize: '1.15rem' }}>{l.title}</div>
              <div>{l.completed ? '✅ ' + '⭐'.repeat(Math.min(5, l.starsEarned)) : '⭐ ' + l.stars}</div>
            </button>
          ))}
        </div>
      </div>
      {open && <LessonModal childId={child.id} lesson={open} onClose={() => { setOpen(null); reload(); }} />}
    </div>
  );
}

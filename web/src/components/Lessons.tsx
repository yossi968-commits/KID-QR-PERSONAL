import { useEffect, useState } from 'react';
import { useI18n } from '../i18n';
import { api } from '../lib/api';
import Modal from './Modal';

export type Lesson = { id: string; band: string; icon: string; stars: number; title: string; body: string; activity: string; quiz: { q: string; options: string[] }[]; completed: boolean; starsEarned: number };
export type LessonsRes = { band: string; lessons: Lesson[]; totalStars: number };

/** base: `/children/:id` for a parent, `/kid` for the child's own session. */
export function useLessons(base: string) {
  const { locale } = useI18n();
  const [data, setData] = useState<LessonsRes | null>(null);
  const load = () => api<LessonsRes>(`${base}/lessons?locale=${locale}`).then(setData);
  useEffect(() => { load(); }, [base, locale]);
  return { data, reload: load };
}

export function LessonModal({ base, lesson, onClose }: { base: string; lesson: Lesson; onClose: (passed: boolean) => void }) {
  const { t } = useI18n();
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<{ correct: number; total: number; passed: boolean; stars: number } | null>(null);
  const check = async () => setResult(await api(`${base}/lessons/${lesson.id}/complete`, { body: { answers } }));
  return (
    <Modal onClose={() => onClose(Boolean(result?.passed))}>
      <div className="stack">
        <div style={{ fontSize: 44 }}>{lesson.icon}</div>
        <h2>{lesson.title}</h2>
        <p style={{ fontSize: '1.05rem' }}>{lesson.body}</p>
        <div className="card gold"><strong>🏠 {t('learn.activity')}:</strong> {lesson.activity}</div>
        <h3>{t('learn.quiz')}</h3>
        {lesson.quiz.map((q, qi) => (
          <div key={qi}>
            <strong>{q.q}</strong>
            {q.options.map((o, oi) => (
              <button key={oi} type="button" className={'quiz-opt' + (answers[qi] === oi ? ' on' : '')} onClick={() => { const a = [...answers]; a[qi] = oi; setAnswers(a); setResult(null); }}>{o}</button>
            ))}
          </div>
        ))}
        {result && <div className="banner" role="status">{result.passed ? t('learn.passed', { n: result.stars }) : t('learn.tryAgain', { c: result.correct, t: result.total })}</div>}
        <div className="row">
          {!result?.passed && <button className="btn" disabled={answers.filter((a) => a !== undefined).length < lesson.quiz.length} onClick={check}>{t('learn.check')}</button>}
          <button className="btn ghost" onClick={() => onClose(Boolean(result?.passed))}>{t('learn.close')}</button>
        </div>
      </div>
    </Modal>
  );
}

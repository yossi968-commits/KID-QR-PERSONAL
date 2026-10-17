import { useI18n } from '../i18n';
import type { Child } from '../lib/api';
import { AccountPill } from './ui';

/** Birth → 18 → 21 → after: where this child's fund is on the road, current step highlighted. */
export function LifeTimeline({ child }: { child: Child }) {
  const { t, fmtDate } = useI18n();
  const lc = child.lifecycle;
  const at = lc.phase === 'graduated' ? 3 : lc.phase === 'adult' ? (lc.canGraduate ? 2 : 1) : 0;
  const steps = [
    { icon: '🍼', text: t('life.step.birth'), date: child.birthDate },
    { icon: '🔑', text: t('life.step.18', { name: child.firstName }), date: lc.handoverDate },
    { icon: '🎓', text: t('life.step.21'), date: lc.graduateFrom },
    { icon: '💍', text: t('life.step.after'), date: null },
  ];
  return (
    <div className="card">
      <h3>{t('life.title')}</h3>
      <ol className="life">
        {steps.map((s, i) => (
          <li key={i} className={i < at ? 'done' : i === at ? 'now' : ''} aria-current={i === at ? 'step' : undefined}>
            <span className="dot" aria-hidden>{s.icon}</span>
            <span><b>{s.text}</b>{s.date && <div className="small muted">{fmtDate(s.date)}</div>}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Account status, or who runs the fund once the child is 18. */
export function FundPill({ child }: { child: Child }) {
  const { t } = useI18n();
  if (child.lifecycle?.phase === 'graduated') return <span className="pill brand">🎓 {t('life.gradPill')}</span>;
  if (child.lifecycle?.phase === 'adult') return <span className="pill brand">🔑 {t('life.selfPill')}</span>;
  return <AccountPill status={child.accountStatus} />;
}

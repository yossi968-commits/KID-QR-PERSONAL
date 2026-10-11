import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import type { Child, Portfolio } from '../lib/api';

const MILESTONES = [0, 6, 13, 18, 21];

/** Birth to 21 as one line: where the child is today, and the milestones ahead. */
export function AgeTimeline({ age, end = 21 }: { age: number; end?: number }) {
  const { t } = useI18n();
  const at = (a: number) => `${Math.min(100, (a / end) * 100)}%`;
  return (
    <div className="age-line" role="img" aria-label={t('future.timelineLabel', { age, end })}>
      <div className="age-track"><div className="age-fill" style={{ width: at(age) }} /></div>
      {MILESTONES.filter((m) => m <= end).map((m) => (
        <span key={m} className={'age-tick' + (m <= age ? ' passed' : '')} style={{ insetInlineStart: at(m) }}>
          <i aria-hidden />
          <small>{t(`future.ms.${m}` as any)}</small>
        </span>
      ))}
      <span className="age-now" style={{ insetInlineStart: at(age) }} aria-hidden>{age}</span>
    </div>
  );
}

/**
 * What the family put in, what it has grown by so far, and what may still come by the
 * payout age: kept as separate parts so a possible return never reads as money already there.
 */
export function SavingsSplit({ p }: { p: Portfolio }) {
  const { t, fmtMoney } = useI18n();
  const dep = Math.max(0, Math.min(p.deposited, p.value));
  const grown = Math.max(0, p.value - p.deposited);
  const later = Math.max(0, p.projection.finals.mid - p.value);
  const total = dep + grown + later || 1;
  const parts: [string, number, string][] = [
    ['dep', dep, t('future.part.deposited')],
    ['grown', grown, t('future.part.grown')],
    ['later', later, t('future.part.later', { age: p.projection.payoutAge })],
  ];
  return (
    <div>
      <div className="split-bar" aria-hidden>{parts.map(([k, v]) => v > 0 && <i key={k} className={'sb-' + k} style={{ flexGrow: v / total }} />)}</div>
      <div className="split-legend">
        {parts.map(([k, v, label]) => <span key={k}><i className={'sb-' + k} />{label} <b className="num">{fmtMoney(v)}</b></span>)}
      </div>
    </div>
  );
}

/** "The future of Noa": the home-screen hero for a child, for parents and for the child. */
export function FutureHero({ child, p, self, children }: { child: Child; p: Portfolio; self?: boolean; children?: ReactNode }) {
  const { t, fmtMoney } = useI18n();
  return (
    <section className="future card">
      <div className="future-head">
        <div>
          <div className="eyebrow">{self ? t('future.mine') : t('future.of', { name: child.firstName })}</div>
          <div className="future-value num">{fmtMoney(p.value)}</div>
          <div className="small muted">{p.held > 0 ? t('future.held', { amount: fmtMoney(p.held) }) : t('future.grows')}</div>
        </div>
        <div className="future-ages">
          <div><span>{t('future.ageNow')}</span><b className="num">{child.age}</b></div>
          <div><span>{t('future.goal')}</span><b>{t('future.ageGoal', { age: p.projection.payoutAge })}</b></div>
        </div>
      </div>
      <AgeTimeline age={child.age} end={Math.max(21, p.projection.payoutAge)} />
      <SavingsSplit p={p} />
      <p className="tiny muted" style={{ margin: 0 }}>ⓘ {t('future.disclaimer')}</p>
      {children}
    </section>
  );
}

/** The two invitations under the hero: family can give to the future, and the child can learn. */
export function FutureTiles({ giftTo, learnTo, onGift, onLearn }: { giftTo?: string; learnTo?: string; onGift?: () => void; onLearn?: () => void }) {
  const { t } = useI18n();
  const Tile = ({ to, on, icon, title, desc, tone }: { to?: string; on?: () => void; icon: string; title: string; desc: string; tone: string }) => {
    const body = <><span className={'ft-icon ' + tone} aria-hidden>{icon}</span><span><b>{title}</b><small>{desc}</small></span></>;
    return to ? <Link className="future-tile" to={to}>{body}</Link> : <button type="button" className="future-tile" onClick={on}>{body}</button>;
  };
  return (
    <div className="future-tiles">
      <Tile to={giftTo} on={onGift} icon="🎁" tone="sun" title={t('future.giftTitle')} desc={t('future.giftDesc')} />
      <Tile to={learnTo} on={onLearn} icon="📚" tone="mint" title={t('future.learnTitle')} desc={t('future.learnDesc')} />
    </div>
  );
}

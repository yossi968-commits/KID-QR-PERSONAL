import type { ReactNode } from 'react';

/**
 * A closed-by-default section: one tappable row (icon, title, one-line hint) that opens to show
 * the details. Keeps main screens short; depth is one tap away.
 */
export function Expand({ icon, title, sub, badge, open, children, className = '' }: {
  icon?: ReactNode; title: ReactNode; sub?: ReactNode; badge?: ReactNode; open?: boolean; children: ReactNode; className?: string;
}) {
  return (
    <details className={'expand ' + className} open={open}>
      <summary>
        {icon && <span className="x-icon" aria-hidden>{icon}</span>}
        <span className="x-text"><b>{title}</b>{sub && <span className="small muted">{sub}</span>}</span>
        {badge}
        <span className="x-chev" aria-hidden>⌄</span>
      </summary>
      <div className="expand-body">{children}</div>
    </details>
  );
}

/** A plain list row that goes somewhere (bit-style menu line). */
export function NavRow({ icon, title, sub, badge, onClick }: { icon: ReactNode; title: ReactNode; sub?: ReactNode; badge?: ReactNode; onClick: () => void }) {
  return (
    <button type="button" className="nav-row" onClick={onClick}>
      <span className="x-icon" aria-hidden>{icon}</span>
      <span className="x-text"><b>{title}</b>{sub && <span className="small muted">{sub}</span>}</span>
      {badge}
      <span className="x-chev side" aria-hidden>‹</span>
    </button>
  );
}

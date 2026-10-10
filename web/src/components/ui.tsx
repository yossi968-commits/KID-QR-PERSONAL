import type { ReactNode } from 'react';
import { useI18n } from '../i18n';
import type { AccountStatus } from '../lib/api';

export function Kpis({ items }: { items: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'pos' | 'neg' }[] }) {
  return (
    <div className="kpis">
      {items.map((k, i) => (
        <div key={i} className="stat">
          <div className="label">{k.label}</div>
          <div className={'value num' + (k.tone ? ' ' + k.tone : '')}>{k.value}</div>
          {k.sub && <div className="sub">{k.sub}</div>}
        </div>
      ))}
    </div>
  );
}

export function AccountPill({ status }: { status: AccountStatus }) {
  const { t } = useI18n();
  const cls = status === 'active' ? 'good' : status === 'in_review' ? 'brand' : 'gold';
  return <span className={'pill ' + cls}>{t(`fund.status.${status}` as any)}</span>;
}

export function Signed({ value }: { value: number }) {
  const { fmtMoney } = useI18n();
  return <span className={value >= 0 ? 'pos' : 'neg'}>{value >= 0 ? '+' : '−'}{fmtMoney(Math.abs(value))}</span>;
}

export const Loading = () => {
  const { t } = useI18n();
  return <div className="container page-head muted">{t('common.loading')}</div>;
};

/** Labels for payment methods and money sources, shared by every screen. */
export function useLabels() {
  const { t } = useI18n();
  return {
    method: (m?: string | null) => (m ? t(`method.${m}` as any) : '—'),
    source: (s?: string | null) => t(`source.${s || 'gift'}` as any),
    track: (id: string) => t(`track.${id}` as any),
    event: (type: string) => t(`events.type.${type}` as any),
  };
}

export const METHOD_ICON: Record<string, string> = { bit: '🅑', paybox: '🅟', card: '💳', applepay: '', googlepay: 'G', bank_transfer: '🏦', masav: '🔁', bank: '🏦' };

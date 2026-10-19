import { useEffect, useState } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { useI18n } from '../i18n';
import { api, type Method } from '../lib/api';
import { METHOD_ICON } from './ui';

export function useMethods() {
  const [methods, setMethods] = useState<Method[]>([]);
  useEffect(() => { api<{ methods: Method[] }>('/payment-methods').then((r) => setMethods(r.methods)); }, []);
  return methods;
}

/** One-time / monthly toggle plus the payment methods that fit it. */
export function MethodPicker({ methods, monthly, setMonthly, value, onChange, allowMonthly = true }: {
  methods: Method[]; monthly: boolean; setMonthly: (m: boolean) => void; value: string; onChange: (m: string) => void; allowMonthly?: boolean;
}) {
  const { t } = useI18n();
  const fits = (m: Method) => (monthly ? m.recurring : !m.recurringOnly);
  useEffect(() => {
    const cur = methods.find((m) => m.id === value);
    if (cur && !fits(cur)) onChange(methods.find(fits)?.id || 'card');
  }, [monthly, methods]);
  return (
    <div className="stack" style={{ gap: 10 }}>
      {allowMonthly && (
        <div className="seg" role="group" aria-label={t('pay.frequency')}>
          <button type="button" className={!monthly ? 'on' : ''} onClick={() => setMonthly(false)} aria-pressed={!monthly}>{t('pay.once')}</button>
          <button type="button" className={monthly ? 'on' : ''} onClick={() => setMonthly(true)} aria-pressed={monthly}>{t('pay.monthly')}</button>
        </div>
      )}
      <div className="methods" role="radiogroup" aria-label={t('pay.method')}>
        {methods.map((m) => (
          <button key={m.id} type="button" role="radio" aria-checked={value === m.id} className={'method' + (value === m.id ? ' on' : '')} disabled={!fits(m)} onClick={() => onChange(m.id)}>
            <span className="m-icon" aria-hidden>{METHOD_ICON[m.id]}</span>
            <span>{t(`method.${m.id}` as any)}</span>
            <small>{m.recurringOnly ? t('pay.tagMonthlyOnly') : m.recurring ? t('pay.tagBoth') : t('pay.tagOnce')}</small>
          </button>
        ))}
      </div>
      {monthly && <p className="small muted" style={{ margin: 0 }}>{t('pay.monthlyNote')}</p>}
    </div>
  );
}

/** Go to the provider's page; come back to `returnTo` instead of the guest thank-you page. */
export function goPay(nav: NavigateFunction, r: { redirectUrl: string }, returnTo?: string) {
  try { if (returnTo) sessionStorage.setItem('returnTo', returnTo); else sessionStorage.removeItem('returnTo'); } catch {}
  nav(r.redirectUrl);
}
export function takeReturnTo() {
  try { const r = sessionStorage.getItem('returnTo'); sessionStorage.removeItem('returnTo'); return r; } catch { return null; }
}

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useI18n } from '../i18n';
import { api } from '../lib/api';
import { takeReturnTo } from '../components/Pay';
import { METHOD_ICON } from '../components/ui';

type Checkout = {
  amount: number; description: string; status: string; method: string; recurring: boolean;
  bank?: { bank: string; bankName: string; branch: string; account: string; beneficiary: string; reference: string };
};

/**
 * Stand-in for the payment provider's hosted step, one screen per method: hand-off to
 * Bit / PayBox, card form (stored for monthly gifts), wallet sheet, or bank transfer details.
 */
export default function PayPage() {
  const { id } = useParams();
  const { t, fmtMoney } = useI18n();
  const nav = useNavigate();
  const [chk, setChk] = useState<Checkout | null>(null);
  const [busy, setBusy] = useState(false);
  const [phone, setPhone] = useState('050-0000000');
  const [stage, setStage] = useState<'start' | 'app'>('start');
  useEffect(() => { api(`/payments/${id}`).then((r) => setChk(r.checkout)); }, [id]);
  if (!chk) return <div className="container page-head muted">{t('common.loading')}</div>;
  const m = chk.method;

  const finish = async () => {
    setBusy(true);
    await new Promise((r) => setTimeout(r, 600));
    const r = await api(`/payments/${id}/complete`, { body: { method: m } });
    nav(takeReturnTo() || r.returnUrl, { replace: true });
  };
  const cancel = async () => { const r = await api(`/payments/${id}/cancel`, { body: {} }); nav(takeReturnTo() || r.returnUrl, { replace: true }); };

  return (
    <div className="container narrow page-head">
      <div className="card stack">
        <div className="sandbox-tag">🧪 {t('pay.sandbox')}</div>
        <div className="row between">
          <h2 style={{ margin: 0 }}><span aria-hidden>{METHOD_ICON[m]}</span> {t(`method.${m}` as any)}</h2>
          <div style={{ textAlign: 'end' }}><strong className="num" style={{ fontSize: '1.4rem' }}>{fmtMoney(chk.amount)}</strong>{chk.recurring && <div className="small muted">{t('pay.perMonth')}</div>}</div>
        </div>
        <div className="muted small">{chk.description}</div>

        {(m === 'bit' || m === 'paybox') && (stage === 'start' ? (
          <>
            <label className="field"><span>{t('pay.phone')}</span><input dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" /></label>
            <button className="btn block" onClick={() => setStage('app')}>{t('pay.openApp', { app: t(`method.${m}` as any) })}</button>
            <p className="small muted" style={{ margin: 0 }}>{t('pay.appNote', { app: t(`method.${m}` as any) })}</p>
          </>
        ) : (
          <div className="card center" style={{ background: 'var(--surface-2)' }}>
            <div style={{ fontSize: 40 }}>📲</div>
            <p>{t('pay.appWaiting', { app: t(`method.${m}` as any), phone })}</p>
            <button className="btn block" disabled={busy} onClick={finish}>{busy ? t('pay.processing') : t('pay.appApproved')}</button>
          </div>
        ))}

        {m === 'card' && (
          <>
            <label className="field"><span>{t('pay.cardNumber')}</span><input dir="ltr" defaultValue="4580 0000 0000 0000" inputMode="numeric" autoComplete="cc-number" /></label>
            <div className="grid grid-2" style={{ gap: 12 }}>
              <label className="field"><span>{t('pay.expiry')}</span><input dir="ltr" defaultValue="12/29" autoComplete="cc-exp" /></label>
              <label className="field"><span>{t('pay.cvv')}</span><input dir="ltr" defaultValue="123" autoComplete="cc-csc" /></label>
            </div>
            {chk.recurring && <div className="banner small">🔁 {t('pay.cardRecurring')}</div>}
            <button className="btn block" disabled={busy} onClick={finish}>{busy ? t('pay.processing') : t('pay.payNow', { amount: fmtMoney(chk.amount) })}</button>
          </>
        )}

        {(m === 'applepay' || m === 'googlepay') && <button className="btn block" style={{ background: '#000', color: '#fff' }} disabled={busy} onClick={finish}>{busy ? t('pay.processing') : t('pay.walletPay', { wallet: t(`method.${m}` as any) })}</button>}

        {m === 'bank_transfer' && chk.bank && (
          <>
            <dl className="kv">
              <dt>{t('bank.beneficiary')}</dt><dd>{chk.bank.beneficiary}</dd>
              <dt>{t('bank.bank')}</dt><dd className="num">{chk.bank.bank} · {chk.bank.bankName}</dd>
              <dt>{t('bank.branch')}</dt><dd className="num">{chk.bank.branch}</dd>
              <dt>{t('bank.account')}</dt><dd className="num">{chk.bank.account}</dd>
              <dt>{t('bank.reference')}</dt><dd className="num" style={{ color: 'var(--accent)' }}>{chk.bank.reference}</dd>
            </dl>
            <p className="small muted" style={{ margin: 0 }}>{t('bank.note')}</p>
            <button className="btn block" disabled={busy} onClick={finish}>{busy ? t('pay.processing') : t('bank.sent')}</button>
          </>
        )}
        <button className="btn ghost block" disabled={busy} onClick={cancel}>{t('pay.cancel')}</button>
      </div>
    </div>
  );
}

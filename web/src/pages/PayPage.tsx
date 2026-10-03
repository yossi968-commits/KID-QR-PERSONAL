import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useI18n } from '../i18n';
import { api } from '../lib/api';

/** Stand-in for the payment provider's hosted checkout page. */
export default function PayPage() {
  const { id } = useParams();
  const { t, fmtMoney } = useI18n();
  const nav = useNavigate();
  const [chk, setChk] = useState<{ amount: number; description: string; status: string } | null>(null);
  const [method, setMethod] = useState('card');
  const [busy, setBusy] = useState(false);
  useEffect(() => { api(`/payments/${id}`).then((r) => setChk(r.checkout)); }, [id]);
  if (!chk) return <div className="container page-head muted">{t('common.loading')}</div>;

  const pay = async () => {
    setBusy(true);
    await new Promise((r) => setTimeout(r, 700));
    const r = await api(`/payments/${id}/complete`, { body: { method } });
    nav(r.returnUrl, { replace: true });
  };
  const cancel = async () => { const r = await api(`/payments/${id}/cancel`, { body: {} }); nav(r.returnUrl, { replace: true }); };

  return (
    <div className="container narrow page-head">
      <div className="card stack">
        <div className="sandbox-tag">🧪 {t('pay.sandbox')}</div>
        <div className="row between"><h2 style={{ margin: 0 }}>🔒 {t('pay.title')}</h2><strong className="num" style={{ fontSize: '1.4rem' }}>{fmtMoney(chk.amount)}</strong></div>
        <div className="muted">{chk.description}</div>
        <div className="chips" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
          {['card', 'bit', 'applepay', 'googlepay'].map((m) => <button key={m} type="button" className={'chip' + (method === m ? ' on' : '')} onClick={() => setMethod(m)}>{t(`pay.${m}` as any)}</button>)}
        </div>
        {method === 'card' && (
          <>
            <label className="field"><span>{t('pay.cardNumber')}</span><input dir="ltr" defaultValue="4580 0000 0000 0000" inputMode="numeric" /></label>
            <div className="grid grid-2" style={{ gap: 12 }}>
              <label className="field"><span>{t('pay.expiry')}</span><input dir="ltr" defaultValue="12/29" /></label>
              <label className="field"><span>{t('pay.cvv')}</span><input dir="ltr" defaultValue="123" /></label>
            </div>
          </>
        )}
        {method === 'bit' && <label className="field"><span>{t('pay.phone')}</span><input dir="ltr" defaultValue="050-0000000" /></label>}
        <button className="btn block" disabled={busy || chk.status !== 'open'} onClick={pay}>{busy ? t('pay.processing') : t('pay.payNow', { amount: fmtMoney(chk.amount) })}</button>
        <button className="btn ghost block" disabled={busy} onClick={cancel}>{t('pay.cancel')}</button>
      </div>
    </div>
  );
}

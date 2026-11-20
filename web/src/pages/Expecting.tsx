import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useI18n } from '../i18n';
import { api, type Partner } from '../lib/api';
import { useErr } from './Auth';

/**
 * Sign-up for expecting parents, usually from a health fund's message (/expecting?p=maccabi).
 * They get reminders late in the pregnancy and after the birth to open the baby's QR.
 */
export default function Expecting() {
  const { t, name: nm, fmtMoney } = useI18n();
  const errText = useErr();
  const [sp] = useSearchParams();
  const [partner, setPartner] = useState<Partner | null>(null);
  const [f, setF] = useState({ name: '', phone: '', dueDate: '' });
  const [consent, setConsent] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  useEffect(() => {
    const slug = sp.get('p');
    if (slug) api<{ partners: Partner[] }>('/partners').then((r) => setPartner(r.partners.find((p) => p.slug === slug) || null));
  }, [sp]);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr('');
    try { await api('/expecting', { body: { ...f, partner: partner?.slug, consent } }); setDone(true); } catch (x) { setErr(errText(x)); }
  };
  const set = (k: keyof typeof f) => (e: any) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="container page-head" style={{ maxWidth: 620 }}>
      <div className="eyebrow">{t('expPub.eyebrow')}</div>
      <h1 style={{ margin: '4px 0 6px' }}>👶 {t('expPub.title')}</h1>
      {partner && <div className="pill" style={{ marginBottom: 8 }}>{partner.logo} {t('expPub.from', { name: nm(partner) })}</div>}
      <p className="muted">{t('expPub.lead')}</p>
      {partner?.kind === 'health_fund' && <div className="banner small" style={{ marginBottom: 12 }}>🎁 {t('open.healthFundGift', { amount: fmtMoney(partner.amount), name: nm(partner) })}</div>}
      {done ? (
        <div className="card"><h3 style={{ margin: 0 }}>🎉 {t('expPub.done')}</h3></div>
      ) : (
        <form className="card stack" onSubmit={submit}>
          <label className="field"><span>{t('expPub.name')}</span><input value={f.name} onChange={set('name')} required autoComplete="name" /></label>
          <label className="field"><span>{t('expPub.phone')}</span><input value={f.phone} onChange={set('phone')} required inputMode="tel" dir="ltr" autoComplete="tel" placeholder="050-1234567" /></label>
          <label className="field"><span>{t('expect.dueDate')}</span><input type="date" value={f.dueDate} onChange={set('dueDate')} required /></label>
          <label className="check"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} required />{t('expPub.consent')}</label>
          {err && <div className="error" role="alert">{err}</div>}
          <button className="btn gold">{t('expPub.submit')}</button>
        </form>
      )}
    </div>
  );
}

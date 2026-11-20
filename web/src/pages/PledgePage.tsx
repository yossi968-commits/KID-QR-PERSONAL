import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useI18n } from '../i18n';
import { api, type Pledge } from '../lib/api';
import { takeReturnTo } from '../components/Pay';
import { useLabels } from '../components/ui';

/**
 * A monthly gift's own page (by unguessable link). For a bank direct debit it shows how to
 * approve the authorization in the giver's bank app; the giver can cancel any time.
 */
export default function PledgePage() {
  const { token } = useParams();
  const { t, fmtMoney, fmtDate } = useI18n();
  const L = useLabels();
  const nav = useNavigate();
  const [d, setD] = useState<{ pledge: Pledge; child: { firstName: string; avatar: string; giftCode: string } } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api(`/pledge/${token}`).then(setD); }, [token]);
  if (!d) return <div className="container page-head muted">{t('common.loading')}</div>;
  const { pledge: p, child } = d;
  const act = async (what: 'authorize' | 'cancel') => {
    setBusy(true);
    const r = await api(`/pledge/${token}/${what}`, { body: {} });
    setD({ ...d, pledge: r.pledge }); setBusy(false);
    if (what === 'authorize') { const back = takeReturnTo(); if (back) nav(back); }
  };
  return (
    <div className="container narrow page-head">
      <div className="card stack">
        <div className="row"><div className="avatar">{child.avatar}</div><div><div className="eyebrow">{L.source(p.source)}</div><h2 style={{ margin: 0 }}>{t('pledge.title', { name: child.firstName })}</h2></div></div>
        <dl className="kv">
          <dt>{t('pledge.amount')}</dt><dd className="num">{fmtMoney(p.amount)} {t('pay.perMonth')}</dd>
          <dt>{t('pay.method')}</dt><dd>{L.method(p.method)}</dd>
          <dt>{t('dash.col.status')}</dt><dd><span className={'pill' + (p.status === 'active' ? ' good' : p.status === 'pending' ? ' gold' : '')}>{t(`pledge.status.${p.status}` as any)}</span></dd>
          {p.status === 'active' && <><dt>{t('pledge.next')}</dt><dd>{fmtDate(p.nextDate)}</dd><dt>{t('pledge.charges')}</dt><dd className="num">{p.charges}</dd></>}
        </dl>
        {p.method === 'masav' && p.status === 'pending' && (
          <div className="card" style={{ background: 'var(--surface-2)' }}>
            <h3>{t('masav.title')}</h3>
            <ol className="small" style={{ paddingInlineStart: 18, margin: 0, display: 'grid', gap: 6 }}>
              <li>{t('masav.step1')}</li>
              <li>{t('masav.step2')}</li>
              <li>{t('masav.step3')} <b className="num">{p.institutionCode}</b></li>
              <li>{t('masav.step4')} <b className="num">{p.mandateRef}</b></li>
              <li>{t('masav.step5', { amount: fmtMoney(p.amount) })}</li>
            </ol>
            <p className="small muted">{t('masav.note')}</p>
            <button className="btn block" disabled={busy} onClick={() => act('authorize')}>🧪 {t('masav.simulate')}</button>
          </div>
        )}
        {p.status !== 'cancelled' && <button className="btn ghost" disabled={busy} onClick={() => act('cancel')}>{t('pledge.cancel')}</button>}
        <Link className="small center" to={`/g/${child.giftCode}`}>{t('pledge.toGiftPage', { name: child.firstName })}</Link>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useI18n } from '../i18n';
import { api, fv } from '../lib/api';

export default function Thanks() {
  const { code, cid } = useParams();
  const { t, fmtMoney } = useI18n();
  const [r, setR] = useState<{ amount: number; giverName: string; childFirstName: string; avatar: string; birthDate: string; status: string } | null>(null);
  useEffect(() => { api(`/gift/${code}/receipt/${cid}`).then(setR); }, [code, cid]);
  if (!r) return <div className="container page-head muted">{t('common.loading')}</div>;
  const age = new Date().getFullYear() - Number(r.birthDate.slice(0, 4));
  return (
    <div className="container narrow page-head">
      <div className="card center stack">
        <div style={{ fontSize: 64 }}>🎉{r.avatar}</div>
        <h1 style={{ fontSize: '1.9rem' }}>{t('thanks.title', { name: r.giverName })}</h1>
        <p style={{ fontSize: '1.1rem' }}>{t('thanks.body', { amount: fmtMoney(r.amount), child: r.childFirstName })}</p>
        <div className="card brand">
          <div className="small">{t('thanks.future')}</div>
          <div className="num" style={{ fontSize: '2.4rem', fontWeight: 800 }}>{fmtMoney(fv(r.amount, 21 - age))}</div>
        </div>
        <div className="row" style={{ justifyContent: 'center' }}>
          <Link className="btn secondary" to={`/g/${code}`}>{t('thanks.another')}</Link>
          <Link className="btn" to="/register">{t('thanks.ownKid')}</Link>
        </div>
      </div>
    </div>
  );
}

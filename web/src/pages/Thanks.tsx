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
  const giftLink = window.location.href.replace(/\/thanks\/[^/?#]*$/, '');
  const share = `https://wa.me/?text=${encodeURIComponent(t('sg.shareText', { name: r.childFirstName }) + giftLink)}`;
  return (
    <div className="container page-head sg">
      <div className="card center stack">
        <div style={{ fontSize: 56 }} aria-hidden>✅</div>
        <div className="eyebrow">{t('sg.done')}</div>
        <h1 style={{ fontSize: '1.7rem', margin: 0 }}>{t('thanks.title', { name: r.giverName })}</h1>
        <p style={{ margin: 0 }}>{r.avatar} {t('thanks.body', { amount: fmtMoney(r.amount), child: r.childFirstName })}</p>
        <div className="sg-worth">📈 {t('thanks.future')} <b className="num">{fmtMoney(fv(r.amount, Math.max(0, 21 - age)))}</b></div>
        <a className="btn secondary block" href={share} target="_blank" rel="noopener">💬 {t('sg.share')}</a>
      </div>
      <div className="own-qr" style={{ marginTop: 14 }}>
        <div style={{ fontSize: 34 }} aria-hidden>👨‍👩‍👧</div>
        <h3>{t('sg.ownTitle')}</h3>
        <p className="small" style={{ margin: 0 }}>{t('sg.ownBody')}</p>
        <Link className="btn block sg-pay" to="/register">{t('sg.ownCta')}</Link>
      </div>
      <div className="center" style={{ marginTop: 12 }}><Link className="sg-link" to={`/g/${code}`}>{t('thanks.another')}</Link></div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import { useAuth } from '../lib/auth';
import { api, type Child } from '../lib/api';

export default function Dashboard() {
  const { t, fmtMoney, fmtDate } = useI18n();
  const { user } = useAuth();
  const [kids, setKids] = useState<Child[] | null>(null);
  useEffect(() => { api<{ children: Child[] }>('/children').then((r) => setKids(r.children)); }, []);
  if (!kids) return <div className="container page-head muted">{t('common.loading')}</div>;
  const total = kids.reduce((s, k) => s + (k.value || 0), 0);
  const dep = kids.reduce((s, k) => s + (k.deposited || 0), 0);

  return (
    <div className="container page-head stack">
      <div className="row between">
        <h1 style={{ fontSize: '1.8rem', margin: 0 }}>{t('dash.title')}</h1>
        <Link className="btn" to="/app/onboarding">＋ {t('dash.add')}</Link>
      </div>
      {user?.kycStatus !== 'verified' && (
        <div className="banner">⚠️ {t('dash.kycBanner')} <Link to="/app/onboarding" className="btn sm">{t('onb.verify')}</Link></div>
      )}
      {kids.length > 0 && (
        <div className="card brand row between">
          <div className="stat"><div className="label">{t('dash.total')}</div><div className="value num">{fmtMoney(total)}</div></div>
          <div className="stat"><div className="label">{t('dash.deposited')}</div><div className="value num" style={{ fontSize: '1.2rem' }}>{fmtMoney(dep)}</div></div>
          <div className="stat"><div className="label">{t('child.gain')}</div><div className="value num" style={{ fontSize: '1.2rem' }}>+{fmtMoney(total - dep)}</div></div>
        </div>
      )}
      {kids.length === 0 && <div className="card center muted">{t('dash.empty')}</div>}
      <div className="grid grid-2">
        {kids.map((k) => {
          const gain = (k.value || 0) - (k.deposited || 0);
          return (
            <Link key={k.id} to={`/app/child/${k.id}`} className="card" style={{ color: 'inherit', textDecoration: 'none' }}>
              <div className="row">
                <div className="avatar">{k.avatar}</div>
                <div>
                  <h3 style={{ margin: 0 }}>{k.firstName} {k.lastName}</h3>
                  <div className="small muted">{t('dash.age')} {k.age} · {t('child.nextBirthday')}: {fmtDate(k.nextBirthday)}</div>
                </div>
              </div>
              <div className="row between" style={{ marginTop: 16 }}>
                <div className="stat"><div className="label">{t('dash.value')}</div><div className="value num">{fmtMoney(k.value || 0)}</div></div>
                <span className="pill good num">+{fmtMoney(gain)}</span>
              </div>
              {k.goalAmount ? (
                <div style={{ marginTop: 12 }}>
                  <div className="row between small muted"><span>🎯 {k.goalText}</span><span className="num">{Math.round(((k.value || 0) / k.goalAmount) * 100)}%</span></div>
                  <div className="progress" style={{ marginTop: 6 }}><div style={{ width: `${Math.min(100, ((k.value || 0) / k.goalAmount) * 100)}%` }} /></div>
                </div>
              ) : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import { api, type Provider } from '../lib/api';
import { AppSection } from '../components/InstallPrompt';
import { QrScanner } from '../components/QrScanner';

function fvAnnuity(perYear: number, years: number, r: number) {
  let v = 0;
  for (let y = 0; y < years; y++) v = v * (1 + r) + perYear;
  return v;
}

/** Entry portal: three doors (kids, parents, admin) plus the gift-code box for guests. */
export default function Portal() {
  const { t, fmtMoney, locale } = useI18n();
  const nav = useNavigate();
  const [code, setCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [givers, setGivers] = useState(15);
  const [amount, setAmount] = useState(150);
  const [providers, setProviders] = useState<Provider[]>([]);
  useEffect(() => { api<{ providers: Provider[] }>('/providers').then((r) => setProviders(r.providers)).catch(() => {}); }, []);
  const yearly = givers * amount * 100;
  const doors: [string, string, string, string][] = [
    ['/login/kid', '🧒', 'portal.kid', 'portal.kidDesc'],
    ['/login/parent', '💼', 'portal.parent', 'portal.parentDesc'],
    ['/login/employer', '🏢', 'portal.employer', 'portal.employerDesc'],
    ['/login/admin', '🛡️', 'portal.admin', 'portal.adminDesc'],
  ];
  return (
    <>
      <section className="portal-hero">
        <div className="container">
          <div className="eyebrow" style={{ color: 'var(--accent)' }}>{t('portal.eyebrow')}</div>
          <h1 style={{ marginTop: 10 }}>{t('portal.title')}</h1>
          <p className="lead">{t('portal.lead')}</p>
          <div className="row" style={{ marginTop: 20 }}>
            <Link className="btn gold" to="/register">{t('portal.open')}</Link>
            <Link className="btn secondary" to="/g/itay2013demo" style={{ background: 'transparent', color: '#fff', borderColor: 'rgba(255,255,255,.3)' }}>{t('portal.sample')}</Link>
          </div>
        </div>
      </section>
      <div className="container">
        <div className="doors">
          {doors.map(([to, icon, title, desc]) => (
            <Link key={to} to={to} className="door">
              <div className="door-icon">{icon}</div>
              <h3>{t(title as any)}</h3>
              <p className="muted small" style={{ margin: 0 }}>{t(desc as any)}</p>
              <span className="go">{t('portal.enter')}</span>
            </Link>
          ))}
        </div>

        <section className="section grid grid-2" style={{ alignItems: 'start' }}>
          <div className="card">
            <h2>{t('portal.codeTitle')}</h2>
            <p className="muted">{t('portal.codeDesc')}</p>
            <form className="row" style={{ flexWrap: 'nowrap' }} onSubmit={(e) => { e.preventDefault(); if (code.trim()) nav('/g/' + code.trim().toLowerCase()); }}>
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder={t('land.scanPlaceholder')} dir="ltr" aria-label={t('land.scanPlaceholder')} />
              <button className="btn">{t('land.scanGo')}</button>
            </form>
            <div className="scan-or small muted"><span>{t('scan.or')}</span></div>
            <button type="button" className="btn gold block" onClick={() => setScanning(true)}>📷 {t('scan.button')}</button>
            {scanning && <QrScanner onClose={() => setScanning(false)} onCode={(c) => { setScanning(false); nav('/g/' + c); }} />}
          </div>
          <div className="card">
            <div className="card-head"><h3>{t('land.calcTitle')}</h3><span className="pill brand num">{fmtMoney(yearly)} {t('common.perYear')}</span></div>
            <label className="field"><span>{t('land.calcGivers')}: <b className="num">{givers}</b></span><input type="range" min={3} max={40} value={givers} onChange={(e) => setGivers(+e.target.value)} /></label>
            <label className="field" style={{ marginTop: 8 }}><span>{t('land.calcAmount')}: <b className="num">₪{amount}</b></span><input type="range" min={36} max={500} step={2} value={amount} onChange={(e) => setAmount(+e.target.value)} /></label>
            <div className="row between" style={{ marginTop: 12 }}>
              <span className="muted">{t('land.calcResult')}</span>
              <strong className="num" style={{ fontSize: '1.6rem', fontFamily: 'var(--font-display)' }}>{fmtMoney(fvAnnuity(yearly, 22, 0.065))}</strong>
            </div>
            <p className="small muted" style={{ margin: '8px 0 0' }}>{t('land.calcNote')}</p>
          </div>
        </section>

        <section className="section" style={{ paddingTop: 0 }}>
          <div className="eyebrow">{t('portal.howEyebrow')}</div>
          <h2 style={{ marginTop: 6 }}>{t('land.howTitle')}</h2>
          <div className="grid grid-4" style={{ marginTop: 16 }}>
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="card">
                <div className="step-num">{n}</div>
                <h3>{t(`portal.how${n}t` as any)}</h3>
                <p className="muted small" style={{ margin: 0 }}>{t(`portal.how${n}d` as any)}</p>
              </div>
            ))}
          </div>
        </section>

        {providers.length > 0 && (
          <section className="section" style={{ paddingTop: 0 }}>
            <div className="card">
              <div className="card-head"><h3>{t('portal.providersTitle')}</h3><span className="pill gold">{t('fund.example')}</span></div>
              <div className="row" style={{ gap: 8 }}>
                {providers.map((p) => <span key={p.id} className="pill">{locale === 'he' ? p.name : p.nameEn}</span>)}
              </div>
              <p className="small muted" style={{ margin: '10px 0 0' }}>{t('portal.providersNote')}</p>
            </div>
          </section>
        )}

        <AppSection />
      </div>
      <footer className="site"><div className="container">{t('footer.regulatory')}</div></footer>
    </>
  );
}

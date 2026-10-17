import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ProviderName } from '../components/ProviderMark';
import { useI18n } from '../i18n';
import { api, type Provider } from '../lib/api';
import { AppSection } from '../components/InstallPrompt';
import { QrScanner } from '../components/QrScanner';
import { ScenarioCalc } from '../components/ScenarioCalc';
import { Hl } from '../components/Hl';

/** Entry portal: three doors (kids, parents, admin) plus the gift-code box for guests. */
export default function Portal() {
  const { t, fmtMoney, name } = useI18n();
  const nav = useNavigate();
  const [code, setCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [providers, setProviders] = useState<Provider[]>([]);
  useEffect(() => { api<{ providers: Provider[] }>('/providers').then((r) => setProviders(r.providers)).catch(() => {}); }, []);
  const doors: [string, string, string, string][] = [
    ['/login/kid', '🧒', 'portal.kid', 'portal.kidDesc'],
    ['/login/parent', '💼', 'portal.parent', 'portal.parentDesc'],
    ['/login/employer', '🏢', 'portal.employer', 'portal.employerDesc'],
    ['/login/admin', '🛡️', 'portal.admin', 'portal.adminDesc'],
  ];
  return (
    <>
      <section className="portal-hero">
        <div className="container hero-grid">
          <div>
            <div className="eyebrow" style={{ color: 'var(--accent)' }}>{t('portal.eyebrow')}</div>
            <h1 style={{ marginTop: 10 }}><Hl text={t('portal.title')} /></h1>
            <p className="lead">{t('portal.lead')}</p>
            <div className="row" style={{ marginTop: 20 }}>
              <Link className="btn gold" to="/register">{t('portal.open')}</Link>
              <Link className="btn secondary on-dark" to="/g/itay2013demo">{t('portal.sample')}</Link>
            </div>
            <p style={{ marginTop: 14 }}><Link to="/expecting" style={{ color: 'var(--accent)' }}>🤰 {t('expPub.link')}</Link></p>
          </div>
          <HeroCard />
        </div>
      </section>
      <div className="container">
        <ul className="trust-row">
          {([['🧒', 'trust.name'], ['🏛️', 'trust.reg'], ['✍️', 'trust.sign'], ['🎁', 'trust.family']] as const).map(([i, k]) => (
            <li key={k}><span aria-hidden>{i}</span>{t(k)}</li>
          ))}
        </ul>
      </div>
      <div className="container">
        <div className="doors">
          {doors.map(([to, icon, title, desc]) => (
            <Link key={to} to={to} className="door">
              <div className="door-head"><div className="door-icon">{icon}</div><h3>{t(title as any)}</h3></div>
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
          <ScenarioCalc />
        </section>

        <section className="section" style={{ paddingTop: 0 }}>
          <div className="eyebrow">{t('portal.howEyebrow')}</div>
          <h2 style={{ marginTop: 6 }}>{t('land.howTitle')}</h2>
          <div className="grid grid-4" style={{ marginTop: 16 }}>
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="card">
                <div className="step-head"><div className="step-num">{n}</div><h3>{t(`portal.how${n}t` as any)}</h3></div>
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
                {providers.map((p) => <span key={p.id} className="pill" style={{ padding: '4px 10px 4px 4px', paddingInlineStart: 4 }}><ProviderName id={p.id} name={name(p)} size={24} /></span>)}
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

/** A sample child's savings as the app shows it, with gifts arriving: the hero's picture. */
function HeroCard() {
  const { t, fmtMoney } = useI18n();
  return (
    <div className="hero-card" aria-hidden>
      <div className="hc-main">
        <div className="hc-top"><span className="hc-avatar">🦄</span><span><b>{t('hero.card.of')}</b><small>{t('hero.card.age')}</small></span></div>
        <div className="hc-value num">{fmtMoney(1807500)}</div>
        <div className="hc-grew"><span className="pill-up">▲ 9.8%</span>{t('hero.card.grew')}</div>
        <svg className="hc-spark" viewBox="0 0 200 56" preserveAspectRatio="none"><path d="M0 50 C30 46 45 40 70 36 S115 30 135 20 S175 10 200 4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
      </div>
      <div className="hc-note n1"><span className="hc-gift">🎁</span><span><b className="num">{fmtMoney(20000)}</b><small>{t('hero.card.gift1')}</small></span></div>
      <div className="hc-note n2"><span className="hc-gift mint">💚</span><span><b className="num">{fmtMoney(10000)}</b><small>{t('hero.card.gift2')}</small></span></div>
    </div>
  );
}

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import { useAuth } from '../lib/auth';
import MoneyTree from '../components/MoneyTree';

function fvAnnuity(perYear: number, years: number, r: number) {
  let v = 0;
  for (let y = 0; y < years; y++) v = v * (1 + r) + perYear;
  return v;
}

export default function Landing() {
  const { t, fmtMoney, locale } = useI18n();
  const { user } = useAuth();
  const nav = useNavigate();
  const [givers, setGivers] = useState(15);
  const [amount, setAmount] = useState(100);
  const [code, setCode] = useState('');
  const yearly = givers * amount * 100;
  const at21 = fvAnnuity(yearly, 22, 0.065);

  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <span className="pill gold">🎁 {t('tagline')}</span>
            <h1 style={{ marginTop: 16 }}>{t('land.heroTitle')}</h1>
            <p className="lead">{t('land.heroSub')}</p>
            <div className="row" style={{ marginTop: 24 }}>
              <Link className="btn" to={user ? '/app' : '/register'}>{t('land.ctaStart')}</Link>
              <Link className="btn secondary" to="/g/itay2013demo">{t('land.ctaDemo')}</Link>
            </div>
            <div className="trust" style={{ marginTop: 24 }}>🛡️ {t('land.trust')}</div>
          </div>
          <div className="phone">
            <div className="center">
              <div className="avatar lg" style={{ margin: '0 auto' }}>🚀</div>
              <h3 style={{ marginTop: 10 }}>{t('gift.title', { name: locale === 'he' ? 'איתי' : 'Itay' })}</h3>
              <MoneyTree value={3000000} deposited={1600000} size={240} />
              <div className="chips" style={{ marginTop: 8 }}>
                {[52, 100, 180, 360].map((a, i) => <span key={a} className={'chip' + (i === 2 ? ' on' : '')}>₪{a}</span>)}
              </div>
              <div className="btn gold block" style={{ marginTop: 12 }}>{t('gift.submit', { amount: '₪180' })}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" style={{ background: 'var(--surface)' }}>
        <div className="container">
          <h2 className="center">{t('land.howTitle')}</h2>
          <div className="grid grid-3" style={{ marginTop: 24 }}>
            {[1, 2, 3].map((n) => (
              <div key={n} className="card flat">
                <div className="step-num">{n}</div>
                <h3>{t(`land.how${n}t` as any)}</h3>
                <p className="muted" style={{ margin: 0 }}>{t(`land.how${n}d` as any)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container grid grid-2" style={{ alignItems: 'center' }}>
          <div>
            <h2>{t('land.calcTitle')}</h2>
            <label className="field" style={{ marginTop: 16 }}>
              <span>{t('land.calcGivers')}: <b className="num">{givers}</b></span>
              <input type="range" min={3} max={40} value={givers} onChange={(e) => setGivers(+e.target.value)} />
            </label>
            <label className="field" style={{ marginTop: 12 }}>
              <span>{t('land.calcAmount')}: <b className="num">₪{amount}</b></span>
              <input type="range" min={36} max={500} step={2} value={amount} onChange={(e) => setAmount(+e.target.value)} />
            </label>
            <p className="small muted" style={{ marginTop: 12 }}>{t('land.calcNote')}</p>
          </div>
          <div className="card brand center">
            <div className="stat">
              <div className="label">{t('land.calcResult')}</div>
              <div className="value num" style={{ fontSize: '2.6rem' }}>{fmtMoney(at21)}</div>
              <div className="muted small num">{fmtMoney(yearly)} {t('common.perYear')} × 22</div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" style={{ background: 'var(--surface)' }}>
        <div className="container">
          <h2 className="center">{t('land.layersTitle')}</h2>
          <div className="grid grid-4" style={{ marginTop: 24 }}>
            {[['🎁', 1], ['📈', 2], ['🎓', 3], ['🏦', 4]].map(([icon, n]) => (
              <div key={n} className="card flat">
                <div className="layer-icon">{icon}</div>
                <h3>{t(`land.layer${n}t` as any)}</h3>
                <p className="muted small" style={{ margin: 0 }}>{t(`land.layer${n}d` as any)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container narrow center">
          <h2>{t('land.scanTitle')}</h2>
          <form className="row" style={{ justifyContent: 'center', flexWrap: 'nowrap' }} onSubmit={(e) => { e.preventDefault(); if (code.trim()) nav('/g/' + code.trim().toLowerCase()); }}>
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder={t('land.scanPlaceholder')} dir="ltr" />
            <button className="btn">{t('land.scanGo')}</button>
          </form>
        </div>
      </section>

      <footer className="site"><div className="container">{t('land.footer')}</div></footer>
    </>
  );
}

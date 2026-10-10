import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import iconUrl from '../../public/icon.svg';

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

// Chrome/Edge fire this once, early; keep it so any screen can offer the install later.
let deferred: BIPEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e as BIPEvent; listeners.forEach((f) => f()); });
  window.addEventListener('appinstalled', () => { deferred = null; listeners.forEach((f) => f()); });
}

export const isStandalone = () =>
  typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true);
export const isIos = () => typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);

function useInstall() {
  const [, bump] = useState(0);
  useEffect(() => { const f = () => bump((n) => n + 1); listeners.add(f); return () => { listeners.delete(f); }; }, []);
  return {
    canPrompt: !!deferred,
    installed: isStandalone(),
    ios: isIos(),
    prompt: async () => { if (!deferred) return; await deferred.prompt(); await deferred.userChoice; deferred = null; listeners.forEach((f) => f()); },
  };
}

/** Portal section: how to get the app on iPhone, Android and the computer. */
export function AppSection() {
  const { t } = useI18n();
  const ins = useInstall();
  const cards: [string, string, string][] = [['📱', 'app.iphone', 'app.iphoneSteps'], ['🤖', 'app.android', 'app.androidSteps'], ['💻', 'app.desktop', 'app.desktopSteps']];
  return (
    <section className="section" style={{ paddingTop: 0 }} id="app">
      <div className="card app-card">
        <div className="app-head">
          <img src={iconUrl} alt="" width={72} height={72} className="app-icon" />
          <div>
            <h2 style={{ margin: 0 }}>{t('app.title')}</h2>
            <p className="muted" style={{ margin: '6px 0 0' }}>{t('app.lead')}</p>
          </div>
        </div>
        <div className="grid grid-3" style={{ marginTop: 16 }}>
          {cards.map(([icon, title, steps]) => (
            <div key={title} className="app-way">
              <h3>{icon} {t(title as any)}</h3>
              <p className="small muted" style={{ margin: 0 }}>{t(steps as any)}</p>
            </div>
          ))}
        </div>
        <div className="row" style={{ marginTop: 16 }}>
          {ins.installed ? <span className="pill brand">✓ {t('app.installed')}</span>
            : ins.canPrompt ? <button className="btn gold" onClick={ins.prompt}>⬇ {t('app.install')}</button> : null}
          <Link className="btn secondary" to="/login/parent">{t('app.login')}</Link>
        </div>
      </div>
    </section>
  );
}

/** A one-line offer to add the app to the home screen; hidden once installed or dismissed. */
export function InstallBanner() {
  const { t } = useI18n();
  const ins = useInstall();
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem('kfq.installDismissed') === '1'; } catch { return false; } });
  if (hidden || ins.installed || !(ins.canPrompt || ins.ios)) return null;
  const close = () => { setHidden(true); try { localStorage.setItem('kfq.installDismissed', '1'); } catch { /* private mode */ } };
  return (
    <div className="install-banner" role="region" aria-label={t('app.install')}>
      <div className="container row between" style={{ flexWrap: 'nowrap' }}>
        <img src={iconUrl} alt="" width={36} height={36} style={{ borderRadius: 9 }} />
        <span className="small" style={{ flex: 1 }}><b>{t('app.bannerText')}</b>{ins.ios && !ins.canPrompt && <> {t('app.iosHint')}</>}</span>
        {ins.canPrompt && <button className="btn sm gold" onClick={ins.prompt}>{t('app.install')}</button>}
        <button className="link small" onClick={close}>{t('app.later')}</button>
      </div>
    </div>
  );
}

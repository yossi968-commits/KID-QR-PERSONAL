import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useI18n } from '../i18n';

/** Shortcut bar shown only in the in-browser demo build: one tap into every entry and age design. */
export default function DemoBar() {
  const { login, loginKid, loginEmployer, logout } = useAuth();
  const { t } = useI18n();
  const nav = useNavigate();
  const go = async (fn: () => Promise<unknown>, to: string) => { logout(); await fn(); nav(to); };
  // Sit right under the page's header (logo and language), or at the very top when the page has none.
  const [host] = useState(() => document.createElement('div'));
  const [under, setUnder] = useState(false);
  useEffect(() => {
    const root = document.getElementById('root')!;
    const place = () => {
      const top = root.querySelector('.topbar, .kid-top, .mid-top, .sen-top');
      if (top && top.nextSibling !== host) top.after(host);
      if (!top && host.isConnected) host.remove();
      setUnder(!!top);
    };
    place();
    const mo = new MutationObserver(place);
    mo.observe(root, { childList: true, subtree: true });
    return () => { mo.disconnect(); host.remove(); };
  }, [host]);
  const bar = (
    <div className="demo-bar">
      <div className="container row" style={{ gap: 6 }}>
        <strong>🧪 {t('demo.label')}</strong>
        <span className="small hide-sm">{t('demo.note')}</span>
        <span className="spacer" />
        <button className="btn sm secondary" onClick={() => { logout(); nav('/'); }}>{t('demo.portal')}</button>
        <button className="btn sm" onClick={() => go(() => login('demo@kfq.app', 'demo1234', 'parent'), '/parent')}>💼 {t('demo.parent')}</button>
        <button className="btn sm secondary" onClick={() => go(() => loginKid('noa', '1234'), '/kid')}>🦄 {t('demo.young')}</button>
        <button className="btn sm secondary" onClick={() => go(() => loginKid('itay', '1234'), '/kid')}>🚀 {t('demo.middle')}</button>
        <button className="btn sm secondary" onClick={() => go(() => loginKid('omer', '1234'), '/kid')}>⭐ {t('demo.senior')}</button>
        <button className="btn sm secondary" onClick={() => go(() => loginKid('shira', '1234'), '/kid')}>🎓 {t('demo.adult')}</button>
        <button className="btn sm secondary" onClick={() => go(() => loginEmployer('hr@alpha.example', 'demo1234'), '/employer')}>🏢 {t('demo.employer')}</button>
        <button className="btn sm secondary" onClick={() => go(() => login('admin@kfq.app', 'admin1234', 'admin'), '/admin')}>🛡️ {t('demo.admin')}</button>
        <button className="btn sm secondary" onClick={() => { logout(); nav('/g/itay2013demo'); }}>🎁 {t('demo.gift')}</button>
      </div>
    </div>
  );
  return under ? createPortal(bar, host) : bar;
}

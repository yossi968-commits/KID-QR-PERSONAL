import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useI18n } from '../i18n';

/** Shortcut bar shown only in the in-browser demo build: one tap into every entry and age design. */
export default function DemoBar() {
  const { login, loginKid, loginEmployer, logout } = useAuth();
  const { t } = useI18n();
  const nav = useNavigate();
  const go = async (fn: () => Promise<unknown>, to: string) => { logout(); await fn(); nav(to); };
  return (
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
        <button className="btn sm secondary" onClick={() => go(() => loginEmployer('hr@alpha.example', 'demo1234'), '/employer')}>🏢 {t('demo.employer')}</button>
        <button className="btn sm secondary" onClick={() => go(() => login('admin@kfq.app', 'admin1234', 'admin'), '/admin')}>🛡️ {t('demo.admin')}</button>
        <button className="btn sm secondary" onClick={() => { logout(); nav('/g/itay2013demo'); }}>🎁 {t('demo.gift')}</button>
      </div>
    </div>
  );
}

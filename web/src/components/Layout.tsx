import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import { useAuth } from '../lib/auth';

export default function Layout() {
  const { t, locale, setLocale } = useI18n();
  const { user, logout } = useAuth();
  const nav = useNavigate();
  return (
    <>
      <header className="topbar">
        <div className="container">
          <Link to="/" className="logo"><img src="/icon.svg" alt="" />{t('appName')}</Link>
          <span className="spacer" />
          <nav className="nav">
            {user ? (
              <>
                <NavLink to="/app">{t('nav.dashboard')}</NavLink>
                {user.role === 'admin' && <NavLink to="/admin">{t('nav.admin')}</NavLink>}
                <button className="link nav-btn hide-sm" onClick={() => { logout(); nav('/'); }} style={{ padding: '8px 12px', color: 'var(--ink-2)' }}>{t('nav.logout')}</button>
              </>
            ) : (
              <>
                <NavLink to="/login" className="hide-sm">{t('nav.login')}</NavLink>
                <Link to="/register" className="btn sm">{t('nav.register')}</Link>
              </>
            )}
            <button className="btn ghost sm" onClick={() => setLocale(locale === 'he' ? 'en' : 'he')} aria-label="language">{t('lang.toggle')}</button>
          </nav>
        </div>
      </header>
      <main><Outlet /></main>
    </>
  );
}

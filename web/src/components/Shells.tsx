import { Link, NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useI18n, LOCALES, type Locale } from '../i18n';
import { useAuth } from '../lib/auth';
import { api, type User } from '../lib/api';
import iconSvg from '../../public/icon.svg?raw';
// Inlined so the single-file demo shows it too (the file is past the 4KB auto-inline limit).
const iconUrl = 'data:image/svg+xml,' + encodeURIComponent(iconSvg);
import { InstallBanner } from './InstallPrompt';

export function LangButton({ className = 'lang' }: { className?: string }) {
  const { t, locale, setLocale } = useI18n();
  const { user, setUser } = useAuth();
  const change = (l: Locale) => {
    setLocale(l);
    // Signed-in parents keep the language on their account, so the next login opens in it.
    if (user) api<{ user: User }>('/auth/me', { method: 'PATCH', body: { locale: l } }).then((r) => setUser(r.user)).catch(() => {});
  };
  return (
    <select className={className + ' lang-select'} value={locale} onChange={(e) => change(e.target.value as Locale)} aria-label={t('lang.label')}>
      {LOCALES.map((l) => <option key={l} value={l} lang={l}>{t(`lang.${l}` as const)}</option>)}
    </select>
  );
}

export function Logo({ sub, to = '/' }: { sub?: string; to?: string }) {
  const { t } = useI18n();
  return <Link to={to} className="logo"><img src={iconUrl} alt="" />{t('appName')}{sub && <small>{sub}</small>}</Link>;
}

/** Public pages: entry portal, logins, gift page and checkout. */
export function PublicShell() {
  const { t } = useI18n();
  return (
    <div className="shell theme-parent">
      <header className="topbar">
        <div className="container">
          <Logo />
          <span className="spacer" />
          <nav className="nav">
            <NavLink to="/login/parent" className="hide-sm">{t('portal.parent')}</NavLink>
            <NavLink to="/login/kid" className="hide-sm">{t('portal.kid')}</NavLink>
            <LangButton />
          </nav>
        </div>
      </header>
      <main><Outlet /></main>
    </div>
  );
}

/** Parents: formal, private-banking look. */
export function ParentShell() {
  const { t } = useI18n();
  const { user, loading, logout } = useAuth();
  const nav = useNavigate();
  if (loading) return null;
  if (!user) return <Navigate to="/login/parent" replace />;
  if (user.role === 'admin') return <Navigate to="/admin" replace />;
  return (
    <div className="shell theme-parent">
      <header className="topbar">
        <div className="container">
          <Logo sub={t('parent.area')} to="/parent" />
          <span className="spacer" />
          <nav className="nav">
            <NavLink to="/parent" end>{t('parent.nav.portfolio')}</NavLink>
            <NavLink to="/parent/new" className="hide-sm">{t('parent.nav.open')}</NavLink>
            <span className="hide-sm" style={{ color: 'var(--header-muted)', fontSize: '0.85rem', paddingInline: 8 }}>{user.name}</span>
            <button className="link" onClick={() => { logout(); nav('/'); }}>{t('nav.logout')}</button>
            <LangButton />
          </nav>
        </div>
      </header>
      <InstallBanner />
      <main><Outlet /></main>
      <footer className="site"><div className="container">{t('footer.regulatory')}</div></footer>
    </div>
  );
}

/** Admin: operations console with a sidebar. */
export function AdminShell() {
  const { t } = useI18n();
  const { user, loading, logout } = useAuth();
  const nav = useNavigate();
  if (loading) return null;
  if (!user || user.role !== 'admin') return <Navigate to="/login/admin" replace />;
  const items: [string, string, string][] = [
    ['/admin', '▦', 'admin.nav.overview'], ['/admin/analytics', '📈', 'admin.nav.analytics'], ['/admin/partners', '🤝', 'admin.nav.partners'], ['/admin/applications', '🗂', 'admin.nav.applications'], ['/admin/payments', '⇄', 'admin.nav.payments'],
    ['/admin/users', '👥', 'admin.nav.users'], ['/admin/outbox', '✉', 'admin.nav.outbox'],
  ];
  return (
    <div className="shell theme-admin">
      <div className="admin-shell">
        <aside className="admin-side">
          <Logo sub={t('admin.console')} to="/admin" />
          <div className="side-label">{t('admin.nav.label')}</div>
          {items.map(([to, icon, k]) => <NavLink key={to} to={to} end={to === '/admin'}><span aria-hidden>{icon}</span>{t(k as any)}</NavLink>)}
          <span className="spacer" />
          <LangButton className="" />
          <button onClick={() => { logout(); nav('/'); }}>⎋ {t('nav.logout')}</button>
        </aside>
        <div className="admin-main"><Outlet /></div>
      </div>
    </div>
  );
}

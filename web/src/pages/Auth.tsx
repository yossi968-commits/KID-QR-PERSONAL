import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import { useAuth } from '../lib/auth';
import { ApiError } from '../lib/api';

export function useErr() {
  const { t } = useI18n();
  return (e: unknown) => (e instanceof ApiError ? t(('err.' + e.code) as any) : t('common.error'));
}

type Portal = 'kid' | 'parent' | 'employer' | 'admin';
const ICON: Record<Portal, string> = { kid: '🧒', parent: '💼', employer: '🏢', admin: '🛡️' };

function Switcher({ current }: { current: Portal }) {
  const { t } = useI18n();
  return (
    <div className="login-switch muted">
      {(['kid', 'parent', 'employer', 'admin'] as Portal[]).filter((p) => p !== current).map((p, i) => (
        <span key={p}>{i > 0 && '· '}<Link to={`/login/${p}`}>{t(`portal.${p}` as any)}</Link></span>
      ))}
    </div>
  );
}

/** Separate sign-in pages for each entry: children use a username and PIN. */
export function Login({ portal }: { portal: Portal }) {
  const { t } = useI18n();
  const { login, loginKid, loginEmployer } = useAuth();
  const nav = useNavigate();
  const errText = useErr();
  const [id, setId] = useState('');
  const [secret, setSecret] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      if (portal === 'kid') { await loginKid(id.trim(), secret); nav('/kid'); }
      else if (portal === 'employer') { await loginEmployer(id, secret); nav('/employer'); }
      else { await login(id, secret, portal as 'parent' | 'admin'); nav(portal === 'admin' ? '/admin' : '/parent'); }
    } catch (x) { setErr(errText(x)); } finally { setBusy(false); }
  };
  return (
    <div className="login-wrap container">
      <form className="card stack login-card" onSubmit={submit}>
        <span className="portal-tag">{ICON[portal]} {t(`portal.${portal}` as any)}</span>
        <h2 style={{ margin: 0 }}>{t(`login.${portal}.title` as any)}</h2>
        <p className="muted small" style={{ margin: 0 }}>{t(`login.${portal}.desc` as any)}</p>
        {portal === 'kid' ? (
          <>
            <label className="field"><span>{t('login.username')}</span><input dir="ltr" value={id} onChange={(e) => setId(e.target.value)} required autoComplete="username" autoCapitalize="none" /></label>
            <label className="field"><span>{t('login.pin')}</span><input type="password" inputMode="numeric" dir="ltr" maxLength={6} value={secret} onChange={(e) => setSecret(e.target.value.replace(/\D/g, ''))} required style={{ letterSpacing: '0.5em', fontSize: '1.3rem', textAlign: 'center' }} /></label>
          </>
        ) : (
          <>
            <label className="field"><span>{t('auth.email')}</span><input type="email" dir="ltr" value={id} onChange={(e) => setId(e.target.value)} required autoComplete="email" /></label>
            <label className="field"><span>{t('auth.password')}</span><input type="password" dir="ltr" value={secret} onChange={(e) => setSecret(e.target.value)} required autoComplete="current-password" /></label>
          </>
        )}
        {err && <div className="error" role="alert">{err}</div>}
        <button className="btn block" disabled={busy}>{t('auth.submitLogin')}</button>
        {portal === 'parent' && <div className="small muted center">{t('auth.noAccount')} <Link to="/register">{t('nav.register')}</Link></div>}
        {portal === 'kid' && <div className="small muted center">{t('login.kid.help')}</div>}
        <div className="sandbox-tag">{t(`login.${portal}.demo` as any)}</div>
        <Switcher current={portal} />
      </form>
    </div>
  );
}

export function Register() {
  const { t, locale } = useI18n();
  const { register } = useAuth();
  const nav = useNavigate();
  const errText = useErr();
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '' });
  const [err, setErr] = useState('');
  const set = (k: keyof typeof f) => (e: any) => setF({ ...f, [k]: e.target.value });
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr('');
    try {
      await register({ ...f, locale });
      nav('/parent/new');
    } catch (x) { setErr(errText(x)); }
  };
  return (
    <div className="login-wrap container">
      <form className="card stack login-card" onSubmit={submit}>
        <span className="portal-tag">💼 {t('portal.parent')}</span>
        <h2 style={{ margin: 0 }}>{t('auth.registerTitle')}</h2>
        <label className="field"><span>{t('auth.name')}</span><input value={f.name} onChange={set('name')} required autoComplete="name" /></label>
        <label className="field"><span>{t('auth.email')}</span><input type="email" dir="ltr" value={f.email} onChange={set('email')} required autoComplete="email" /></label>
        <label className="field"><span>{t('auth.phone')}</span><input type="tel" dir="ltr" value={f.phone} onChange={set('phone')} autoComplete="tel" /></label>
        <label className="field"><span>{t('auth.password')}</span><input type="password" dir="ltr" minLength={8} value={f.password} onChange={set('password')} required autoComplete="new-password" /></label>
        {err && <div className="error" role="alert">{err}</div>}
        <button className="btn block">{t('auth.submitRegister')}</button>
        <div className="small muted center">{t('auth.haveAccount')} <Link to="/login/parent">{t('nav.login')}</Link></div>
      </form>
    </div>
  );
}

import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import { useAuth } from '../lib/auth';
import { ApiError } from '../lib/api';

export function useErr() {
  const { t } = useI18n();
  return (e: unknown) => (e instanceof ApiError ? t(('err.' + e.code) as any) : t('common.error'));
}

export function Login() {
  const { t } = useI18n();
  const { login } = useAuth();
  const nav = useNavigate();
  const errText = useErr();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr('');
    try {
      const u = await login(email, password);
      nav(u.role === 'admin' ? '/admin' : '/app');
    } catch (x) { setErr(errText(x)); }
  };
  return (
    <div className="container narrow page-head">
      <form className="card stack" onSubmit={submit}>
        <h2>{t('auth.loginTitle')}</h2>
        <label className="field"><span>{t('auth.email')}</span><input type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></label>
        <label className="field"><span>{t('auth.password')}</span><input type="password" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" /></label>
        {err && <div className="error">{err}</div>}
        <button className="btn block">{t('auth.submitLogin')}</button>
        <div className="small muted">{t('auth.noAccount')} <Link to="/register">{t('nav.register')}</Link></div>
        <div className="sandbox-tag">{t('auth.demoHint')}</div>
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
      nav('/app/onboarding');
    } catch (x) { setErr(errText(x)); }
  };
  return (
    <div className="container narrow page-head">
      <form className="card stack" onSubmit={submit}>
        <h2>{t('auth.registerTitle')}</h2>
        <label className="field"><span>{t('auth.name')}</span><input value={f.name} onChange={set('name')} required autoComplete="name" /></label>
        <label className="field"><span>{t('auth.email')}</span><input type="email" dir="ltr" value={f.email} onChange={set('email')} required autoComplete="email" /></label>
        <label className="field"><span>{t('auth.phone')}</span><input type="tel" dir="ltr" value={f.phone} onChange={set('phone')} autoComplete="tel" /></label>
        <label className="field"><span>{t('auth.password')}</span><input type="password" dir="ltr" minLength={8} value={f.password} onChange={set('password')} required autoComplete="new-password" /></label>
        {err && <div className="error">{err}</div>}
        <button className="btn block">{t('auth.submitRegister')}</button>
        <div className="small muted">{t('auth.haveAccount')} <Link to="/login">{t('nav.login')}</Link></div>
      </form>
    </div>
  );
}

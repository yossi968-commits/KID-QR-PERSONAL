import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import { useAuth, type OtpSent } from '../lib/auth';
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
  const [emailMode, setEmailMode] = useState(false);
  if (portal === 'parent' && !emailMode) return <PhoneLogin onEmail={() => setEmailMode(true)} />;
  return <PasswordLogin portal={portal} />;
}

function PasswordLogin({ portal }: { portal: Portal }) {
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

/** Parents sign in with their ID and the phone they registered with; a 6-digit code arrives by SMS. */
function PhoneLogin({ onEmail }: { onEmail: () => void }) {
  const { t } = useI18n();
  const { requestCode, loginOtp } = useAuth();
  const nav = useNavigate();
  const errText = useErr();
  const [f, setF] = useState({ nationalId: '', phone: '' });
  const [sent, setSent] = useState<OtpSent | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const ask = async (e?: FormEvent) => {
    e?.preventDefault(); setErr(''); setBusy(true);
    try { setSent(await requestCode(f.nationalId, f.phone)); } catch (x) { setErr(errText(x)); } finally { setBusy(false); }
  };
  return (
    <div className="login-wrap container">
      <div className="card stack login-card">
        <span className="portal-tag">💼 {t('portal.parent')}</span>
        <h2 style={{ margin: 0 }}>{t('login.parent.title')}</h2>
        {!sent ? (
          <form className="stack" onSubmit={ask}>
            <p className="muted small" style={{ margin: 0 }}>{t('otp.desc')}</p>
            <label className="field"><span>{t('otp.id')}</span><input inputMode="numeric" dir="ltr" maxLength={9} value={f.nationalId} onChange={(e) => setF({ ...f, nationalId: e.target.value.replace(/\D/g, '') })} required autoComplete="off" /></label>
            <label className="field"><span>{t('otp.phone')}</span><input type="tel" dir="ltr" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} required autoComplete="tel" placeholder="050-0000000" /></label>
            {err && <div className="error" role="alert">{err}</div>}
            <button className="btn block" disabled={busy}>{t('otp.send')}</button>
          </form>
        ) : (
          <CodeStep sent={sent} onResend={() => ask()} onBack={() => setSent(null)} onVerify={async (code) => { await loginOtp(f.nationalId, f.phone, code); nav('/parent'); }} />
        )}
        <div className="small muted center">{t('auth.noAccount')} <Link to="/register">{t('nav.register')}</Link> · <button type="button" className="linklike" onClick={onEmail}>{t('otp.useEmail')}</button></div>
        <div className="sandbox-tag">{t('otp.demo')}</div>
        <Switcher current="parent" />
      </div>
    </div>
  );
}

/** Six boxes for the SMS code: paste or type, iOS/Android can fill it from the message. */
function CodeStep({ sent, onVerify, onResend, onBack }: { sent: OtpSent; onVerify: (code: string) => Promise<void>; onResend: () => void; onBack: () => void }) {
  const { t } = useI18n();
  const errText = useErr();
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [err, setErr] = useState('');
  const [wait, setWait] = useState(30);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  useEffect(() => { refs.current[0]?.focus(); setDigits(['', '', '', '', '', '']); setWait(30); }, [sent]);
  useEffect(() => { if (wait <= 0) return; const id = setTimeout(() => setWait(wait - 1), 1000); return () => clearTimeout(id); }, [wait]);
  const verify = async (code: string) => { setErr(''); try { await onVerify(code); } catch (x) { setErr(errText(x)); setDigits(['', '', '', '', '', '']); refs.current[0]?.focus(); } };
  const put = (i: number, v: string) => {
    const chars = v.replace(/\D/g, '').split('');
    if (!chars.length) { const d = [...digits]; d[i] = ''; setDigits(d); return; }
    const d = [...digits];
    chars.slice(0, 6 - i).forEach((c, k) => { d[i + k] = c; });
    setDigits(d);
    const next = Math.min(5, i + chars.length);
    refs.current[next]?.focus();
    if (d.every(Boolean)) verify(d.join(''));
  };
  return (
    <div className="stack">
      <p className="muted small" style={{ margin: 0 }}>{t('otp.sentTo', { phone: sent.phone })}</p>
      <div className="otp" dir="ltr">
        {digits.map((v, i) => (
          <input key={i} ref={(el) => { refs.current[i] = el; }} value={v} inputMode="numeric" maxLength={i === 0 ? 6 : 1} autoComplete={i === 0 ? 'one-time-code' : 'off'} aria-label={t('otp.digit', { n: i + 1 })}
            onChange={(e) => put(i, e.target.value)} onKeyDown={(e) => { if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus(); }} />
        ))}
      </div>
      {sent.devCode && <div className="banner small">🧪 {t('otp.devCode')} <b className="num" dir="ltr">{sent.devCode}</b> <button type="button" className="btn sm secondary" onClick={() => put(0, sent.devCode!)}>{t('otp.fill')}</button></div>}
      {err && <div className="error" role="alert">{err}</div>}
      <div className="row between small">
        <button type="button" className="linklike" onClick={onBack}>{t('otp.change')}</button>
        {wait > 0 ? <span className="muted">{t('otp.resendIn', { n: wait })}</span> : <button type="button" className="linklike" onClick={onResend}>{t('otp.resend')}</button>}
      </div>
    </div>
  );
}

export function Register() {
  const { t, locale } = useI18n();
  const { register, loginOtp } = useAuth();
  const nav = useNavigate();
  const errText = useErr();
  const [f, setF] = useState({ name: '', nationalId: '', phone: '', email: '' });
  const [sent, setSent] = useState<OtpSent | null>(null);
  const [err, setErr] = useState('');
  const set = (k: keyof typeof f) => (e: any) => setF({ ...f, [k]: k === 'nationalId' ? e.target.value.replace(/\D/g, '') : e.target.value });
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr('');
    try { setSent(await register({ ...f, locale })); } catch (x) { setErr(errText(x)); }
  };
  const { requestCode } = useAuth();
  return (
    <div className="login-wrap container">
      <div className="card stack login-card">
        <span className="portal-tag">💼 {t('portal.parent')}</span>
        <h2 style={{ margin: 0 }}>{t('auth.registerTitle')}</h2>
        {!sent ? (
          <form className="stack" onSubmit={submit}>
            <label className="field"><span>{t('auth.name')}</span><input value={f.name} onChange={set('name')} required autoComplete="name" /></label>
            <label className="field"><span>{t('otp.id')}</span><input inputMode="numeric" dir="ltr" maxLength={9} value={f.nationalId} onChange={set('nationalId')} required /></label>
            <label className="field"><span>{t('otp.phone')}</span><input type="tel" dir="ltr" value={f.phone} onChange={set('phone')} required autoComplete="tel" placeholder="050-0000000" /></label>
            <label className="field"><span>{t('auth.email')}</span><input type="email" dir="ltr" value={f.email} onChange={set('email')} required autoComplete="email" /><small className="muted">{t('otp.emailWhy')}</small></label>
            {err && <div className="error" role="alert">{err}</div>}
            <button className="btn block">{t('otp.registerSend')}</button>
          </form>
        ) : (
          <CodeStep sent={sent} onResend={async () => setSent(await requestCode(f.nationalId, f.phone))} onBack={() => setSent(null)} onVerify={async (code) => { await loginOtp(f.nationalId, f.phone, code); nav('/parent/new'); }} />
        )}
        <div className="small muted center">{t('auth.haveAccount')} <Link to="/login/parent">{t('nav.login')}</Link></div>
      </div>
    </div>
  );
}

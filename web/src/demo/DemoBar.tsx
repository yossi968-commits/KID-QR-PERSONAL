import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useI18n } from '../i18n';

/** Shortcut bar shown only in the in-browser demo build. */
export default function DemoBar() {
  const { login, logout } = useAuth();
  const { locale } = useI18n();
  const nav = useNavigate();
  const he = locale === 'he';
  const as = async (email: string, pw: string, to: string) => { logout(); await login(email, pw); nav(to); };
  return (
    <div className="demo-bar">
      <div className="container row" style={{ gap: 8 }}>
        <strong>🧪 {he ? 'גרסת הדגמה' : 'Demo'}</strong>
        <span className="small hide-sm">{he ? 'הכול רץ בדפדפן, בלי כסף אמיתי. רענון מאפס את הנתונים.' : 'Runs in your browser, no real money. Reload resets the data.'}</span>
        <span className="spacer" />
        <button className="btn sm" onClick={() => as('demo@kfq.app', 'demo1234', '/app')}>{he ? 'כניסה כהורה' : 'Parent'}</button>
        <button className="btn sm secondary" onClick={() => { logout(); nav('/g/itay2013demo'); }}>{he ? 'דף מתנה' : 'Gift page'}</button>
        <button className="btn sm secondary" onClick={() => as('admin@kfq.app', 'admin1234', '/admin')}>{he ? 'מנהל' : 'Admin'}</button>
      </div>
    </div>
  );
}

import { useState, type ReactNode } from 'react';

/**
 * Shared-preview lock for the published Pages build: the app opens only after the access code
 * is typed once on this device. Only a SHA-256 of the code is in the bundle (VITE_ACCESS_HASH).
 * It keeps a forwarded link from opening by itself; it is not real security.
 */
const HASH = import.meta.env.VITE_ACCESS_HASH as string | undefined;
const KEY = 'qr-access';

async function sha256(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s.trim()));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
const saved = () => { try { return localStorage.getItem(KEY); } catch { return null; } };

export default function AccessGate({ children }: { children: ReactNode }) {
  const [ok, setOk] = useState(() => !HASH || saved() === HASH);
  const [code, setCode] = useState('');
  const [bad, setBad] = useState(false);
  if (ok) return <>{children}</>;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((await sha256(code)) === HASH) { try { localStorage.setItem(KEY, HASH!); } catch {} setOk(true); }
    else setBad(true);
  };
  return (
    <div className="gate" dir="rtl">
      <form className="card stack gate-card" onSubmit={submit}>
        <h2 style={{ margin: 0 }}>🔒 QR Li&amp;VeLa</h2>
        <p className="muted" style={{ margin: 0 }}>תצוגה פרטית. הקלידו את קוד הגישה שקיבלתם.<br /><span dir="ltr">Private preview. Enter your access code.</span></p>
        <input inputMode="numeric" autoFocus dir="ltr" value={code} onChange={(e) => { setCode(e.target.value); setBad(false); }} aria-label="קוד גישה" placeholder="••••••" />
        {bad && <p style={{ margin: 0, color: 'var(--danger, #d33)' }}>קוד שגוי · Wrong code</p>}
        <button className="btn" type="submit">כניסה · Enter</button>
      </form>
    </div>
  );
}

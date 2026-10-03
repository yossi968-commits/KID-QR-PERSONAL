import { useState } from 'react';
import { useI18n } from '../../i18n';
import type { Child } from '../../lib/api';
import { QrCanvas, giftUrl, cardPng } from '../../components/Qr';

export default function QrTab({ child }: { child: Child }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const url = giftUrl(child.giftCode);
  const share = `${t('qr.shareText', { name: child.firstName })} ${url}`;
  const download = async () => {
    const png = await cardPng({ code: child.giftCode, name: child.firstName, avatar: child.avatar, line: t('qr.cardLine') });
    const a = document.createElement('a');
    a.href = png; a.download = `qr-${child.firstName}.png`; a.click();
  };
  return (
    <div className="grid grid-2" style={{ alignItems: 'start' }}>
      <div className="qr-card print-area">
        <div style={{ fontSize: 48 }}>{child.avatar}</div>
        <h2 style={{ color: '#fff', margin: '4px 0 0' }}>{child.firstName}</h2>
        <div className="qr-box"><QrCanvas value={url} /></div>
        <div style={{ color: 'var(--gold)', fontWeight: 600 }}>{t('qr.cardLine')}</div>
        <div className="small num" style={{ opacity: 0.75, marginTop: 6 }}>{url.replace(/^https?:\/\//, '')}</div>
      </div>
      <div className="stack">
        <h2>{t('qr.title', { name: child.firstName })}</h2>
        <p className="muted">{t('qr.desc', { name: child.firstName })}</p>
        <div className="row">
          <input readOnly value={url} dir="ltr" onFocus={(e) => e.target.select()} style={{ flex: 1, minWidth: 200 }} />
          <button className="btn secondary" onClick={() => { navigator.clipboard?.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? t('qr.copied') : t('qr.copy')}</button>
        </div>
        <div className="row">
          <a className="btn" style={{ background: '#25d366', color: '#073b1c' }} href={`https://wa.me/?text=${encodeURIComponent(share)}`} target="_blank" rel="noreferrer">💬 {t('qr.whatsapp')}</a>
          <button className="btn secondary" onClick={download}>⬇️ {t('qr.download')}</button>
          <button className="btn secondary" onClick={() => window.print()}>🖨️ {t('qr.print')}</button>
          <a className="btn ghost" href={`/g/${child.giftCode}`} target="_blank" rel="noreferrer">{t('qr.open')} ↗</a>
        </div>
      </div>
    </div>
  );
}

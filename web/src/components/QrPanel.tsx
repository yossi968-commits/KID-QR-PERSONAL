import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import { DEMO } from '../lib/api';
import { QrCanvas, giftUrl, cardPng } from './Qr';
import { QrScanner } from './QrScanner';

/** The child's lifelong QR with share actions. `mode` picks the wording: gifts or work payments. */
export default function QrPanel({ child, mode = 'gift' }: { child: { firstName: string; avatar: string; giftCode: string }; mode?: 'gift' | 'work' }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const [scanning, setScanning] = useState(false);
  const nav = useNavigate();
  const url = giftUrl(child.giftCode);
  const share = `${t(mode === 'work' ? 'qr.shareWork' : 'qr.shareText', { name: child.firstName })} ${url}`;
  const download = async () => {
    const png = await cardPng({ code: child.giftCode, name: child.firstName, avatar: child.avatar, line: t('qr.cardLine') });
    const a = document.createElement('a');
    a.href = png; a.download = `qr-${child.firstName}.png`; a.click();
  };
  return (
    <div className="grid grid-2" style={{ alignItems: 'start' }}>
      <div className="qr-card print-area">
        <div style={{ fontSize: 44 }}>{child.avatar}</div>
        <h2 style={{ color: '#fff', margin: '4px 0 0' }}>{child.firstName}</h2>
        <div className="qr-box"><QrCanvas value={url} /></div>
        <div style={{ color: '#d9b77a', fontWeight: 600 }}>{t(mode === 'work' ? 'qr.cardLineWork' : 'qr.cardLine')}</div>
        <div className="small num" style={{ opacity: 0.75, marginTop: 6 }}>{url.replace(/^https?:\/\//, '')}</div>
      </div>
      <div className="stack">
        <h2>{t(mode === 'work' ? 'qr.workTitle' : 'qr.title', { name: child.firstName })}</h2>
        <p className="muted">{t(mode === 'work' ? 'qr.workDesc' : 'qr.desc', { name: child.firstName })}</p>
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <input readOnly value={url} dir="ltr" onFocus={(e) => e.target.select()} aria-label="link" />
          <button className="btn secondary" onClick={() => { navigator.clipboard?.writeText(url).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? t('qr.copied') : t('qr.copy')}</button>
        </div>
        <div className="row">
          <a className="btn" style={{ background: '#1f8f4e', color: '#fff' }} href={`https://wa.me/?text=${encodeURIComponent(share)}`} target="_blank" rel="noreferrer">💬 {t('qr.whatsapp')}</a>
          {!DEMO && <button className="btn secondary" onClick={download}>⬇️ {t('qr.download')}</button>}
          {!DEMO && <button className="btn secondary" onClick={() => window.print()}>🖨️ {t('qr.print')}</button>}
          <Link className="btn ghost" to={`/g/${child.giftCode}`}>{t('qr.open')}</Link>
        </div>
        {/* A QR on your own screen can't be pointed at, so scan one from another phone, a print or a photo. */}
        <button type="button" className="btn gold block" onClick={() => setScanning(true)}>📷 {t('scan.button')}</button>
        {scanning && <QrScanner onClose={() => setScanning(false)} onCode={(c) => { setScanning(false); nav('/g/' + c); }} />}
      </div>
    </div>
  );
}

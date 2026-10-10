import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import Modal from './Modal';
import { useI18n } from '../i18n';

/** The gift code inside a scanned QR: our gift links end in /g/<code>; a bare code is accepted too. */
export function codeFromQr(text: string): string | null {
  const s = text.trim();
  const m = s.match(/\/g\/([a-z0-9_-]+)/i);
  if (m) return m[1].toLowerCase();
  return /^[a-z0-9_-]{4,40}$/i.test(s) ? s.toLowerCase() : null;
}

function decode(source: CanvasImageSource, w: number, h: number, canvas: HTMLCanvasElement) {
  const scale = Math.min(1, 1024 / Math.max(w, h));
  canvas.width = Math.round(w * scale); canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' })?.data ?? null;
}

/** Camera scanner with a photo fallback (for browsers or frames where the camera is blocked). */
export function QrScanner({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
  const { t } = useI18n();
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(document.createElement('canvas'));
  const [state, setState] = useState<'starting' | 'live' | 'nocam'>('starting');
  const [err, setErr] = useState('');

  const found = (text: string | null) => {
    const code = text && codeFromQr(text);
    if (code) { onCode(code); return true; }
    if (text) setErr(t('scan.notOurs'));
    return false;
  };

  useEffect(() => {
    let stream: MediaStream | null = null, raf = 0, stopped = false;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('no camera');
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (stopped) return;
        const v = video.current!;
        v.srcObject = stream; await v.play(); setState('live');
        let last = 0;
        const tick = (now: number) => {
          if (stopped) return;
          if (now - last > 200 && v.videoWidth) { last = now; if (found(decode(v, v.videoWidth, v.videoHeight, canvas.current))) return; }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch { if (!stopped) setState('nocam'); }
    })();
    return () => { stopped = true; cancelAnimationFrame(raf); stream?.getTracks().forEach((tr) => tr.stop()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fromPhoto = async (file?: File) => {
    if (!file) return;
    setErr('');
    try {
      const bmp = await createImageBitmap(file);
      if (!found(decode(bmp, bmp.width, bmp.height, canvas.current))) setErr((e) => e || t('scan.noneInPhoto'));
    } catch { setErr(t('scan.noneInPhoto')); }
  };

  return (
    <Modal onClose={onClose}>
      <div className="card-head"><h3 style={{ margin: 0 }}>📷 {t('scan.title')}</h3><button className="link" onClick={onClose} aria-label={t('scan.close')}>✕</button></div>
      <div className="scan-view">
        <video ref={video} playsInline muted style={{ display: state === 'live' ? 'block' : 'none' }} />
        {state === 'live' && <div className="scan-frame" aria-hidden />}
        {state === 'starting' && <p className="muted center">{t('scan.starting')}</p>}
        {state === 'nocam' && <p className="muted center">{t('scan.noCamera')}</p>}
      </div>
      <p className="small muted center" style={{ margin: '10px 0' }}>{t('scan.hint')}</p>
      {err && <div className="error" role="alert">{err}</div>}
      <label className="btn secondary block" style={{ marginTop: 8 }}>
        🖼️ {t('scan.photo')}
        <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => fromPhoto(e.target.files?.[0])} />
      </label>
    </Modal>
  );
}

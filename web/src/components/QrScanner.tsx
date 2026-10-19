import { useEffect, useRef, useState } from 'react';
import { DEMO } from '../lib/api';
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

function decode(source: CanvasImageSource, w: number, h: number, canvas: HTMLCanvasElement, max = 1024) {
  const scale = Math.min(1, max / Math.max(w, h));
  canvas.width = Math.round(w * scale); canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' })?.data ?? null;
}

/** The public demo; the single-file demo runs inside a frame that may block the camera and the file picker. */
const PAGES_URL = 'https://yossi968-commits.github.io/KID-QR-PERSONAL/';
const framed = (() => { try { return window.top !== window.self; } catch { return true; } })();

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
        // Some in-app browsers never answer the camera request, so give up after a few seconds.
        stream = await Promise.race([
          navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }),
          new Promise<never>((_, bad) => setTimeout(() => bad(new Error('camera timeout')), 8000)),
        ]);
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

  /** Phone photos are large and QR codes small in them, so try a few sizes; older iOS lacks createImageBitmap for some files. */
  const fromPhoto = async (file?: File) => {
    if (!file) return;
    setErr('');
    try {
      let img: ImageBitmap | HTMLImageElement;
      try { img = await createImageBitmap(file); }
      catch {
        img = await new Promise<HTMLImageElement>((ok, bad) => {
          const url = URL.createObjectURL(file), el = new Image();
          el.onload = () => { URL.revokeObjectURL(url); ok(el); }; el.onerror = bad; el.src = url;
        });
      }
      const w = (img as HTMLImageElement).naturalWidth || img.width, h = (img as HTMLImageElement).naturalHeight || img.height;
      let text: string | null = null;
      for (const max of [1024, 800, 1400, 600]) { text = decode(img, w, h, canvas.current, max); if (text && codeFromQr(text)) break; }
      if (!found(text)) setErr((e) => e || t('scan.noneInPhoto'));
    } catch { setErr(t('scan.noneInPhoto')); }
  };
  // iOS ignores clicks on display:none inputs, so the file inputs stay in the layout, just invisible,
  // and real buttons open them (a label around the input does not open the picker in some in-app browsers).
  const camInput = useRef<HTMLInputElement>(null), galInput = useRef<HTMLInputElement>(null);
  const pick = (capture: boolean) => (
    <input ref={capture ? camInput : galInput} type="file" accept="image/*" {...(capture ? { capture: 'environment' as const } : {})}
      tabIndex={-1} aria-hidden style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
      onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; fromPhoto(f); }} />
  );

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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
        <button type="button" className="btn secondary" onClick={() => camInput.current?.click()}>📷 {t('scan.photo')}</button>
        <button type="button" className="btn secondary" onClick={() => galInput.current?.click()}>🖼️ {t('scan.gallery')}</button>
      </div>
      <div style={{ position: 'relative', height: 0, overflow: 'hidden' }}>{pick(true)}{pick(false)}</div>
      {DEMO && framed && state === 'nocam' && (
        <p className="small muted center" style={{ marginTop: 12 }}>
          {t('scan.framed')} <a href={PAGES_URL} target="_blank" rel="noopener">{t('scan.openBrowser')}</a>
        </p>
      )}
    </Modal>
  );
}

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

/** Draws `source` (or its crop sx,sy,sw,sh) scaled so the long side is at most `max`, then looks for a QR. */
function decode(source: CanvasImageSource, w: number, h: number, canvas: HTMLCanvasElement, max = 1024, crop?: [number, number, number, number]) {
  const [sx, sy, sw, sh] = crop ?? [0, 0, w, h];
  const scale = Math.min(1, max / Math.max(sw, sh));
  canvas.width = Math.round(sw * scale); canvas.height = Math.round(sh * scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' })?.data ?? null;
}

type Detector = { detect: (s: CanvasImageSource) => Promise<{ rawValue: string }[]> };
/** The browser's own QR reader where there is one (Android Chrome, newer Safari); it copes with photos better than jsQR. */
const nativeDetector = (): Detector | null => {
  const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
  try { return BD ? new BD({ formats: ['qr_code'] }) : null; } catch { return null; }
};

/** Loads a picked photo. An <img> first: it follows the photo's rotation and reads HEIC on iPhone. */
function loadPhoto(file: File): Promise<HTMLImageElement | ImageBitmap> {
  return new Promise<HTMLImageElement>((ok, bad) => {
    const url = URL.createObjectURL(file), el = new Image();
    el.onload = () => { ok(el); setTimeout(() => URL.revokeObjectURL(url), 1000); };
    el.onerror = () => { URL.revokeObjectURL(url); bad(new Error('img')); };
    el.src = url;
  }).catch(() => createImageBitmap(file));
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

  /** Phone photos are large and QR codes small in them, so try the native reader, a few sizes, then crops of the middle. */
  const [reading, setReading] = useState(false);
  const fromPhoto = async (file?: File) => {
    if (!file) return;
    setErr(''); setReading(true);
    try {
      const img = await loadPhoto(file);
      const w = (img as HTMLImageElement).naturalWidth || img.width, h = (img as HTMLImageElement).naturalHeight || img.height;
      let text: string | null = null;
      const nd = nativeDetector();
      if (nd) { try { text = (await nd.detect(img)).map((r) => r.rawValue).find((v) => codeFromQr(v)) ?? null; } catch { /* fall back to jsQR */ } }
      const tries: [number, [number, number, number, number]?][] = [[1024], [800], [1400], [600], [2000]];
      for (const f of [0.7, 0.5]) tries.push([1024, [w * (1 - f) / 2, h * (1 - f) / 2, w * f, h * f]]);
      for (const [max, crop] of tries) {
        if (text && codeFromQr(text)) break;
        const r = decode(img, w, h, canvas.current, max, crop); if (r) text = r;
        await new Promise((r) => setTimeout(r, 0));
      }
      if (!found(text)) setErr((e) => e || t('scan.noneInPhoto'));
    } catch { setErr(t('scan.noneInPhoto')); }
    finally { setReading(false); }
  };
  // The invisible input covers its button, so the tap lands on the input itself: no label or scripted click,
  // which some phone browsers ignore (iOS also ignores display:none inputs).
  const pick = (capture: boolean) => (
    <input type="file" accept="image/*" {...(capture ? { capture: 'environment' as const } : {})} aria-label={t(capture ? 'scan.photo' : 'scan.gallery')}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', fontSize: 100 }}
      onChange={(e) => { const f = e.target.files?.[0]; fromPhoto(f); e.target.value = ''; }} />
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
        <div className="btn secondary" style={{ position: 'relative', overflow: 'hidden' }} aria-hidden>📷 {t('scan.photo')}{pick(true)}</div>
        <div className="btn secondary" style={{ position: 'relative', overflow: 'hidden' }} aria-hidden>🖼️ {t('scan.gallery')}{pick(false)}</div>
      </div>
      {reading && <p className="small muted center" style={{ marginTop: 8 }}>{t('scan.reading')}</p>}
      {DEMO && framed && state === 'nocam' && (
        <p className="small muted center" style={{ marginTop: 12 }}>
          {t('scan.framed')} <a href={PAGES_URL} target="_blank" rel="noopener">{t('scan.openBrowser')}</a>
        </p>
      )}
    </Modal>
  );
}

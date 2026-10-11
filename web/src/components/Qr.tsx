import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { publicOrigin } from '../lib/api';

export const giftUrl = (code: string) => `${publicOrigin()}/g/${code}`;

export function QrCanvas({ value, size = 220 }: { value: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) QRCode.toCanvas(ref.current, value, { width: size, margin: 1, errorCorrectionLevel: 'H', color: { dark: '#102A43', light: '#ffffff' } });
  }, [value, size]);
  return <canvas ref={ref} width={size} height={size} aria-label={value} />;
}

/** Render the full printable card to a PNG for download. */
export async function cardPng({ code, name, avatar, line }: { code: string; name: string; avatar: string; line: string }) {
  const W = 720, H = 1000;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#243B53'); grad.addColorStop(1, '#102A43');
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.direction = 'rtl';
  g.font = '96px sans-serif'; g.fillText(avatar, W / 2, 150);
  g.font = 'bold 64px Heebo, sans-serif'; g.fillText(name, W / 2, 250);
  g.fillStyle = '#fff';
  g.beginPath(); g.roundRect(W / 2 - 230, 300, 460, 460, 32); g.fill();
  const qr = document.createElement('canvas');
  await QRCode.toCanvas(qr, giftUrl(code), { width: 420, margin: 1, errorCorrectionLevel: 'H', color: { dark: '#102A43', light: '#ffffff' } });
  g.drawImage(qr, W / 2 - 210, 320);
  g.fillStyle = '#d9b77a'; g.font = '600 36px Heebo, sans-serif'; g.fillText(line, W / 2, 840);
  g.fillStyle = 'rgba(255,255,255,.75)'; g.font = '28px sans-serif'; g.direction = 'ltr'; g.fillText(giftUrl(code).replace(/^https?:\/\//, ''), W / 2, 900);
  return c.toDataURL('image/png');
}

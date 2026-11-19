import { useEffect, useMemo, useRef, useState } from 'react';
import simHtml from '../sim/wallet-sim.html?raw';
import { useAuth } from '../lib/auth';
import { useI18n } from '../i18n';
import type { Child } from '../lib/api';

/**
 * Birthday group gifts through a wallet (PayBox or bit), as a self-contained simulator.
 * Neither wallet publishes a developer API, so the simulator runs on clearly labelled
 * assumed endpoints. It renders in a sandboxed iframe and reports its height back.
 */
export default function WalletSim({ child }: { child: Child }) {
  const { user } = useAuth();
  const { t, fmtDate } = useI18n();
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(1500);

  const srcDoc = useMemo(() => {
    const cfg = {
      provider: 'paybox',
      child: child.firstName,
      age: child.age + 1,
      date: fmtDate(child.nextBirthday),
      parent: (user?.name || '').split(' ')[0] || 'ההורה',
      embedded: true,
    };
    // JSON is safe inside a script tag once "<" is escaped.
    const boot = `<script>window.QRUV_SIM=${JSON.stringify(cfg).replace(/</g, '\\u003c')}</script>`;
    return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${boot}</head><body>${simHtml}</body></html>`;
  }, [child.firstName, child.age, child.nextBirthday, user?.name, fmtDate]);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.source !== ref.current?.contentWindow) return;
      const h = Number(e.data?.qruvSimHeight);
      if (h > 200 && h < 20000) setHeight(Math.ceil(h) + 4);
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  return (
    <div>
      <div className="banner" style={{ marginBottom: 12 }}>{t('wsim.intro' as any, { name: child.firstName })}</div>
      <iframe
        ref={ref}
        title={t('ctab.wallet' as any)}
        srcDoc={srcDoc}
        sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
        style={{ width: '100%', height, border: 0, borderRadius: 16, display: 'block' }}
      />
    </div>
  );
}

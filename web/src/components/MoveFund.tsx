import { useEffect, useState } from 'react';
import { ProviderMark, ProviderName } from './ProviderMark';
import { useI18n } from '../i18n';
import { api, type Child, type Provider } from '../lib/api';
import { useErr } from '../pages/Auth';

/**
 * Move the fund to another investment house (ניוד): same track, the money moves as it
 * is, no tax and no withdrawal. Until 18 the second parent co-signs.
 */
export function MoveFund({ child, url, coSign, onDone }: { child: Child; url: string; coSign: boolean; onDone: () => void }) {
  const { t, fmtDate, name: nm } = useI18n();
  const errText = useErr();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState('');
  const [co, setCo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState('');
  useEffect(() => { api<{ providers: Provider[] }>('/providers').then((r) => setProviders(r.providers)).catch(() => {}); }, []);
  const active = child.accountStatus === 'active';
  const name = (p: Provider) => nm(p);
  const submit = async () => {
    setErr(''); setBusy(true);
    try {
      const r = await api<{ providerName: string; accountId: string }>(url, { body: { provider: to, coSigned: co } });
      setDone(active ? t('move.doneActive', { house: r.providerName, account: r.accountId }) : t('move.donePending', { house: r.providerName }));
      setOpen(false); setTo(''); setCo(false); onDone();
    } catch (x) { setErr(errText(x)); } finally { setBusy(false); }
  };
  return (
    <div className="card stack" id="move-fund">
      <div className="card-head"><h3 style={{ margin: 0 }}>🏦 {t('move.title')}</h3><ProviderName id={child.provider} name={t(`provider.${child.provider}` as any)} /></div>
      {child.prevProviderName && child.providerChangedAt && <p className="small muted" style={{ margin: 0 }}>{t('move.history', { house: child.prevProviderName, date: fmtDate(child.providerChangedAt) })}</p>}
      {done && <div className="banner small" role="status">✓ {done}</div>}
      {!open ? (
        <button className="btn secondary" onClick={() => { setOpen(true); setDone(''); }}>{t('move.button')}</button>
      ) : (
        <div className="banner stack" style={{ alignItems: 'stretch' }}>
          <div role="radiogroup" aria-label={t('move.to')}>
            <span className="field-label">{t('move.to')}</span>
            <div className="house-pick">
              {providers.filter((p) => p.id !== child.provider).map((p) => <button type="button" role="radio" aria-checked={to === p.id} key={p.id} className={to === p.id ? 'on' : ''} onClick={() => setTo(p.id)}><ProviderMark id={p.id} size={28} />{name(p)}</button>)}
            </div>
          </div>
          <ul className="small" style={{ margin: 0, paddingInlineStart: 18 }}>
            {(active ? ['move.p1', 'move.p2', 'move.p3'] : ['move.pending']).map((k) => <li key={k}>{t(k as any)}</li>)}
          </ul>
          {active && coSign && <label className="check"><input type="checkbox" checked={co} onChange={(e) => setCo(e.target.checked)} />{t('plan.coSign')}</label>}
          {err && <div className="error" role="alert">{err}</div>}
          <div className="row">
            <button className="btn sm" disabled={!to || busy || (active && coSign && !co)} onClick={submit}>{t('move.confirm')}</button>
            <button className="btn ghost sm" onClick={() => setOpen(false)}>{t('common.cancel')}</button>
          </div>
        </div>
      )}
    </div>
  );
}

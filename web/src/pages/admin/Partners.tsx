import { useEffect, useState, type FormEvent } from 'react';
import { useI18n } from '../../i18n';
import { api, type PartnerStats } from '../../lib/api';
import { useErr } from '../Auth';

/** First-gift partners: health funds and brands, their gift amount, on/off, and what each brought in. */
export function AdminPartners() {
  const { t, fmtMoney, name } = useI18n();
  const errText = useErr();
  const [rows, setRows] = useState<PartnerStats[] | null>(null);
  const [edit, setEdit] = useState<Record<number, string>>({});
  const [add, setAdd] = useState({ name: '', kind: 'health_fund', amount: '50' });
  const [err, setErr] = useState('');
  useEffect(() => { api<{ partners: PartnerStats[] }>('/admin/partners').then((r) => setRows(r.partners)); }, []);
  const run = async (fn: () => Promise<{ partners: PartnerStats[] }>) => { setErr(''); try { setRows((await fn()).partners); } catch (x) { setErr(errText(x)); } };
  const save = (p: PartnerStats, patch: { amount?: number; active?: boolean }) =>
    run(() => api(`/admin/partners/${p.id}`, { method: 'PATCH', body: { amount: p.amount / 100, active: p.active, ...patch } })).then(() => setEdit((e) => { const n = { ...e }; delete n[p.id]; return n; }));
  const submit = (e: FormEvent) => { e.preventDefault(); run(() => api('/admin/partners', { body: { ...add, amount: Number(add.amount) } })).then(() => setAdd({ ...add, name: '' })); };
  if (!rows) return null;
  return (
    <>
      <div className="admin-top"><h1>{t('partners.title')}</h1></div>
      <div className="admin-body">
        <p className="muted" style={{ margin: 0 }}>{t('partners.desc')}</p>
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table className="table">
              <thead><tr>
                <th>{t('partners.col.partner')}</th><th>{t('partners.col.kind')}</th><th className="num">{t('partners.col.amount')}</th>
                <th className="num">{t('partners.col.gifts')}</th><th className="num">{t('partners.col.total')}</th>
                <th className="num">{t('partners.col.referrals')}</th><th className="num">{t('partners.col.converted')}</th><th>{t('partners.col.active')}</th>
              </tr></thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td><span aria-hidden>{p.logo}</span> <b>{name(p)}</b>{p.kind === 'health_fund' && <div className="small muted" dir="ltr" style={{ textAlign: 'start' }}>{t('partners.link')}: /expecting?p={p.slug}</div>}</td>
                    <td className="small">{t(`partners.kind.${p.kind}` as const)}</td>
                    <td className="num">
                      {edit[p.id] != null ? (
                        <span className="row" style={{ gap: 4, justifyContent: 'flex-end' }}>
                          <input type="number" min={0} dir="ltr" value={edit[p.id]} onChange={(e) => setEdit({ ...edit, [p.id]: e.target.value })} style={{ width: 80, minHeight: 32, padding: '4px 8px' }} aria-label={t('partners.col.amount')} />
                          <button className="btn sm" onClick={() => save(p, { amount: Number(edit[p.id]) })}>{t('partners.save')}</button>
                        </span>
                      ) : <button className="link" onClick={() => setEdit({ ...edit, [p.id]: String(p.amount / 100) })}>{fmtMoney(p.amount)} ✎</button>}
                    </td>
                    <td className="num">{p.gifts}</td>
                    <td className="num">{fmtMoney(p.total)}</td>
                    <td className="num">{p.kind === 'health_fund' ? p.referrals : '—'}</td>
                    <td className="num">{p.kind === 'health_fund' ? p.converted : '—'}</td>
                    <td><label className="check" style={{ margin: 0 }}><input type="checkbox" checked={p.active} onChange={(e) => save(p, { active: e.target.checked })} aria-label={t('partners.col.active')} /></label></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <form className="card row" onSubmit={submit} style={{ alignItems: 'flex-end' }}>
          <label className="field" style={{ flex: 2, minWidth: 160 }}><span>{t('partners.name')}</span><input value={add.name} onChange={(e) => setAdd({ ...add, name: e.target.value })} required /></label>
          <label className="field" style={{ flex: 1, minWidth: 140 }}><span>{t('partners.col.kind')}</span>
            <select value={add.kind} onChange={(e) => setAdd({ ...add, kind: e.target.value })}>{(['health_fund', 'formula', 'other'] as const).map((k) => <option key={k} value={k}>{t(`partners.kind.${k}`)}</option>)}</select>
          </label>
          <label className="field" style={{ flex: 1, minWidth: 100 }}><span>{t('partners.col.amount')} (₪)</span><input type="number" min={0} dir="ltr" value={add.amount} onChange={(e) => setAdd({ ...add, amount: e.target.value })} /></label>
          <button className="btn">{t('partners.add')}</button>
        </form>
        {err && <div className="error" role="alert">{err}</div>}
        <div className="banner small">{t('partners.legal')}</div>
      </div>
    </>
  );
}

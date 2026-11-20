import { useEffect, useState, type FormEvent } from 'react';
import { Link, NavLink, Navigate, Outlet, useNavigate, useParams } from 'react-router-dom';
import { useI18n } from '../../i18n';
import { useAuth } from '../../lib/auth';
import { api, publicOrigin, OCCASIONS, type BirthReport, type Employer } from '../../lib/api';
import { Kpis } from '../../components/ui';
import { BackButton, LangButton, Logo } from '../../components/Shells';
import { useErr } from '../Auth';

/** Employers and workers' committees: formal B2B console. */
export function EmployerShell() {
  const { t } = useI18n();
  const { employer, loading, logout } = useAuth();
  const nav = useNavigate();
  if (loading) return null;
  if (!employer) return <Navigate to="/login/employer" replace />;
  return (
    <div className="shell theme-employer">
      <header className="topbar">
        <div className="container">
          <BackButton home="/employer" />
          <Logo sub={t('employer.area')} to="/employer" />
          <span className="spacer" />
          <nav className="nav">
            <NavLink to="/employer" end>{t('employer.nav.reports')}</NavLink>
            <NavLink to="/employer/settings">{t('employer.nav.settings')}</NavLink>
            <span className="hide-sm" style={{ color: 'var(--header-muted)', fontSize: '0.85rem', paddingInline: 8 }}>{employer.logo} {employer.name}</span>
            <button className="link" onClick={() => { logout(); nav('/'); }}>{t('nav.logout')}</button>
            <LangButton />
          </nav>
        </div>
      </header>
      <main><Outlet /></main>
      <footer className="site"><div className="container">{t('employer.footer')}</div></footer>
    </div>
  );
}

type Stats = { reports: number; gifted: number; awaiting: number; noQr: number; total: number };

export function EmployerHome() {
  const { t, fmtMoney, fmtDate } = useI18n();
  const errText = useErr();
  const [me, setMe] = useState<{ employer: Employer; stats: Stats } | null>(null);
  const [rows, setRows] = useState<BirthReport[]>([]);
  const [sel, setSel] = useState<number[]>([]);
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const [adding, setAdding] = useState(false);
  const load = () => { api('/employer/me').then(setMe); api<{ reports: BirthReport[] }>('/employer/reports').then((r) => setRows(r.reports)); };
  useEffect(load, []);
  if (!me) return null;
  const { employer, stats } = me;
  const ready = rows.filter((r) => r.status === 'linked');
  const send = async (ids: number[]) => {
    setErr('');
    try { const r = await api('/employer/gifts', { body: { reportIds: ids } }); setNote(t('employer.sent', { n: r.sent })); setSel([]); load(); } catch (x) { setErr(errText(x)); }
  };
  const invite = async (id: number) => { try { await api(`/employer/reports/${id}/invite`, { body: {} }); setNote(t('employer.invitedNote')); load(); } catch (x) { setErr(errText(x)); } };
  const amountFor = (r: BirthReport) => employer.amounts[r.occasion] || employer.giftAmount;

  return (
    <div className="container page-head stack">
      <div className="row between">
        <div><div className="eyebrow">{employer.logo} {employer.name} · {t(`employer.kind.${employer.kind}` as any)}</div><h1 style={{ margin: '4px 0 0' }}>{t('employer.title')}</h1></div>
        <button className="btn" onClick={() => setAdding(!adding)}>＋ {t('employer.add')}</button>
      </div>
      <p className="muted" style={{ margin: 0, maxWidth: '60em' }}>{t('employer.lead')}</p>
      <Kpis items={[
        { label: t('employer.k.reports'), value: stats.reports },
        { label: t('employer.k.gifted'), value: stats.gifted, sub: fmtMoney(stats.total) },
        { label: t('employer.k.ready'), value: stats.awaiting },
        { label: t('employer.k.noQr'), value: stats.noQr, sub: t('employer.k.noQrSub') },
      ]} />
      {adding && <AddReport onDone={() => { setAdding(false); load(); }} />}
      {note && <div className="banner small" role="status">✓ {note}</div>}
      {err && <div className="error" role="alert">{err}</div>}
      <div className="card" style={{ padding: 0 }}>
        <div className="card-head" style={{ padding: '16px 20px 0' }}>
          <h3>{t('employer.reportsTitle')}</h3>
          <div className="row">
            <button className="btn sm secondary" disabled={!sel.length} onClick={() => send(sel)}>{t('employer.sendSelected', { n: sel.length })}</button>
            <button className="btn sm gold" disabled={!ready.length} onClick={() => send(ready.map((r) => r.id))}>{t('employer.sendAll', { n: ready.length })}</button>
          </div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th /><th>{t('employer.col.employee')}</th><th>{t('employer.col.occasion')}</th><th>{t('employer.col.child')}</th><th>{t('employer.col.date')}</th><th>{t('employer.col.qr')}</th><th className="num">{t('employer.col.gift')}</th><th>{t('dash.col.status')}</th><th /></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.status === 'linked' && <input type="checkbox" checked={sel.includes(r.id)} onChange={(e) => setSel(e.target.checked ? [...sel, r.id] : sel.filter((x) => x !== r.id))} aria-label={r.employeeName} />}</td>
                  <td><b>{r.employeeName}</b><div className="small muted num">{r.employeeNumber ? `#${r.employeeNumber} · ` : ''}{r.employeeEmail}</div></td>
                  <td>{t(`occasion.${r.occasion}` as any)}</td>
                  <td>{r.babyName || '—'}</td>
                  <td>{fmtDate(r.eventDate || r.birthDate)}</td>
                  <td>{r.child ? <span className="pill good">✓ {t('employer.qrLinked')}</span> : <span className="pill gold">{t('employer.qrMissing')}</span>}</td>
                  <td className="num">{r.gift ? <b>{fmtMoney(r.gift.amount)}</b> : <span className="muted">{fmtMoney(amountFor(r))}</span>}</td>
                  <td><span className={'pill' + (r.status === 'gifted' ? ' good' : r.status === 'linked' ? ' brand' : '')}>{t(`report.${r.status}` as any)}</span>{r.gift && r.child && !r.child.fundOpen && <div className="small muted">{t('employer.waitsFund')}</div>}</td>
                  <td>
                    {r.status === 'linked' && <button className="btn sm" onClick={() => send([r.id])}>{t('employer.send')}</button>}
                    {(r.status === 'reported' || r.status === 'invited') && <button className="btn sm ghost" onClick={() => invite(r.id)}>{r.status === 'invited' ? t('employer.reinvite') : t('employer.invite')}</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card">
        <div className="card-head"><h3>{t('employer.linkTitle')}</h3><Link className="btn sm secondary" to={`/work/${employer.slug}`}>{t('employer.openLink')}</Link></div>
        <p className="small muted" style={{ margin: 0 }}>{t('employer.linkDesc')}</p>
        <input readOnly dir="ltr" value={`${publicOrigin()}/work/${employer.slug}`} onFocus={(e) => e.target.select()} style={{ marginTop: 10 }} aria-label="link" />
      </div>
    </div>
  );
}

function ReportFields({ f, setF, withCode }: { f: any; setF: (f: any) => void; withCode?: boolean }) {
  const { t } = useI18n();
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  return (
    <>
      <div className="grid grid-2" style={{ gap: 10 }}>
        <label className="field"><span>{t('employer.f.name')}</span><input value={f.employeeName} onChange={set('employeeName')} required /></label>
        <label className="field"><span>{t('employer.f.number')}</span><input dir="ltr" value={f.employeeNumber} onChange={set('employeeNumber')} /></label>
        <label className="field"><span>{t('employer.f.email')}</span><input type="email" dir="ltr" value={f.employeeEmail} onChange={set('employeeEmail')} required={withCode} /></label>
        <label className="field"><span>{t('employer.f.occasion')}</span><select value={f.occasion} onChange={set('occasion')}>{OCCASIONS.map((o) => <option key={o} value={o}>{t(`occasion.${o}` as any)}</option>)}</select></label>
        <label className="field"><span>{t('employer.f.child')}</span><input value={f.babyName} onChange={set('babyName')} /></label>
        <label className="field"><span>{t('employer.f.birth')}</span><input type="date" value={f.birthDate} onChange={set('birthDate')} required /></label>
        {f.occasion !== 'birth' && <label className="field"><span>{t('employer.f.eventDate')}</span><input type="date" value={f.eventDate} onChange={set('eventDate')} /></label>}
        {withCode && <label className="field"><span>{t('employer.f.code')}</span><input dir="ltr" value={f.giftCode} onChange={set('giftCode')} placeholder={t('employer.f.codePh')} /></label>}
      </div>
    </>
  );
}
const blank = { employeeName: '', employeeNumber: '', employeeEmail: '', babyName: '', birthDate: '', eventDate: '', occasion: 'birth', giftCode: '' };

function AddReport({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const errText = useErr();
  const [f, setF] = useState(blank);
  const [err, setErr] = useState('');
  const submit = async (e: FormEvent) => { e.preventDefault(); setErr(''); try { await api('/employer/reports', { body: f }); onDone(); } catch (x) { setErr(errText(x)); } };
  return (
    <form className="card stack" onSubmit={submit}>
      <h3 style={{ margin: 0 }}>{t('employer.add')}</h3>
      <ReportFields f={f} setF={setF} withCode />
      {err && <div className="error">{err}</div>}
      <div className="row"><button className="btn">{t('employer.save')}</button><button type="button" className="btn ghost" onClick={onDone}>{t('common.cancel')}</button></div>
    </form>
  );
}

export function EmployerSettings() {
  const { t, fmtMoney } = useI18n();
  const errText = useErr();
  const [e, setE] = useState<Employer | null>(null);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [occ, setOcc] = useState<string[]>([]);
  const [msg, setMsg] = useState('');
  const [note, setNote] = useState('');
  useEffect(() => { api('/employer/me').then((r) => { setE(r.employer); setOcc(r.employer.occasions); setMsg(r.employer.giftMessage || ''); setAmounts(Object.fromEntries(Object.entries(r.employer.amounts).map(([k, v]) => [k, String((v as number) / 100)]))); }); }, []);
  if (!e) return null;
  const save = async () => {
    try { const r = await api('/employer/settings', { method: 'PATCH', body: { occasions: occ, giftMessage: msg, amounts: Object.fromEntries(Object.entries(amounts).map(([k, v]) => [k, Number(v)])) } }); setE(r.employer); setNote(t('settings.saved')); } catch (x) { setNote(errText(x)); }
  };
  return (
    <div className="container page-head stack" style={{ maxWidth: 820 }}>
      <h1 style={{ margin: 0 }}>{t('employer.settingsTitle')}</h1>
      <p className="muted" style={{ margin: 0 }}>{t('employer.settingsLead')}</p>
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap"><table className="table">
          <thead><tr><th>{t('employer.col.occasion')}</th><th>{t('employer.swap')}</th><th>{t('employer.amount')}</th><th>{t('employer.active')}</th></tr></thead>
          <tbody>{OCCASIONS.map((o) => (
            <tr key={o}>
              <td><b>{t(`occasion.${o}` as any)}</b></td>
              <td className="small muted" style={{ whiteSpace: 'normal' }}>{t(`employer.swap.${o}` as any)}</td>
              <td><input type="number" dir="ltr" min={18} max={5000} value={amounts[o] || ''} onChange={(ev) => setAmounts({ ...amounts, [o]: ev.target.value })} style={{ width: 110 }} aria-label={t('employer.amount')} /></td>
              <td><input type="checkbox" checked={occ.includes(o)} onChange={(ev) => setOcc(ev.target.checked ? [...occ, o] : occ.filter((x) => x !== o))} aria-label={t(`occasion.${o}` as any)} /></td>
            </tr>
          ))}</tbody>
        </table></div>
      </div>
      <label className="field"><span>{t('employer.message')}</span><textarea value={msg} onChange={(ev) => setMsg(ev.target.value)} maxLength={300} /></label>
      <div className="card gold small">💡 {t('employer.why', { amount: fmtMoney(Number(amounts.birth || 0) * 100 * Math.pow(1.065, 21)) })}</div>
      <div className="row"><button className="btn" onClick={save}>{t('settings.save')}</button>{note && <span className="small" role="status">{note}</span>}</div>
    </div>
  );
}

/** Public page an organization shares with its staff to report a birth or another occasion. */
export function WorkReport() {
  const { slug } = useParams();
  const { t } = useI18n();
  const errText = useErr();
  const [emp, setEmp] = useState<Employer | null>(null);
  const [f, setF] = useState(blank);
  const [done, setDone] = useState<null | { linked: boolean }>(null);
  const [err, setErr] = useState('');
  useEffect(() => { api(`/work/${slug}`).then((r) => setEmp(r.employer)).catch(() => setErr(t('gift.notFound'))); }, [slug]);
  const submit = async (e: FormEvent) => { e.preventDefault(); setErr(''); try { setDone(await api(`/work/${slug}/report`, { body: f })); } catch (x) { setErr(errText(x)); } };
  if (!emp) return <div className="container page-head muted">{err || t('common.loading')}</div>;
  return (
    <div className="container page-head" style={{ maxWidth: 680 }}>
      <div className="card stack">
        <div className="eyebrow">{emp.logo} {emp.name}</div>
        <h1 style={{ margin: 0 }}>{t('work.title')}</h1>
        <p className="muted" style={{ margin: 0 }}>{t('work.lead', { name: emp.name })}</p>
        {done ? (
          <div className="banner">{done.linked ? t('work.doneLinked') : t('work.doneOpen')} {!done.linked && <Link className="btn sm" to="/register">{t('portal.open')}</Link>}</div>
        ) : (
          <form className="stack" onSubmit={submit}>
            <ReportFields f={f} setF={setF} withCode />
            {err && <div className="error">{err}</div>}
            <button className="btn">{t('work.submit')}</button>
            <p className="small muted" style={{ margin: 0 }}>{t('work.privacy')}</p>
          </form>
        )}
      </div>
    </div>
  );
}

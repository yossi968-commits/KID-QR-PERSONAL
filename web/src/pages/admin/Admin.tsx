import { useEffect, useState, type ReactNode } from 'react';
import { useI18n } from '../../i18n';
import { api } from '../../lib/api';
import { Bars } from '../../components/Charts';
import { AccountPill, Kpis, useLabels } from '../../components/ui';

function Page({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <>
      <div className="admin-top"><h1>{title}</h1><span className="spacer" />{actions}</div>
      <div className="admin-body">{children}</div>
    </>
  );
}
const Table = ({ head, children }: { head: ReactNode[]; children: ReactNode }) => (
  <div className="card" style={{ padding: 0 }}><div className="table-wrap"><table className="table"><thead><tr>{head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead><tbody>{children}</tbody></table></div></div>
);

export function AdminOverview() {
  const { t, fmtMoney } = useI18n();
  const L = useLabels();
  const [s, setS] = useState<any>(null);
  useEffect(() => { api('/admin/stats').then(setS); }, []);
  if (!s) return null;
  return (
    <Page title={t('admin.nav.overview')}>
      <Kpis items={[
        { label: t('admin.aum'), value: fmtMoney(s.aum) }, { label: t('admin.volume'), value: fmtMoney(s.giftVolume), sub: `${s.gifts} ${t('admin.gifts')}` },
        { label: t('admin.recurring'), value: fmtMoney(s.monthlyRecurring), sub: `${s.activePledges} ${t('admin.activePledges')}` },
        { label: t('admin.held'), value: fmtMoney(s.heldAmount), sub: `${s.applicationsOpen} ${t('admin.openApps')}` },
        { label: t('admin.withdrawals'), value: fmtMoney(s.withdrawalsPaid), sub: `${s.withdrawalsPending} ${t('admin.awaiting')}` },
        { label: t('admin.users'), value: s.users, sub: `${s.children} ${t('admin.children')}` },
      ]} />
      <div className="card"><div className="card-head"><h3>{t('admin.monthly')}</h3></div><Bars data={s.monthly.map((m: any) => ({ label: m.month.slice(2), value: m.amount }))} /></div>
      <div className="grid grid-3">
        <Table head={[t('admin.bySource'), '#', '₪']}>{s.bySource.map((r: any) => <tr key={r.source}><td>{L.source(r.source)}</td><td className="num">{r.n}</td><td className="num">{fmtMoney(r.amount)}</td></tr>)}</Table>
        <Table head={[t('admin.byMethod'), '#', '₪']}>{s.byMethod.map((r: any) => <tr key={r.method}><td>{L.method(r.method)}</td><td className="num">{r.gifts}</td><td className="num">{fmtMoney(r.amount)}</td></tr>)}</Table>
        <Table head={[t('admin.byProvider'), t('admin.children'), t('admin.open')]}>{s.byProvider.map((r: any) => <tr key={r.provider}><td>{t(`provider.${r.provider}` as any)}</td><td className="num">{r.children}</td><td className="num">{r.open}</td></tr>)}</Table>
      </div>
      <Table head={[t('admin.employers'), t('employer.kind'), t('employer.reports'), t('employer.gifted')]}>
        {s.employers.map((r: any) => <tr key={r.name}><td>{r.name}</td><td>{t(`employer.kind.${r.kind}` as any)}</td><td className="num">{r.reports}</td><td className="num">{r.gifted || 0}</td></tr>)}
      </Table>
    </Page>
  );
}

export function AdminApplications() {
  const { t, fmtMoney, fmtDate } = useI18n();
  const [rows, setRows] = useState<any[]>([]);
  const [note, setNote] = useState('');
  const load = () => api('/admin/applications').then((r) => setRows(r.applications));
  useEffect(() => { load(); }, []);
  const approve = async (id: number) => { const r = await api(`/admin/applications/${id}/approve`, { body: {} }); setNote(t('admin.approved', { acc: r.accountId, n: r.invested })); load(); };
  const remind = async () => { const r = await api('/admin/reminders/run', { body: {} }); setNote(t('admin.reminded', { n: r.reminded })); };
  return (
    <Page title={t('admin.nav.applications')} actions={<button className="btn sm secondary" onClick={remind}>🔔 {t('admin.runReminders')}</button>}>
      {note && <div className="banner small" role="status">{note}</div>}
      <p className="small muted" style={{ margin: 0 }}>{t('admin.appsDesc')}</p>
      <Table head={[t('admin.col.child'), t('admin.col.guardian'), t('open.house'), t('fund.appRef'), t('admin.col.docs'), t('fund.held'), t('dash.col.status'), '']}>
        {rows.map((a) => (
          <tr key={a.childId}>
            <td><b>{a.child}</b><div className="small muted">{fmtDate(a.createdAt)}</div></td>
            <td>{a.guardian}<div className="small muted num">{a.guardianEmail}</div></td>
            <td>{a.providerName}</td>
            <td className="num small">{a.accountId || a.ref || '—'}</td>
            <td className="num">{a.docs.done}/{a.docs.total}</td>
            <td className="num">{a.held ? fmtMoney(a.held) : '—'}</td>
            <td><AccountPill status={a.status} /></td>
            <td>{a.status === 'in_review' && <button className="btn sm" onClick={() => approve(a.childId)}>{t('admin.approve')}</button>}</td>
          </tr>
        ))}
      </Table>
    </Page>
  );
}

export function AdminPayments() {
  const { t, fmtMoney, fmtDate } = useI18n();
  const L = useLabels();
  const [gifts, setGifts] = useState<any[]>([]);
  const [pledges, setPledges] = useState<any[]>([]);
  const [note, setNote] = useState('');
  const load = () => { api('/admin/contributions').then((r) => setGifts(r.contributions)); api('/admin/pledges').then((r) => setPledges(r.pledges)); };
  useEffect(load, []);
  const run = async () => { const r = await api('/admin/pledges/run', { body: {} }); setNote(t('admin.ran', { due: r.due, charged: r.charged })); load(); };
  return (
    <Page title={t('admin.nav.payments')} actions={<button className="btn sm secondary" onClick={run}>▶ {t('admin.runPledges')}</button>}>
      {note && <div className="banner small" role="status">{note}</div>}
      <h3 style={{ margin: 0 }}>{t('admin.pledges')}</h3>
      <Table head={[t('admin.col.child'), t('money.col.from'), t('money.col.type'), t('money.col.method'), '₪', t('admin.col.next'), '#', t('dash.col.status')]}>
        {pledges.map((p) => <tr key={p.id}><td>{p.child}</td><td>{p.giverName}</td><td>{L.source(p.source)}</td><td>{L.method(p.method)}</td><td className="num">{fmtMoney(p.amount)}</td><td>{p.nextDate ? fmtDate(p.nextDate) : '—'}</td><td className="num">{p.charges}</td><td><span className={'pill' + (p.status === 'active' ? ' good' : '')}>{t(`pledge.status.${p.status}` as any)}</span></td></tr>)}
      </Table>
      <h3 style={{ margin: 0 }}>{t('admin.recent')}</h3>
      <Table head={['#', t('admin.col.child'), t('money.col.from'), t('money.col.type'), t('money.col.method'), '₪', t('admin.col.ref'), t('dash.col.status')]}>
        {gifts.slice(0, 60).map((g) => <tr key={g.id}><td className="num small">{g.id}</td><td>{g.child}</td><td>{g.giver_name}</td><td className="small">{L.source(g.source)}</td><td className="small">{L.method(g.method)}</td><td className="num">{fmtMoney(g.amount)}</td><td className="num small">{g.payment_ref || '—'}</td><td><span className={'pill' + (g.status === 'invested' ? ' good' : g.status === 'paid' ? ' gold' : '')}>{t(`status.${g.status === 'paid' ? 'held' : g.status}` as any)}</span></td></tr>)}
      </Table>
    </Page>
  );
}

export function AdminUsers() {
  const { t, fmtDate } = useI18n();
  const [users, setUsers] = useState<any[]>([]);
  useEffect(() => { api('/admin/users').then((r) => setUsers(r.users)); }, []);
  return (
    <Page title={t('admin.nav.users')}>
      <Table head={[t('auth.name'), t('auth.email'), t('admin.col.role'), 'KYC', t('admin.children'), t('admin.col.joined')]}>
        {users.map((u) => <tr key={u.id}><td>{u.name}</td><td className="num">{u.email}</td><td>{u.role}</td><td><span className={'pill' + (u.kyc_status === 'verified' ? ' good' : '')}>{u.kyc_status}</span></td><td className="num">{u.children}</td><td>{fmtDate(u.created_at)}</td></tr>)}
      </Table>
    </Page>
  );
}

export function AdminOutbox() {
  const { t } = useI18n();
  const [msgs, setMsgs] = useState<any[]>([]);
  useEffect(() => { api('/admin/outbox').then((r) => setMsgs(r.messages)); }, []);
  return (
    <Page title={t('admin.nav.outbox')}>
      <Table head={[t('admin.col.when'), t('admin.col.to'), t('admin.col.subject')]}>
        {msgs.slice(0, 80).map((m) => <tr key={m.id}><td className="num small">{m.created_at}</td><td className="num small">{m.recipient}</td><td style={{ whiteSpace: 'normal' }}><b>{m.subject}</b><div className="small muted">{m.body}</div></td></tr>)}
      </Table>
    </Page>
  );
}

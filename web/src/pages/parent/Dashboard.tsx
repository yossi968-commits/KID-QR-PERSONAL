import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../../i18n';
import { useAuth } from '../../lib/auth';
import { api, type Child } from '../../lib/api';
import { AccountPill, Kpis, Loading, Signed, useLabels } from '../../components/ui';

type Row = Child & { held: number; earned: number; docsMissing: number; pendingWithdrawals: number; monthly: number };

/** The family's investment overview: accounts table plus what needs the parent's attention. */
export default function Dashboard() {
  const { t, fmtMoney, fmtDate } = useI18n();
  const { user } = useAuth();
  const L = useLabels();
  const [kids, setKids] = useState<Row[] | null>(null);
  useEffect(() => { api<{ children: Row[] }>('/children').then((r) => setKids(r.children)); }, []);
  if (!kids) return <Loading />;
  const sum = (k: keyof Row) => kids.reduce((s, c) => s + (Number(c[k]) || 0), 0);
  const value = sum('value'), dep = sum('deposited');
  const tasks = [
    ...kids.filter((k) => k.docsMissing > 0).map((k) => ({ key: 'd' + k.id, icon: '📄', text: t('dash.task.docs', { name: k.firstName, n: k.docsMissing }), to: `/parent/child/${k.id}?tab=fund`, cta: t('dash.task.docsCta') })),
    ...kids.filter((k) => k.accountStatus === 'in_review').map((k) => ({ key: 'r' + k.id, icon: '⏳', text: t('dash.task.review', { name: k.firstName, house: k.providerName }), to: `/parent/child/${k.id}?tab=fund`, cta: t('dash.task.view') })),
    ...kids.filter((k) => k.pendingWithdrawals > 0).map((k) => ({ key: 'w' + k.id, icon: '✋', text: t('dash.task.withdraw', { name: k.firstName, n: k.pendingWithdrawals }), to: `/parent/child/${k.id}?tab=planner`, cta: t('dash.task.decide') })),
  ];

  return (
    <div className="container page-head stack">
      <div className="row between">
        <div>
          <div className="eyebrow">{t('dash.eyebrow', { name: user?.name || '' })}</div>
          <h1 style={{ margin: '4px 0 0' }}>{t('dash.title')}</h1>
        </div>
        <Link className="btn" to="/parent/new">＋ {t('parent.nav.open')}</Link>
      </div>
      {user?.kycStatus !== 'verified' && <div className="banner">⚠️ {t('dash.kycBanner')} <Link to="/parent/new" className="btn sm">{t('onb.verify')}</Link></div>}

      <Kpis items={[
        { label: t('dash.total'), value: fmtMoney(value) },
        { label: t('dash.deposited'), value: fmtMoney(dep) },
        { label: t('child.gain'), value: <Signed value={value - dep} />, sub: dep ? `${(((value - dep) / dep) * 100).toFixed(1)}%` : undefined },
        { label: t('dash.monthly'), value: fmtMoney(sum('monthly')), sub: t('dash.monthlySub') },
        { label: t('dash.held'), value: fmtMoney(sum('held')), sub: t('dash.heldSub') },
      ]} />

      {tasks.length > 0 && (
        <div className="card">
          <div className="card-head"><h3>{t('dash.tasks')}</h3><span className="pill gold num">{tasks.length}</span></div>
          {tasks.map((x) => (
            <div key={x.key} className="list-row">
              <span aria-hidden style={{ fontSize: 20 }}>{x.icon}</span>
              <span style={{ flex: 1 }}>{x.text}</span>
              <Link className="btn sm secondary" to={x.to}>{x.cta}</Link>
            </div>
          ))}
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        <div className="card-head" style={{ padding: '16px 20px 0' }}><h3>{t('dash.accounts')}</h3><span className="small muted">{t('dash.asOf', { date: fmtDate(new Date().toISOString().slice(0, 10)) })}</span></div>
        {kids.length === 0 ? <p className="muted" style={{ padding: 20 }}>{t('dash.empty')}</p> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr>
                <th>{t('dash.col.child')}</th><th>{t('dash.col.house')}</th><th>{t('dash.col.account')}</th><th>{t('dash.col.track')}</th><th>{t('dash.col.status')}</th>
                <th className="num">{t('dash.col.value')}</th><th className="num">{t('dash.col.gain')}</th><th className="num">{t('dash.col.monthly')}</th>
              </tr></thead>
              <tbody>
                {kids.map((k) => (
                  <tr key={k.id}>
                    <td><Link className="rowlink" to={`/parent/child/${k.id}`}><span aria-hidden>{k.avatar}</span> {k.firstName}</Link><div className="small muted">{t('dash.ageGrade', { age: k.age, grade: gradeLabel(t, k.grade) })}</div></td>
                    <td>{k.providerName}</td>
                    <td className="num small">{k.partnerAccountId || '—'}</td>
                    <td>{L.track(k.track)}</td>
                    <td><AccountPill status={k.accountStatus} /></td>
                    <td className="num"><b>{fmtMoney(k.value || 0)}</b>{k.held > 0 && <div className="small muted">+{fmtMoney(k.held)} {t('dash.waiting')}</div>}</td>
                    <td className="num"><Signed value={(k.value || 0) - (k.deposited || 0)} /></td>
                    <td className="num">{k.monthly ? fmtMoney(k.monthly) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="sandbox-tag">{t('dash.sandbox')}</div>
    </div>
  );
}

/** Israeli grade names: א–ו, ז–ט, י–יב, then "after school". */
export function gradeLabel(t: (k: any, v?: any) => string, grade: number) {
  if (grade < 1) return t('grade.preschool');
  if (grade > 12) return t('grade.after');
  return t(`grade.${grade}`);
}

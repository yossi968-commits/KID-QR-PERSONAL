import { useEffect, useState } from 'react';
import { useI18n } from '../i18n';
import { api } from '../lib/api';
import { Bars } from '../components/Charts';

export default function Admin() {
  const { t, fmtMoney, fmtDate } = useI18n();
  const [s, setS] = useState<any>(null);
  const [gifts, setGifts] = useState<any[]>([]);
  const [outbox, setOutbox] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  useEffect(() => {
    api('/admin/stats').then(setS);
    api('/admin/contributions').then((r) => setGifts(r.contributions));
    api('/admin/outbox').then((r) => setOutbox(r.messages));
    api('/admin/users').then((r) => setUsers(r.users));
  }, []);
  if (!s) return <div className="container page-head muted">{t('common.loading')}</div>;
  const kpis: [string, string][] = [
    ['admin.aum', fmtMoney(s.aum)], ['admin.volume', fmtMoney(s.giftVolume)], ['admin.gifts', String(s.gifts)], ['admin.avg', fmtMoney(s.avgGift)],
    ['admin.users', String(s.users)], ['admin.verified', String(s.verifiedGuardians)], ['admin.children', String(s.children)], ['admin.pending', String(s.pending)],
  ];
  return (
    <div className="container page-head stack">
      <h1 style={{ fontSize: '1.8rem' }}>{t('admin.title')}</h1>
      <div className="grid grid-4">{kpis.map(([k, v], i) => <div key={k} className={'card stat' + (i === 0 ? ' brand' : '')}><div className="label">{t(k as any)}</div><div className="value num">{v}</div></div>)}</div>
      <div className="card"><h3>{t('admin.monthly')}</h3><Bars data={s.monthly.map((m: any) => ({ label: m.month.slice(2), value: m.amount }))} /></div>
      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <div className="card"><h3>{t('admin.recent')}</h3><div className="table-wrap"><table className="table"><tbody>
          {gifts.slice(0, 12).map((g) => <tr key={g.id}><td>{g.giver_name}</td><td>{g.child}</td><td className="num">{fmtMoney(g.amount)}</td><td><span className={'pill' + (g.status === 'invested' ? ' good' : '')}>{t(('status.' + g.status) as any)}</span></td></tr>)}
        </tbody></table></div></div>
        <div className="card"><h3>{t('admin.outbox')}</h3>
          {outbox.length === 0 && <p className="muted">—</p>}
          {outbox.slice(0, 8).map((m) => <div key={m.id} className="wall-item" style={{ flexDirection: 'column', gap: 0, marginBottom: 8 }}><div className="small muted num">{m.recipient} · {m.created_at}</div><strong>{m.subject}</strong><span className="small">{m.body}</span></div>)}
        </div>
      </div>
      <div className="card"><h3>{t('admin.users')}</h3><div className="table-wrap"><table className="table"><tbody>
        {users.map((u) => <tr key={u.id}><td>{u.name}</td><td className="num">{u.email}</td><td>{u.role}</td><td>{u.kyc_status}</td><td>{u.children}</td><td>{fmtDate(u.created_at)}</td></tr>)}
      </tbody></table></div></div>
    </div>
  );
}

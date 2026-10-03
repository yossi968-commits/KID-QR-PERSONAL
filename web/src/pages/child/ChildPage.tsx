import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useI18n } from '../../i18n';
import { api, type Child, type Portfolio, type EventRow } from '../../lib/api';
import Overview from './Overview';
import Gifts from './Gifts';
import QrTab from './QrTab';
import Events from './Events';
import Learn from './Learn';
import Settings from './Settings';

export type ChildData = { child: Child; portfolio: Portfolio; events: EventRow[] };
const TABS = ['overview', 'gifts', 'qr', 'events', 'learn', 'settings'] as const;

export default function ChildPage() {
  const { id } = useParams();
  const { t, fmtMoney } = useI18n();
  const [sp, setSp] = useSearchParams();
  const tab = (TABS as readonly string[]).includes(sp.get('tab') || '') ? sp.get('tab')! : 'overview';
  const [data, setData] = useState<ChildData | null>(null);
  const load = useCallback(() => api<ChildData>(`/children/${id}`).then(setData), [id]);
  useEffect(() => { load(); }, [load]);
  if (!data) return <div className="container page-head muted">{t('common.loading')}</div>;
  const { child, portfolio } = data;

  return (
    <div className="container page-head">
      <div className="row" style={{ marginBottom: 16 }}>
        <div className="avatar lg">{child.avatar}</div>
        <div>
          <h1 style={{ fontSize: '1.8rem', margin: 0 }}>{child.firstName} {child.lastName}</h1>
          <div className="muted">{t('dash.age')} {child.age} · <span className="num">{fmtMoney(portfolio.value)}</span></div>
        </div>
        <span className="spacer" />
        <Link className="btn gold sm" to={`/kid/${child.id}`}>🌳 {t('child.kidMode')}</Link>
      </div>
      <div className="tabs" role="tablist">
        {TABS.map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setSp({ tab: k }, { replace: true })}>
            {t(`child.tab.${k}` as any)}
          </button>
        ))}
      </div>
      {tab === 'overview' && <Overview data={data} />}
      {tab === 'gifts' && <Gifts child={child} />}
      {tab === 'qr' && <QrTab child={child} />}
      {tab === 'events' && <Events data={data} reload={load} />}
      {tab === 'learn' && <Learn child={child} />}
      {tab === 'settings' && <Settings data={data} reload={load} />}
    </div>
  );
}

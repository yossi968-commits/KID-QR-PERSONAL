import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import { useAuth } from '../lib/auth';
import { api, COMMUNITIES, type Community, type CommunityId, type Family, type Pregnancy } from '../lib/api';
import { useErr } from '../pages/Auth';

/** "Expecting a baby?": the parent registers a due date and gets reminders to open the baby's QR. */
export function ExpectingCard({ family, onChange }: { family: Family; onChange: (f: Family) => void }) {
  const { t, fmtDate, name } = useI18n();
  const errText = useErr();
  const [due, setDue] = useState('');
  const [fund, setFund] = useState('');
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  const funds = family.partners.filter((p) => p.kind === 'health_fund');
  const open = family.pregnancies.filter((g) => !g.childId);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr('');
    try {
      const r = await api<{ pregnancy: Pregnancy }>('/family/expecting', { body: { dueDate: due, partnerId: fund ? Number(fund) : null } });
      onChange({ ...family, pregnancies: [...family.pregnancies, r.pregnancy] });
      setDue(''); setDone(true);
    } catch (x) { setErr(errText(x)); }
  };
  const cancel = async (id: number) => {
    await api(`/family/expecting/${id}`, { method: 'DELETE' });
    onChange({ ...family, pregnancies: family.pregnancies.filter((g) => g.id !== id) });
  };
  return (
    <div className="card stack">
      <div><h3 style={{ margin: 0 }}>🤰 {t('expect.title')}</h3><p className="small muted" style={{ margin: '4px 0 0' }}>{t('expect.desc')}</p></div>
      {open.map((g) => {
        const p = funds.find((x) => x.id === g.partnerId);
        return (
          <div key={g.id} className="list-row">
            <span aria-hidden style={{ fontSize: 20 }}>👶</span>
            <span style={{ flex: 1 }}>
              <b>{t('expect.listItem', { date: fmtDate(g.dueDate) })}</b>
              <div className="small muted">{p && <>{p.logo} {t('expect.withFund', { name: name(p) })} · </>}{t('expect.remindersSent', { n: g.remindersSent.length })}</div>
            </span>
            <Link className="btn sm" to="/parent/new">{t('expect.open')}</Link>
            <button className="btn sm ghost" onClick={() => cancel(g.id)}>{t('expect.cancel')}</button>
          </div>
        );
      })}
      <form className="row" onSubmit={submit} style={{ alignItems: 'flex-end' }}>
        <label className="field" style={{ flex: 1, minWidth: 150 }}><span>{t('expect.dueDate')}</span><input type="date" value={due} onChange={(e) => setDue(e.target.value)} required /></label>
        {funds.length > 0 && (
          <label className="field" style={{ flex: 1, minWidth: 150 }}><span>{t('expect.healthFund')}</span>
            <select value={fund} onChange={(e) => setFund(e.target.value)}>
              <option value="">{t('expect.none')}</option>
              {funds.map((p) => <option key={p.id} value={p.id}>{p.logo} {name(p)}</option>)}
            </select>
          </label>
        )}
        <button className="btn secondary">{t('expect.submit')}</button>
      </form>
      {done && <div className="small" role="status">✓ {t('expect.done')}</div>}
      {err && <div className="error" role="alert">{err}</div>}
    </div>
  );
}

/** The family's community: which occasions, goals and tracks the app offers first. */
export function CommunityCard({ family, onChange }: { family: Family; onChange: (f: Family) => void }) {
  const { t, fmtMoney } = useI18n();
  const { setUser } = useAuth();
  const [saved, setSaved] = useState(false);
  const pick = async (id: CommunityId) => {
    const r = await api<{ user: any; community: Community }>('/family', { method: 'PATCH', body: { community: id } });
    setUser(r.user); onChange({ ...family, community: r.community }); setSaved(true);
  };
  const c = family.community;
  return (
    <div className="card stack">
      <div><h3 style={{ margin: 0 }}>🏡 {t('community.title')}</h3><p className="small muted" style={{ margin: '4px 0 0' }}>{t('community.desc')}</p></div>
      <div className="row" style={{ gap: 6 }} role="radiogroup" aria-label={t('community.title')}>
        {COMMUNITIES.map((id) => <button key={id} type="button" role="radio" aria-checked={c.id === id} className={'chip' + (c.id === id ? ' on' : '')} onClick={() => pick(id)}>{t(`community.${id}` as const)}</button>)}
      </div>
      <div>
        <span className="field-label">{t('goal.ideas')}</span>
        <div className="row small" style={{ gap: 10 }}>
          {c.goals.slice(0, 4).map((g) => <span key={g.key}><span aria-hidden>{g.icon}</span> {t(`goal.${g.key}` as any)} <span className="muted">· {t('goal.atAge', { age: g.age, amount: fmtMoney(g.amount) })}</span></span>)}
        </div>
      </div>
      {c.track && <div className="small">📈 {t('track.communityPick')}: <b>{t(`track.${c.track}` as any)}</b></div>}
      {saved && <div className="small" role="status">✓ {t('community.saved')}</div>}
    </div>
  );
}

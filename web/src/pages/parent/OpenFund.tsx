import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useI18n } from '../../i18n';
import { useAuth } from '../../lib/auth';
import { api, type Child, type ChildData, type Family, type Provider } from '../../lib/api';
import TrackDialog from '../../components/TrackDialog';
import { useErr } from '../Auth';

export const AVATARS = ['🦁', '🐻', '🦊', '🐼', '🐨', '🐯', '🦄', '🐬', '🦋', '🐢', '🚀', '⭐', '🐣', '🐥'];
const STEPS = ['identity', 'house', 'child', 'track'] as const;

/**
 * Open a child's קופת גמל להשקעה and personal QR in four short steps. Documents are
 * a checklist on the next screen: the QR works right away and the parent can finish later.
 */
export default function OpenFund() {
  const { t, fmtMoney, name } = useI18n();
  const { user, setUser } = useAuth();
  const nav = useNavigate();
  const errText = useErr();
  const [step, setStep] = useState(user?.kycStatus === 'verified' ? 1 : 0);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [welcome, setWelcome] = useState(0);
  const [nationalId, setNationalId] = useState('');
  const [consent, setConsent] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [sp] = useSearchParams();
  const siblingId = sp.get('sibling');
  const [sibling, setSibling] = useState<Child | null>(null);
  const [family, setFamily] = useState<Family | null>(null);
  const [f, setF] = useState({ provider: '', firstName: '', lastName: '', birthDate: '', avatar: AVATARS[0], track: 'equity', goalText: '', publicMessage: '' });
  const [healthFund, setHealthFund] = useState('');
  const [consents, setConsents] = useState<number[]>([]);
  useEffect(() => { api<{ providers: Provider[]; defaultProvider: string; welcomeGift: number }>('/providers').then((r) => { setProviders(r.providers); setWelcome(r.welcomeGift); setF((x) => ({ ...x, provider: x.provider || r.defaultProvider })); }); }, []);
  useEffect(() => { api<Family>('/family').then(setFamily).catch(() => {}); }, []);
  // A brother or sister: start from what the family already gave us.
  useEffect(() => {
    if (!siblingId) return;
    api<ChildData>(`/children/${siblingId}`).then(({ child: c }) => {
      setSibling(c);
      setF((x) => ({ ...x, lastName: c.lastName || '', provider: c.provider, track: c.track }));
      if (c.healthFundId) setHealthFund(String(c.healthFundId));
    }).catch(() => {});
  }, [siblingId]);
  const set = (k: keyof typeof f) => (e: any) => setF({ ...f, [k]: e.target.value });
  const age = f.birthDate ? Math.max(0, Math.floor((Date.now() - Date.parse(f.birthDate)) / (365.25 * 86400000))) : 0;
  const partners = family?.partners || [];
  const funds = partners.filter((p) => p.kind === 'health_fund');
  const brands = partners.filter((p) => p.kind !== 'health_fund' && (p.maxChildAge == null || age <= p.maxChildAge));
  const fund = funds.find((p) => String(p.id) === healthFund);
  const chosen = brands.filter((p) => consents.includes(p.id));
  const giftsTotal = welcome + (fund?.amount || 0) + chosen.reduce((s, p) => s + p.amount, 0);
  const community = family?.community;

  const verify = async (e: FormEvent) => {
    e.preventDefault(); setErr('');
    try { const r = await api('/auth/kyc', { body: { nationalId, consent } }); setUser(r.user); setStep(1); } catch (x) { setErr(errText(x)); }
  };
  const create = async () => {
    setErr(''); setBusy(true);
    try {
      const r = await api<{ child: Child; partnerGifts: string[]; reusedDocuments: string[] }>('/children', {
        body: { ...f, healthFund: fund?.id, partnerConsents: chosen.map((p) => p.id), siblingOf: sibling?.id },
      });
      nav(`/parent/child/${r.child.id}?tab=fund&new=1&gifts=${r.partnerGifts.length}&reused=${r.reusedDocuments.length}`);
    } catch (x) { setErr(errText(x)); setBusy(false); }
  };
  const house = providers.find((p) => p.id === f.provider);

  return (
    <div className="container page-head" style={{ maxWidth: 760 }}>
      <div className="eyebrow">{t('open.eyebrow')}</div>
      <h1 style={{ margin: '4px 0 6px' }}>{sibling ? t('sib.title', { name: sibling.firstName }) : t('open.title')}</h1>
      <p className="muted">{sibling ? t('sib.desc') : t('open.lead')}</p>
      <ol className="steps" aria-label={t('open.progress')}>
        {STEPS.map((s, i) => <li key={s} className={i < step ? 'done' : i === step ? 'on' : ''} aria-current={i === step ? 'step' : undefined}><span className="num">{i + 1}</span>{t(`open.step.${s}` as any)}</li>)}
      </ol>

      {step === 0 && (
        <form className="card stack" onSubmit={verify}>
          <h3>{t('onb.kycTitle')}</h3>
          <p className="muted small" style={{ margin: 0 }}>{t('onb.kycDesc')}</p>
          {!user?.hasNationalId && <label className="field"><span>{t('onb.nationalId')}</span><input inputMode="numeric" dir="ltr" value={nationalId} onChange={(e) => setNationalId(e.target.value)} required maxLength={9} /></label>}
          <label className="check"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />{t('onb.consent')}</label>
          {err && <div className="error">{err}</div>}
          <button className="btn">{t('onb.verify')}</button>
          <div className="sandbox-tag">Sandbox · 000000018</div>
        </form>
      )}

      {step === 1 && (
        <div className="card stack">
          <h3>{t('open.houseTitle')}</h3>
          <p className="muted small" style={{ margin: 0 }}>{t('open.houseDesc')}</p>
          <label className="field"><span>{t('open.house')}</span>
            <select value={f.provider} onChange={set('provider')}>
              {providers.map((p) => <option key={p.id} value={p.id}>{name(p)}</option>)}
            </select>
          </label>
          <div className="grid grid-3" style={{ gap: 10 }}>
            {['open.fact1', 'open.fact2', 'open.fact3'].map((k) => <div key={k} className="card" style={{ padding: 14, background: 'var(--surface-2)' }}><div className="small">{t(k as any)}</div></div>)}
          </div>
          {welcome > 0 && <div className="banner small">{t('open.welcome', { amount: fmtMoney(welcome) })}</div>}
          <div className="small muted">ⓘ {t('fund.exampleNote')}</div>
          <div className="row"><button className="btn" onClick={() => setStep(2)} disabled={!f.provider}>{t('open.next')}</button></div>
        </div>
      )}

      {step === 2 && (
        <form className="card stack" onSubmit={(e) => { e.preventDefault(); setStep(3); setDialog(true); }}>
          <h3>{t('onb.childTitle')}</h3>
          <div className="grid grid-2" style={{ gap: 12 }}>
            <label className="field"><span>{t('onb.firstName')}</span><input value={f.firstName} onChange={set('firstName')} required /></label>
            <label className="field"><span>{t('onb.lastName')}</span><input value={f.lastName} onChange={set('lastName')} /></label>
          </div>
          <label className="field"><span>{t('onb.birthDate')}</span><input type="date" value={f.birthDate} onChange={set('birthDate')} required max={new Date().toISOString().slice(0, 10)} /></label>
          <p className="small muted" style={{ margin: 0 }}>{t('open.newbornHint')} {t('open.anyAge')}</p>
          {partners.length > 0 && age < 18 && (
            <div className="card stack" style={{ padding: 14, background: 'var(--surface-2)', gap: 10 }}>
              <div><b>🎁 {t('open.partnersTitle')}</b><div className="small muted">{t('open.partnersDesc')}</div></div>
              {funds.length > 0 && (
                <label className="field"><span>{t('open.healthFund')}</span>
                  <select value={healthFund} onChange={(e) => setHealthFund(e.target.value)}>
                    <option value="">{t('open.healthFundNone')}</option>
                    {funds.map((p) => <option key={p.id} value={p.id}>{p.logo} {name(p)} · 🎁 {fmtMoney(p.amount)}</option>)}
                  </select>
                </label>
              )}
              {brands.map((p) => (
                <label key={p.id} className="check">
                  <input type="checkbox" checked={consents.includes(p.id)} onChange={(e) => setConsents(e.target.checked ? [...consents, p.id] : consents.filter((x) => x !== p.id))} />
                  <span>{p.logo} {t('open.formulaConsent', { amount: fmtMoney(p.amount), name: name(p) })}<div className="small muted">{t('open.formulaNote')}</div></span>
                </label>
              ))}
            </div>
          )}
          {age >= 18 && <div className="banner small">🔑 {t('open.adultNote', { name: f.firstName || '…' })}</div>}
          <div>
            <span className="field-label">{t('onb.avatar')}</span>
            <div className="row" style={{ gap: 6 }}>
              {AVATARS.map((a) => <button type="button" key={a} onClick={() => setF({ ...f, avatar: a })} className={'chip' + (f.avatar === a ? ' on' : '')} style={{ fontSize: 22, padding: 4, width: 44 }} aria-pressed={f.avatar === a}>{a}</button>)}
            </div>
          </div>
          <label className="field"><span>{t('onb.goal')}</span><input value={f.goalText} onChange={set('goalText')} placeholder={t('onb.goalPh')} /></label>
          {community && <GoalIdeas goals={community.goals} onPick={(text) => setF({ ...f, goalText: text })} />}
          <label className="field"><span>{t('onb.publicMessage')}</span><input value={f.publicMessage} onChange={set('publicMessage')} placeholder={t('onb.publicMessagePh')} /></label>
          <div className="row"><button className="btn">{t('open.next')}</button><button type="button" className="btn ghost" onClick={() => setStep(1)}>{t('common.back')}</button></div>
        </form>
      )}

      {step === 3 && (
        <div className="card stack">
          <h3>{t('open.summary')}</h3>
          <table className="table"><tbody>
            <tr><th>{t('open.house')}</th><td>{name(house)} · {t('fund.product')}</td></tr>
            <tr><th>{t('onb.firstName')}</th><td>{f.avatar} {f.firstName} {f.lastName}</td></tr>
            <tr><th>{t('onb.birthDate')}</th><td className="num">{f.birthDate}</td></tr>
            <tr><th>{t('onb.track')}</th><td>{t(`track.${f.track}` as any)} <button className="link small" onClick={() => setDialog(true)}>{t('open.change')}</button></td></tr>
            {fund && <tr><th>{t('expect.healthFund')}</th><td>{fund.logo} {name(fund)}</td></tr>}
            <tr><th>{t('open.partnersTitle')}</th><td>
              <div className="small">🏦 {name(house)} · {fmtMoney(welcome)}</div>
              {[fund, ...chosen].filter(Boolean).map((p) => <div key={p!.id} className="small">{p!.logo} {name(p!)} · {fmtMoney(p!.amount)}</div>)}
              <b className="small">{t('open.giftsTotal', { amount: fmtMoney(giftsTotal) })}</b>
            </td></tr>
          </tbody></table>
          <div className="banner small">📄 {t('open.docsLater')}</div>
          {err && <div className="error">{err}</div>}
          <div className="row"><button className="btn gold" disabled={busy} onClick={create}>{t('open.create')}</button><button className="btn ghost" onClick={() => setStep(2)}>{t('common.back')}</button></div>
        </div>
      )}
      {dialog && <TrackDialog value={f.track} communityTrack={community?.track} years={age >= 21 ? 10 : Math.max(1, 21 - age)} onClose={() => setDialog(false)} onPick={(track) => { setF({ ...f, track }); setDialog(false); }} />}
    </div>
  );
}

/** Goal suggestions for the family's community (tefillin for the bar mitzvah, a degree, a wedding…). */
export function GoalIdeas({ goals, onPick }: { goals: { key: string; icon: string; amount: number; age: number }[]; onPick: (text: string, amount: number, age: number) => void }) {
  const { t, fmtMoney } = useI18n();
  return (
    <div>
      <span className="field-label">{t('goal.ideas')}</span>
      <div className="row" style={{ gap: 6 }}>
        {goals.map((g) => (
          <button type="button" key={g.key} className="chip" onClick={() => onPick(t(`goal.${g.key}` as any), g.amount, g.age)} title={t('goal.atAge', { age: g.age, amount: fmtMoney(g.amount) })}>
            <span aria-hidden>{g.icon}</span> {t(`goal.${g.key}` as any)}
          </button>
        ))}
      </div>
    </div>
  );
}

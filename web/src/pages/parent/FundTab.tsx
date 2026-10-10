import { useState } from 'react';
import { useI18n } from '../../i18n';
import { api, type ChildData, type DocItem, type Docs } from '../../lib/api';
import TrackDialog from '../../components/TrackDialog';
import { MoveFund } from '../../components/MoveFund';
import { AccountPill, useLabels } from '../../components/ui';
import { useErr } from '../Auth';

/** The fund itself: opening checklist, account details and track switching. */
export default function FundTab({ data, reload, fresh }: { data: ChildData; reload: () => void; fresh: boolean }) {
  const { t, fmtMoney, fmtDate } = useI18n();
  const L = useLabels();
  const errText = useErr();
  const { child, documents } = data;
  const [dialog, setDialog] = useState(false);
  const [pick, setPick] = useState<string | null>(null);
  const [co, setCo] = useState(false);
  const [err, setErr] = useState('');
  const switchTrack = async () => {
    setErr('');
    try { await api(`/children/${child.id}/track`, { body: { track: pick, coSigned: co } }); setPick(null); setCo(false); reload(); } catch (x) { setErr(errText(x)); }
  };
  const locked = Boolean(child.nextTrackSwitch && child.nextTrackSwitch > new Date().toISOString().slice(0, 10));

  return (
    <div className="grid grid-2" style={{ alignItems: 'start' }}>
      <DocChecklist initial={documents} base={`/children/${child.id}`} name={child.firstName} fresh={fresh} onComplete={reload} />

      <div className="stack">
        <div className="card">
          <h3>{t('fund.account')}</h3>
          <dl className="kv">
            <dt>{t('open.house')}</dt><dd>{t(`provider.${child.provider}` as any)}</dd>
            <dt>{t('fund.productLabel')}</dt><dd>{t('fund.product')}</dd>
            <dt>{t('fund.appRef')}</dt><dd className="num">{documents.applicationRef || '—'}</dd>
            <dt>{t('fund.accountNo')}</dt><dd className="num">{child.partnerAccountId || t('fund.afterOpening')}</dd>
            <dt>{t('fund.openedAt')}</dt><dd>{child.accountOpenedAt ? fmtDate(child.accountOpenedAt) : '—'}</dd>
            <dt>{t('fund.held')}</dt><dd className="num">{fmtMoney(data.portfolio.held)}</dd>
          </dl>
          <div className="small muted" style={{ marginTop: 10 }}>ⓘ {t('fund.exampleNote')}</div>
        </div>

        <MoveFund child={child} url={`/children/${child.id}/provider`} coSign onDone={reload} />

        <div className="card stack">
          <div className="card-head"><h3 style={{ margin: 0 }}>{t('fund.track')}</h3><span className="pill brand">{L.track(child.track)}</span></div>
          <p className="small muted" style={{ margin: 0 }}>{locked ? t('fund.trackLocked', { date: fmtDate(child.nextTrackSwitch!) }) : t('fund.trackFree')}</p>
          {pick ? (
            <div className="banner stack" style={{ alignItems: 'stretch' }}>
              <span>{t('settings.confirmSwitch', { track: L.track(pick) })}</span>
              {child.accountStatus === 'active' && <label className="check"><input type="checkbox" checked={co} onChange={(e) => setCo(e.target.checked)} />{t('plan.coSign')}</label>}
              <div className="row"><button className="btn sm" disabled={child.accountStatus === 'active' && !co} onClick={switchTrack}>{t('settings.switch')} {L.track(pick)}</button><button className="btn ghost sm" onClick={() => setPick(null)}>{t('common.cancel')}</button></div>
            </div>
          ) : <button className="btn secondary" disabled={locked} onClick={() => setDialog(true)}>{t('fund.changeTrack')}</button>}
          <p className="small muted" style={{ margin: 0 }}>{t('fund.trackLaw')}</p>
        </div>
      </div>
      {dialog && <TrackDialog value={child.track} coreOnly={false} years={Math.max(1, 21 - child.age)} onClose={() => setDialog(false)} onPick={(tr) => { setDialog(false); if (tr !== child.track) setPick(tr); }} />}
    </div>
  );
}

/** The opening checklist; parents use it for a child's fund, an adult saver for their own. */
export function DocChecklist({ initial, base, name, fresh, onComplete }: { initial: Docs; base: string; name: string; fresh?: boolean; onComplete?: () => void }) {
  const { t } = useI18n();
  const errText = useErr();
  const [docs, setDocs] = useState<Docs>(initial);
  const [open, setOpen] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const submit = async (doc: string, body: unknown) => {
    setErr('');
    try { setDocs(await api(`${base}/documents/${doc}`, { body })); setOpen(null); onComplete?.(); } catch (x) { setErr(errText(x)); }
  };
  const pct = Math.round((docs.done / docs.total) * 100);
  const child = { firstName: name };
  return (
      <div className="card">
        <div className="card-head">
          <div><h3 style={{ margin: 0 }}>{t('fund.checklist')}</h3><div className="small muted">{t('fund.checklistDesc')}</div></div>
          <AccountPill status={docs.accountStatus} />
        </div>
        {fresh && docs.accountStatus === 'pending_docs' && <div className="banner small" style={{ marginBottom: 10 }}>🎉 {t('fund.freshBanner', { name: child.firstName })}</div>}
        <div className="row between small"><span>{t('fund.progress', { done: docs.done, total: docs.total })}</span><span className="num">{pct}%</span></div>
        <div className="progress" style={{ margin: '6px 0 6px' }}><div style={{ width: pct + '%', background: 'var(--brand)' }} /></div>
        {docs.items.map((d) => (
          <div key={d.id} className={'check-item' + (d.status !== 'missing' ? ' ok' : '')}>
            <span className="ci-icon" aria-hidden>{d.status !== 'missing' ? '✓' : d.kind === 'upload' ? '⇪' : d.kind === 'form' ? '✎' : '✍'}</span>
            <div className="ci-body">
              <b>{t(`doc.${d.id}` as any)}</b>
              <div className="small muted">{d.status === 'missing' ? t(`doc.${d.id}.hint` as any) : `${d.fileName || t('doc.done')} · ${t(`doc.status.${d.status}` as any)}`}</div>
            </div>
            {docs.accountStatus !== 'active' && <DocAction d={d} open={open === d.id} setOpen={(v) => setOpen(v ? d.id : null)} onSubmit={(b) => submit(d.id, b)} />}
            {open === d.id && d.kind !== 'upload' && <DocForm d={d} adult={docs.adult} onSubmit={(b) => submit(d.id, b)} onCancel={() => setOpen(null)} />}
          </div>
        ))}
        {err && <div className="error" role="alert">{err}</div>}
        <p className="small muted" style={{ margin: '10px 0 0' }}>🔔 {t('fund.reminders')}</p>
      </div>

  );
}

function DocAction({ d, open, setOpen, onSubmit }: { d: DocItem; open: boolean; setOpen: (v: boolean) => void; onSubmit: (b: unknown) => void }) {
  const { t } = useI18n();
  const label = d.status === 'missing' ? t(`doc.cta.${d.kind}` as any) : t('doc.replace');
  if (d.kind === 'upload') {
    return (
      <label className={'btn sm upload ' + (d.status === 'missing' ? '' : 'ghost')}>
        {label}
        <input type="file" accept=".pdf,.jpg,.jpeg,.png,.heic,image/*,application/pdf" capture="environment" onChange={(e) => { const f = e.target.files?.[0]; if (f) onSubmit({ fileName: f.name, size: f.size, type: f.type }); }} />
      </label>
    );
  }
  return <button className={'btn sm ' + (d.status === 'missing' ? '' : 'ghost')} onClick={() => setOpen(!open)} aria-expanded={open}>{label}</button>;
}

function DocForm({ d, adult, onSubmit, onCancel }: { d: DocItem; adult?: boolean; onSubmit: (b: unknown) => void; onCancel: () => void }) {
  const { t } = useI18n();
  const [f, setF] = useState({ occupation: '', sourceOfFunds: 'family_gifts', pep: false, usPerson: false, signerName: '', secondSignerName: '', agree: false });
  return (
    <div className="stack" style={{ width: '100%', padding: '10px 0 0 0' }}>
      {d.kind === 'form' ? (
        <>
          <label className="field"><span>{t('kyc.occupation')}</span><input value={f.occupation} onChange={(e) => setF({ ...f, occupation: e.target.value })} /></label>
          <label className="field"><span>{t('kyc.source')}</span>
            <select value={f.sourceOfFunds} onChange={(e) => setF({ ...f, sourceOfFunds: e.target.value })}>{['family_gifts', 'salary', 'savings', 'other'].map((s) => <option key={s} value={s}>{t(`kyc.src.${s}` as any)}</option>)}</select>
          </label>
          <label className="check"><input type="checkbox" checked={f.pep} onChange={(e) => setF({ ...f, pep: e.target.checked })} />{t('kyc.pep')}</label>
          <label className="check"><input type="checkbox" checked={f.usPerson} onChange={(e) => setF({ ...f, usPerson: e.target.checked })} />{t('kyc.us')}</label>
          <div className="row"><button className="btn sm" disabled={!f.occupation} onClick={() => onSubmit({ answers: { occupation: f.occupation, sourceOfFunds: f.sourceOfFunds, pep: f.pep, usPerson: f.usPerson } })}>{t('doc.save')}</button><button className="btn ghost sm" onClick={onCancel}>{t('common.cancel')}</button></div>
        </>
      ) : (
        <>
          <p className="small muted" style={{ margin: 0 }}>{t(adult ? 'sign.descAdult' : 'sign.desc')}</p>
          <div className="grid grid-2" style={{ gap: 10 }}>
            <label className="field"><span>{t(adult ? 'sign.holder' : 'sign.parent1')}</span><input value={f.signerName} onChange={(e) => setF({ ...f, signerName: e.target.value })} /></label>
            {!adult && <label className="field"><span>{t('sign.parent2')}</span><input value={f.secondSignerName} onChange={(e) => setF({ ...f, secondSignerName: e.target.value })} /></label>}
          </div>
          <label className="check"><input type="checkbox" checked={f.agree} onChange={(e) => setF({ ...f, agree: e.target.checked })} />{t('sign.agree')}</label>
          <div className="row"><button className="btn sm" disabled={!f.signerName || (!adult && !f.secondSignerName) || !f.agree} onClick={() => onSubmit({ signerName: f.signerName, secondSignerName: f.secondSignerName, agree: true })}>{t('sign.cta')}</button><button className="btn ghost sm" onClick={onCancel}>{t('common.cancel')}</button></div>
        </>
      )}
    </div>
  );
}

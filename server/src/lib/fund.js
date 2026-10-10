import crypto from 'node:crypto';
import { tx } from '../db.js';
import { today } from './dates.js';
import { investContribution } from './portfolio.js';

/**
 * The child's money sits in a קופת גמל להשקעה (investment provident fund) opened in
 * the child's name at an investment house the parent picks. The names below are
 * houses that offer the product; integrations are sandboxed examples until a
 * partnership is signed with each one.
 */
export const PROVIDERS = [
  { id: 'altshuler', name: 'אלטשולר שחם', nameEn: 'Altshuler Shaham' },
  { id: 'meitav', name: 'מיטב', nameEn: 'Meitav' },
  { id: 'more', name: 'מור', nameEn: 'More' },
  { id: 'analyst', name: 'אנליסט', nameEn: 'Analyst' },
  { id: 'yelin', name: 'ילין לפידות', nameEn: 'Yelin Lapidot' },
  { id: 'harel', name: 'הראל', nameEn: 'Harel' },
  { id: 'migdal', name: 'מגדל', nameEn: 'Migdal' },
  { id: 'clal', name: 'כלל', nameEn: 'Clal' },
  { id: 'phoenix', name: 'הפניקס', nameEn: 'The Phoenix' },
  { id: 'menora', name: 'מנורה מבטחים', nameEn: 'Menora Mivtachim' },
];
export const DEFAULT_PROVIDER = 'altshuler';
export const providerName = (id) => PROVIDERS.find((p) => p.id === id)?.name || id;

/**
 * The investment house gives the first gift when a QR opens: a welcome deposit that
 * waits with the other gifts and is invested when the fund opens. ₪100 is a placeholder
 * until each house's amount is agreed.
 */
export const WELCOME_GIFT = 10000;

export function addWelcomeGift(db, partner, child) {
  const house = providerName(child.provider);
  const { lastInsertRowid } = db
    .prepare(`INSERT INTO contributions (child_id, giver_name, amount, message, is_public, status, method, source, payment_ref, paid_at) VALUES (?,?,?,?,1,'paid','provider','provider_gift',?,datetime('now'))`)
    .run(child.id, house, WELCOME_GIFT, `ברוכים הבאים לחיסכון, ${child.first_name}! המתנה הראשונה שלך מ${house}.`, 'WELCOME-' + child.provider);
  if (child.account_status === 'active') investContribution(db, partner, child, db.prepare('SELECT * FROM contributions WHERE id=?').get(lastInsertRowid), today());
  return lastInsertRowid;
}

/**
 * Move the fund to another investment house (ניוד between קופות גמל להשקעה: no tax,
 * no withdrawal). The units carry over to a new account at the new house; in
 * production the houses settle it over a few business days. Before the fund opens
 * it simply changes which house the application goes to.
 */
export function transferProvider({ db, partner, notifier }, child, provider) {
  if (!PROVIDERS.some((p) => p.id === provider)) return { error: 'invalid_provider' };
  if (provider === child.provider) return { error: 'same_provider' };
  if (child.graduated_at) return { error: 'managed_at_new_fund' };
  return tx(db, () => {
    const date = today();
    const from = child.provider, fromAccount = child.partner_account_id;
    let accountId = fromAccount;
    if (child.account_status === 'active') accountId = partner.openAccount({ child: { ...child, provider } }).accountId;
    db.prepare('UPDATE children SET provider=?, partner_account_id=?, prev_provider=?, provider_changed_at=? WHERE id=?').run(provider, accountId, from, date, child.id);
    db.prepare('INSERT INTO audit_log (user_id, action, details) VALUES (?,?,?)').run(null, 'provider_transferred', JSON.stringify({ childId: child.id, from, to: provider, fromAccount, toAccount: accountId }));
    const g = db.prepare('SELECT email FROM users WHERE id=?').get(child.guardian_id);
    if (g) notifier.send({ to: g.email, subject: `הקופה של ${child.first_name} עוברת ל${providerName(provider)}`, body: child.account_status === 'active' ? `הכסף עובר מ${providerName(from)} כמו שהוא, באותו מסלול, בלי מס ובלי משיכה. מספר החשבון החדש: ${accountId}.` : 'בקשת הפתיחה תוגש לבית ההשקעות החדש.' });
    return { provider, providerName: providerName(provider), from, accountId, changedAt: date };
  });
}

/** 2026 yearly deposit ceiling per saver (by ID) for קופת גמל להשקעה, in agorot. */
export const ANNUAL_CEILING = 8364100;

/**
 * What the investment house needs to open a fund for a minor. Parents may create the
 * QR right away and complete these later; gifts wait (not invested) until the fund opens.
 *   upload: a scan or photo   form: filled in the app   sign: e-signed in the app
 */
export const DOCUMENTS = [
  { id: 'guardian_id', kind: 'upload' },          // ת"ז של ההורה כולל ספח
  { id: 'second_guardian_id', kind: 'upload' },   // ת"ז של ההורה השני
  { id: 'child_birth', kind: 'upload' },          // ספח עם פרטי הילד או תעודת לידה
  { id: 'bank_confirmation', kind: 'upload' },    // אישור ניהול חשבון, למשיכות ולהוראות קבע
  { id: 'kyc_form', kind: 'form' },               // שאלון הכרת לקוח
  { id: 'application_signed', kind: 'sign' },     // טופס הצטרפות חתום ע"י שני ההורים
];

/** Opened from 18: the fund is in the saver's own name, and only they sign. */
export const ADULT_DOCUMENTS = [
  { id: 'holder_id', kind: 'upload' },            // ת"ז של בעל/ת הקופה כולל ספח
  { id: 'bank_confirmation', kind: 'upload' },
  { id: 'kyc_form', kind: 'form' },
  { id: 'application_signed', kind: 'sign' },     // טופס הצטרפות חתום ע"י בעל/ת הקופה
];
export const documentsFor = (child) => (child.opened_as_adult ? ADULT_DOCUMENTS : DOCUMENTS);

export function docsStatus(db, child) {
  const rows = new Map(db.prepare('SELECT * FROM child_documents WHERE child_id=?').all(child.id).map((d) => [d.doc_type, d]));
  const items = documentsFor(child).map((d) => {
    const r = rows.get(d.id);
    return { id: d.id, kind: d.kind, status: r?.status || 'missing', fileName: r?.file_name || null, uploadedAt: r?.uploaded_at || null };
  });
  const missing = items.filter((i) => i.status === 'missing').map((i) => i.id);
  return { items, missing, done: items.length - missing.length, total: items.length, accountStatus: child.account_status, applicationRef: child.application_ref, adult: Boolean(child.opened_as_adult) };
}

/** Record one checklist item; when the last one lands, the application goes to the investment house. */
export function submitDocument({ db, notifier }, child, docId, body) {
  const d = documentsFor(child).find((x) => x.id === docId);
  if (!d) return null;
  let fileName = null, data = null;
  if (d.kind === 'upload') {
    fileName = String(body.fileName || '').trim().slice(0, 120);
    const size = Number(body.size || 0);
    if (!fileName || !/\.(pdf|jpe?g|png|heic)$/i.test(fileName)) return { error: 'invalid_file' };
    if (size > 10 * 1024 * 1024) return { error: 'file_too_large' };
  } else if (d.kind === 'form') {
    const f = body.answers || {};
    if (!f.occupation || !f.sourceOfFunds || f.pep === undefined) return { error: 'kyc_incomplete' };
    data = JSON.stringify({ occupation: String(f.occupation).slice(0, 80), sourceOfFunds: String(f.sourceOfFunds).slice(0, 80), pep: Boolean(f.pep), usPerson: Boolean(f.usPerson) });
  } else if (child.opened_as_adult) {
    if (!body.signerName || !body.agree) return { error: 'signature_required' };
    data = JSON.stringify({ signer: String(body.signerName).slice(0, 60) });
  } else if (!body.signerName || !body.secondSignerName || !body.agree) return { error: 'both_signatures_required' };
  else data = JSON.stringify({ signer: String(body.signerName).slice(0, 60), secondSigner: String(body.secondSignerName).slice(0, 60) });

  db.prepare(
    `INSERT INTO child_documents (child_id, doc_type, status, file_name, data, uploaded_at) VALUES (?,?,?,?,?,datetime('now'))
     ON CONFLICT(child_id, doc_type) DO UPDATE SET status=excluded.status, file_name=excluded.file_name, data=excluded.data, uploaded_at=excluded.uploaded_at`
  ).run(child.id, docId, 'received', fileName, data);

  const status = docsStatus(db, child);
  if (!status.missing.length && child.account_status === 'pending_docs') {
    db.prepare(`UPDATE children SET account_status='in_review' WHERE id=?`).run(child.id);
    const g = db.prepare('SELECT email FROM users WHERE id=?').get(child.guardian_id);
    notifier.send({ to: g.email, subject: `המסמכים של ${child.first_name} הועברו ל${providerName(child.provider)}`, body: 'נעדכן ברגע שהקופה תיפתח. המתנות שכבר התקבלו יושקעו מיד עם הפתיחה.' });
  }
  return docsStatus(db, db.prepare('SELECT * FROM children WHERE id=?').get(child.id));
}

/**
 * The investment house confirmed the fund: store the account number and invest every
 * gift that was waiting. In production this is the partner's webhook.
 */
export function activateFund({ db, partner, notifier }, child, date = today()) {
  return tx(db, () => {
    const { accountId } = partner.openAccount({ child });
    db.prepare(`UPDATE children SET account_status='active', partner_account_id=?, account_opened_at=? WHERE id=?`).run(accountId, date, child.id);
    db.prepare(`UPDATE child_documents SET status='verified' WHERE child_id=?`).run(child.id);
    const c = db.prepare('SELECT * FROM children WHERE id=?').get(child.id);
    const held = db.prepare(`SELECT * FROM contributions WHERE child_id=? AND status='paid'`).all(child.id);
    for (const x of held) investContribution(db, partner, c, x, date);
    const g = db.prepare('SELECT email FROM users WHERE id=?').get(child.guardian_id);
    notifier.send({ to: g.email, subject: `🎉 קופת הגמל של ${child.first_name} נפתחה`, body: `מספר חשבון ${accountId} ב${providerName(child.provider)}. ${held.length ? `${held.length} מתנות שחיכו הושקעו עכשיו.` : ''}` });
    return { accountId, invested: held.length };
  });
}

/** Remind parents what is still missing, at most every 3 days per child. */
export function remindMissingDocs({ db, notifier }, date = today()) {
  const kids = db
    .prepare(`SELECT * FROM children WHERE account_status='pending_docs' AND (docs_reminded_at IS NULL OR date(docs_reminded_at) <= date(?, '-3 days'))`)
    .all(date);
  for (const c of kids) {
    const n = docsStatus(db, c).missing.length;
    const g = db.prepare('SELECT email FROM users WHERE id=?').get(c.guardian_id);
    notifier.send({ to: g.email, subject: `נשארו ${n} מסמכים לפתיחת הקופה של ${c.first_name}`, body: 'הקוד כבר פעיל ומקבל מתנות. כדי שהן יושקעו, צריך להשלים את המסמכים באפליקציה.' });
    db.prepare('UPDATE children SET docs_reminded_at=? WHERE id=?').run(date, c.id);
  }
  return { reminded: kids.length };
}

/** Track switches: once per calendar quarter (the product's rule; the law allows more). */
export function nextSwitchDate(child) {
  if (!child.track_changed_at) return null;
  const d = new Date(child.track_changed_at.slice(0, 10) + 'T00:00:00Z');
  return new Date(Date.UTC(d.getUTCFullYear(), Math.floor(d.getUTCMonth() / 3) * 3 + 3, 1)).toISOString().slice(0, 10);
}

/** Gifts already deposited this calendar year, for the yearly ceiling. */
export function depositedThisYear(db, childId, date = today()) {
  return db
    .prepare(`SELECT COALESCE(SUM(amount),0) AS s FROM contributions WHERE child_id=? AND status IN ('paid','invested') AND substr(paid_at,1,4)=?`)
    .get(childId, date.slice(0, 4)).s;
}

export const newApplicationRef = () => 'APP-' + crypto.randomBytes(4).toString('hex').toUpperCase();

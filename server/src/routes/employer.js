import { Router } from 'express';
import { verifyPassword, issueEmployerToken } from '../lib/auth.js';
import { h, bad, notFound, requireString, requireDate, toAgorot, HttpError } from '../lib/http.js';
import { employerView, reportView, linkReports, linkByCode, sendGifts, OCCASIONS } from '../lib/employer.js';

/** Employer / workers' committee portal. */
const r = Router();

r.post('/login', h((req, res) => {
  const e = req.ctx.db.prepare('SELECT * FROM employers WHERE email=?').get(String(req.body.email || '').toLowerCase());
  if (!e || !verifyPassword(String(req.body.password || ''), e.password_hash)) throw new HttpError(401, 'bad_credentials');
  res.json({ token: issueEmployerToken(e), employer: employerView(e) });
}));

r.use((req, _res, next) => next(req.employer ? undefined : new HttpError(401, 'unauthorized')));

r.get('/me', h((req, res) => {
  const { db } = req.ctx;
  const e = req.employer;
  const one = (sql) => db.prepare(sql).get(e.id);
  res.json({
    employer: employerView(e),
    stats: {
      reports: one('SELECT COUNT(*) AS n FROM birth_reports WHERE employer_id=?').n,
      gifted: one(`SELECT COUNT(*) AS n FROM birth_reports WHERE employer_id=? AND status='gifted'`).n,
      awaiting: one(`SELECT COUNT(*) AS n FROM birth_reports WHERE employer_id=? AND status='linked'`).n,
      noQr: one(`SELECT COUNT(*) AS n FROM birth_reports WHERE employer_id=? AND status IN ('reported','invited')`).n,
      total: one(`SELECT COALESCE(SUM(x.amount),0) AS s FROM birth_reports b JOIN contributions x ON x.id=b.contribution_id WHERE b.employer_id=?`).s,
    },
  });
}));

r.get('/reports', h((req, res) => {
  const { db } = req.ctx;
  linkReports(db);
  res.json({ reports: db.prepare('SELECT * FROM birth_reports WHERE employer_id=? ORDER BY birth_date DESC, id DESC').all(req.employer.id).map((x) => reportView(db, x)) });
}));

function validReport(body) {
  return {
    employeeName: requireString(body.employeeName, 'employee_name', { max: 60 }),
    employeeEmail: body.employeeEmail ? requireString(body.employeeEmail, 'email', { max: 120 }).toLowerCase() : null,
    employeeNumber: body.employeeNumber ? String(body.employeeNumber).slice(0, 20) : null,
    babyName: body.babyName ? String(body.babyName).trim().slice(0, 40) : null,
    birthDate: requireDate(body.birthDate, 'birth_date'),
    occasion: OCCASIONS.includes(body.occasion) ? body.occasion : 'birth',
  };
}

function addReport(db, employer, body, by) {
  const v = validReport(body);
  const { lastInsertRowid } = db
    .prepare('INSERT INTO birth_reports (employer_id, employee_name, employee_email, employee_number, baby_name, birth_date, occasion, reported_by) VALUES (?,?,?,?,?,?,?,?)')
    .run(employer.id, v.employeeName, v.employeeEmail, v.employeeNumber, v.babyName, v.birthDate, v.occasion, by);
  const rep = db.prepare('SELECT * FROM birth_reports WHERE id=?').get(lastInsertRowid);
  if (body.giftCode) linkByCode(db, rep, body.giftCode);
  linkReports(db);
  return db.prepare('SELECT * FROM birth_reports WHERE id=?').get(lastInsertRowid);
}

r.post('/reports', h((req, res) => {
  const rep = addReport(req.ctx.db, req.employer, req.body, 'hr');
  res.status(201).json({ report: reportView(req.ctx.db, rep) });
}));

/** No QR yet: invite the employee to open one (the gift waits for them). */
r.post('/reports/:id/invite', h((req, res) => {
  const { db, notifier } = req.ctx;
  const rep = db.prepare('SELECT * FROM birth_reports WHERE id=? AND employer_id=?').get(Number(req.params.id), req.employer.id);
  if (!rep) throw notFound();
  if (!rep.employee_email) throw bad('no_employee_email');
  notifier.send({
    to: rep.employee_email,
    subject: `מזל טוב! ${req.employer.name} מחכה לשלוח מתנה ל־QR של התינוק/ת`,
    body: `פתחו קוד QR אישי ל${rep.baby_name || 'תינוק/ת'} באפליקציה, ומתנה של ₪${req.employer.gift_amount / 100} תיכנס לחיסכון שלו/ה.`,
  });
  db.prepare(`UPDATE birth_reports SET status=CASE WHEN status='reported' THEN 'invited' ELSE status END, invited_at=datetime('now') WHERE id=?`).run(rep.id);
  res.json({ report: reportView(db, db.prepare('SELECT * FROM birth_reports WHERE id=?').get(rep.id)) });
}));

r.post('/reports/:id/link', h((req, res) => {
  const { db } = req.ctx;
  const rep = db.prepare('SELECT * FROM birth_reports WHERE id=? AND employer_id=?').get(Number(req.params.id), req.employer.id);
  if (!rep) throw notFound();
  if (!linkByCode(db, rep, req.body.giftCode)) throw bad('gift_code_not_found');
  res.json({ report: reportView(db, db.prepare('SELECT * FROM birth_reports WHERE id=?').get(rep.id)) });
}));

r.post('/gifts', h((req, res) => {
  const ids = Array.isArray(req.body.reportIds) ? req.body.reportIds.slice(0, 500) : [];
  if (!ids.length) throw bad('no_reports');
  const amount = req.body.amount ? toAgorot(req.body.amount) : undefined;
  if (amount && (amount < 1800 || amount > 500000)) throw bad('amount_out_of_range');
  res.json(sendGifts(req.ctx, req.employer, ids, { amount, message: req.body.message ? String(req.body.message).slice(0, 300) : undefined }));
}));

r.patch('/settings', h((req, res) => {
  const { db } = req.ctx;
  const e = req.employer;
  const amount = req.body.giftAmount !== undefined ? toAgorot(req.body.giftAmount) : e.gift_amount;
  if (amount < 1800 || amount > 500000) throw bad('amount_out_of_range');
  const occasions = Array.isArray(req.body.occasions) ? req.body.occasions.filter((o) => OCCASIONS.includes(o)) : e.occasions.split(',');
  db.prepare('UPDATE employers SET gift_amount=?, gift_message=?, occasions=? WHERE id=?').run(
    amount, req.body.giftMessage !== undefined ? String(req.body.giftMessage).slice(0, 300) : e.gift_message, occasions.join(',') || 'birth', e.id
  );
  res.json({ employer: employerView(db.prepare('SELECT * FROM employers WHERE id=?').get(e.id)) });
}));

export default r;

/** Public page each organization shares with its employees to report a birth. */
export const workRoutes = Router();

workRoutes.get('/:slug', h((req, res) => {
  const e = req.ctx.db.prepare('SELECT * FROM employers WHERE slug=?').get(req.params.slug);
  if (!e) throw notFound();
  const { email, ...pub } = employerView(e);
  res.json({ employer: pub });
}));

workRoutes.post('/:slug/report', h((req, res) => {
  const { db } = req.ctx;
  const e = db.prepare('SELECT * FROM employers WHERE slug=?').get(req.params.slug);
  if (!e) throw notFound();
  if (!req.body.employeeEmail) throw bad('invalid_email');
  const rep = addReport(db, e, req.body, 'employee');
  res.status(201).json({ status: rep.status, linked: Boolean(rep.child_id) });
}));

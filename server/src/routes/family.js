import { Router } from 'express';
import { h, bad, notFound, requireString, requireDate } from '../lib/http.js';
import { requireUser, publicUser } from '../lib/guards.js';
import { COMMUNITIES, communityView } from '../lib/community.js';
import { registerPregnancy, pregnancyView } from '../lib/pregnancy.js';
import { listPartners } from '../lib/partners.js';
import { today, addDays } from '../lib/dates.js';

/** Family-level settings: the community the app adapts to, and expected babies. */
const r = Router();
r.use(requireUser);

r.get('/', h((req, res) => {
  const { db } = req.ctx;
  res.json({
    community: communityView(req.user.community),
    pregnancies: db.prepare('SELECT * FROM pregnancies WHERE user_id=? AND cancelled_at IS NULL ORDER BY due_date').all(req.user.id).map(pregnancyView),
    partners: listPartners(db),
  });
}));

r.patch('/', h((req, res) => {
  const { db } = req.ctx;
  if (!COMMUNITIES.includes(req.body.community)) throw bad('invalid_community');
  db.prepare('UPDATE users SET community=? WHERE id=?').run(req.body.community, req.user.id);
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id);
  res.json({ user: publicUser(user), community: communityView(user.community) });
}));

/** "We're expecting": reminders before and after the birth to open the baby's QR. */
r.post('/expecting', h((req, res) => {
  const { db } = req.ctx;
  const dueDate = requireDate(req.body.dueDate, 'due_date');
  if (dueDate < addDays(today(), -30) || dueDate > addDays(today(), 300)) throw bad('due_date_out_of_range');
  const partner = req.body.partnerId ? db.prepare(`SELECT id FROM partners WHERE id=? AND kind='health_fund'`).get(Number(req.body.partnerId)) : null;
  const g = registerPregnancy(db, { userId: req.user.id, name: req.user.name, phone: req.user.phone, email: req.user.email, dueDate, partnerId: partner?.id ?? null });
  res.status(201).json({ pregnancy: pregnancyView(g) });
}));

r.delete('/expecting/:id', h((req, res) => {
  const out = req.ctx.db.prepare(`UPDATE pregnancies SET cancelled_at=datetime('now') WHERE id=? AND user_id=?`).run(Number(req.params.id), req.user.id);
  if (!out.changes) throw notFound();
  res.json({ ok: true });
}));

export default r;

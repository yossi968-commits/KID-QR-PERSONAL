import { today } from './dates.js';
import { investContribution } from './portfolio.js';

/**
 * First-gift partners: besides the investment house, a health fund (when the baby joins it)
 * and a baby-formula brand (only with the parent's explicit consent) each put a welcome
 * deposit into a new QR. The names here are placeholders until agreements are signed;
 * the admin sets each partner's amount and turns it on or off.
 */
export const PARTNER_KINDS = ['health_fund', 'formula', 'other'];

export function listPartners(db, { activeOnly = true } = {}) {
  return db.prepare(`SELECT * FROM partners ${activeOnly ? 'WHERE active=1' : ''} ORDER BY kind, id`).all().map(partnerView);
}

export const partnerView = (p) => ({ id: p.id, slug: p.slug, kind: p.kind, name: p.name, nameEn: p.name_en, nameAr: p.name_ar, logo: p.logo, amount: p.welcome_amount, maxChildAge: p.max_child_age, active: Boolean(p.active) });

/**
 * Give the welcome gifts the parent chose: the health fund the child belongs to, and any
 * consented brand gifts. A brand gift is only given for a child young enough for it.
 */
export function addPartnerGifts(db, invest, child, { healthFund, consents = [] }, age) {
  const given = [];
  const give = (p) => {
    if (!p || !p.active) return;
    if (p.max_child_age != null && age > p.max_child_age) return;
    const { lastInsertRowid } = db
      .prepare(`INSERT INTO contributions (child_id, giver_name, amount, message, is_public, status, method, source, payment_ref, paid_at, partner_id) VALUES (?,?,?,?,1,'paid','partner','partner_gift',?,datetime('now'),?)`)
      .run(child.id, p.name, p.welcome_amount, p.message || `מתנה ראשונה ל${child.first_name} מ${p.name}`, `PARTNER-${p.slug}-${child.id}`, p.id);
    if (child.account_status === 'active') invest(db.prepare('SELECT * FROM contributions WHERE id=?').get(lastInsertRowid));
    given.push(p.slug);
  };
  if (healthFund) {
    const p = db.prepare(`SELECT * FROM partners WHERE id=? AND kind='health_fund'`).get(Number(healthFund));
    if (p) { db.prepare('UPDATE children SET health_fund_id=? WHERE id=?').run(p.id, child.id); give(p); }
  }
  for (const id of consents) {
    const p = db.prepare(`SELECT * FROM partners WHERE id=? AND kind<>'health_fund'`).get(Number(id));
    give(p);
  }
  return given;
}

export const investNow = (db, partner, child) => (x) => investContribution(db, partner, child, x, today());

export function partnerStats(db) {
  return db.prepare(`SELECT p.*, COUNT(x.id) AS gifts, COALESCE(SUM(x.amount),0) AS total,
                       (SELECT COUNT(*) FROM pregnancies g WHERE g.partner_id=p.id) AS referrals,
                       (SELECT COUNT(*) FROM pregnancies g WHERE g.partner_id=p.id AND g.child_id IS NOT NULL) AS converted
                     FROM partners p LEFT JOIN contributions x ON x.partner_id=p.id AND x.status IN ('paid','invested')
                     GROUP BY p.id ORDER BY p.kind, p.id`).all()
    .map((p) => ({ ...partnerView(p), gifts: p.gifts, total: p.total, referrals: p.referrals, converted: p.converted }));
}

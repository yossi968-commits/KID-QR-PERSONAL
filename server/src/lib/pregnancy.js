import { addDays, today } from './dates.js';

/**
 * Expecting parents sign up (directly, or from a health fund's link) and get reminders in
 * the last weeks of pregnancy and after the birth: "when the baby arrives, open a QR".
 * Reminders stop once a QR is opened for a baby born near the due date.
 */
export const STAGES = [
  { id: 'week30', offset: -70, text: (g, by) => `${by}: עוד כ־10 שבועות ללידה. כבר אפשר להכין את ה־QR האישי של התינוק/ת ב־QR livela, ואורחי הברית/הבריתה ייתנו מתנה שגדלה איתו/ה.` },
  { id: 'week36', offset: -28, text: (g, by) => `${by}: עוד חודש ללידה! בעזרת השם, אחרי הלידה אל תשכחו לפתוח QR אישי לתינוק/ת. זה לוקח 3 דקות.` },
  { id: 'birth', offset: 3, text: (g, by) => `${by}: מזל טוב! 🎉 זה הזמן לפתוח לתינוק/ת QR אישי, כדי שכל מתנה מהמשפחה ומהחברים תושקע לעתיד.` },
  { id: 'after', offset: 21, text: (g, by) => `${by}: עוד לא פתחתם QR לתינוק/ת? המתנות הראשונות מבית ההשקעות ומהשותפים מחכות.` },
];

export const pregnancyView = (g) => ({ id: g.id, name: g.name, dueDate: g.due_date, partnerId: g.partner_id, remindersSent: JSON.parse(g.reminders || '[]'), childId: g.child_id, createdAt: g.created_at });

export function registerPregnancy(db, { userId = null, name, phone, email = null, dueDate, partnerId = null }) {
  const { lastInsertRowid } = db
    .prepare('INSERT INTO pregnancies (user_id, name, phone, email, due_date, partner_id) VALUES (?,?,?,?,?,?)')
    .run(userId, name, phone, email, dueDate, partnerId);
  return db.prepare('SELECT * FROM pregnancies WHERE id=?').get(lastInsertRowid);
}

/** Send the reminders that are due today; each stage at most once. */
export function runPregnancyReminders({ db, notifier }, date = today()) {
  const open = db.prepare('SELECT g.*, p.name AS partner_name FROM pregnancies g LEFT JOIN partners p ON p.id=g.partner_id WHERE g.child_id IS NULL AND g.cancelled_at IS NULL').all();
  let sent = 0;
  for (const g of open) {
    const done = JSON.parse(g.reminders || '[]');
    // Only the latest stage that is due, so a late sign-up doesn't get a burst of messages.
    const due = STAGES.filter((s) => addDays(g.due_date, s.offset) <= date && !done.includes(s.id)).pop();
    if (!due || addDays(g.due_date, due.offset) < addDays(date, -14)) continue;
    const by = g.partner_name ? `${g.partner_name} ו־QR livela` : 'QR livela';
    if (g.phone) notifier.send({ channel: 'sms', to: g.phone, subject: 'QR livela', body: due.text(g, by) });
    if (g.email) notifier.send({ to: g.email, subject: 'QR livela: תזכורת לפתיחת QR לתינוק/ת', body: due.text(g, by) });
    const stagesDone = STAGES.filter((s) => addDays(g.due_date, s.offset) <= addDays(g.due_date, due.offset)).map((s) => s.id);
    db.prepare('UPDATE pregnancies SET reminders=? WHERE id=?').run(JSON.stringify([...new Set([...done, ...stagesDone])]), g.id);
    sent++;
  }
  return { sent };
}

/** A QR for a baby born within two months of a registered due date closes that sign-up. */
export function linkBirth(db, userId, child) {
  const g = db
    .prepare(`SELECT * FROM pregnancies WHERE user_id=? AND child_id IS NULL AND cancelled_at IS NULL AND abs(julianday(due_date) - julianday(?)) <= 60 ORDER BY abs(julianday(due_date) - julianday(?)) LIMIT 1`)
    .get(userId, child.birth_date, child.birth_date);
  if (g) db.prepare('UPDATE pregnancies SET child_id=? WHERE id=?').run(child.id, g.id);
  return g?.id || null;
}

import { nextSwitchDate, providerName } from './fund.js';
import { lifecycleView } from './lifecycle.js';
import { ageOn, nextBirthday, schoolGrade, stageOf } from './dates.js';
import { lessonsFor, gradeLesson, AGE_BANDS } from '../content/lessons.js';

export function childView(c) {
  return {
    id: c.id,
    firstName: c.first_name,
    lastName: c.last_name,
    birthDate: c.birth_date,
    age: ageOn(c.birth_date),
    grade: schoolGrade(c.birth_date),
    stage: stageOf(c.birth_date),
    nextBirthday: nextBirthday(c.birth_date),
    avatar: c.avatar,
    giftCode: c.gift_code,
    track: c.track,
    partnerAccountId: c.partner_account_id,
    goalText: c.goal_text,
    goalAmount: c.goal_amount,
    publicMessage: c.public_message,
    kidUsername: c.kid_username || null,
    provider: c.provider,
    providerName: providerName(c.provider),
    accountStatus: c.account_status || 'active',
    accountOpenedAt: c.account_opened_at || null,
    nextTrackSwitch: nextSwitchDate(c),
    lifecycle: lifecycleView(c),
  };
}

/** Paid gifts for a child; time-capsule messages stay sealed until the chosen age. */
export function giftsFor(db, c, { withEmail = false } = {}) {
  const age = ageOn(c.birth_date);
  return db
    .prepare(`SELECT c.*, e.title AS event_title FROM contributions c LEFT JOIN events e ON e.id=c.event_id
              WHERE c.child_id=? AND c.status IN ('paid','invested') ORDER BY c.paid_at DESC`)
    .all(c.id)
    .map((x) => ({
      id: x.id, giverName: x.giver_name, ...(withEmail && { giverEmail: x.giver_email }), amount: x.amount, status: x.status,
      source: x.source || 'gift', method: x.method, monthly: Boolean(x.pledge_id), eventTitle: x.event_title, paidAt: x.paid_at, thankedAt: x.thanked_at, unlockAge: x.unlock_age,
      sealed: x.unlock_age ? age < x.unlock_age : false,
      message: x.unlock_age && age < x.unlock_age ? null : x.message,
    }));
}

export function lessonsPayload(db, c, locale) {
  const done = new Map(db.prepare('SELECT lesson_id, score FROM lesson_progress WHERE child_id=?').all(c.id).map((p) => [p.lesson_id, p.score]));
  const age = ageOn(c.birth_date);
  const band = AGE_BANDS.find((b) => age >= b.from && age <= b.to)?.id || (age < 4 ? 'little' : 'young');
  const lessons = lessonsFor(locale).map((l) => ({ ...l, completed: done.has(l.id), starsEarned: done.get(l.id) || 0 }));
  return { band, bands: AGE_BANDS, lessons, totalStars: [...done.values()].reduce((a, b) => a + b, 0) };
}

export function completeLesson(db, c, lessonId, answers) {
  const g = gradeLesson(lessonId, answers);
  if (g?.passed) {
    db.prepare(`INSERT INTO lesson_progress (child_id, lesson_id, score) VALUES (?,?,?)
                ON CONFLICT(child_id, lesson_id) DO UPDATE SET score=excluded.score, completed_at=datetime('now')`).run(c.id, lessonId, g.stars);
  }
  return g;
}

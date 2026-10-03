/**
 * Demo data: one verified parent with two children whose birthday gifts have been
 * invested every year since birth (back-dated against sandbox prices), plus an admin.
 *   parent: demo@kfq.app / demo1234     admin: admin@kfq.app / admin1234
 */
import fs from 'node:fs';
import path from 'node:path';
import { openDb } from './db.js';
import { hashPassword } from './lib/auth.js';
import { SandboxInvestmentPartner } from './adapters/investment-partner.js';
import { investContribution } from './lib/portfolio.js';
import { addYears, today, nextBirthday, ageOn } from './lib/dates.js';

const file = process.env.DB_PATH || path.resolve('data/kfq.db');
if (file !== ':memory:') for (const f of [file, file + '-wal', file + '-shm']) fs.rmSync(f, { force: true });

export function seed(db, partner = new SandboxInvestmentPartner()) {
  const addUser = (email, pw, name, role, kyc) =>
    db.prepare('INSERT INTO users (email, password_hash, name, role, kyc_status, national_id) VALUES (?,?,?,?,?,?)').run(email, hashPassword(pw), name, role, kyc, kyc === 'verified' ? '000000018' : null).lastInsertRowid;

  addUser('admin@kfq.app', 'admin1234', 'מנהל מערכת', 'admin', 'none');
  const parent = addUser('demo@kfq.app', 'demo1234', 'מיכל לוי', 'parent', 'verified');

  const givers = [
    ['סבתא רחל', 'rachel@example.com', 'לנכדה/נכד האהוב, שתגדל/י בשמחה ❤️'],
    ['סבא משה', 'moshe@example.com', 'עד 120! מסבא'],
    ['דודה שירה', 'shira@example.com', 'מזל טוב! שתגשים/י את כל החלומות'],
    ['דוד אבי', null, 'יום הולדת שמח'],
    ['ההורים של יואב מהגן', null, 'מזל טוב מכל המשפחה'],
    ['נועם מהכיתה', null, 'יום הולדת שמח חבר/ה!'],
    ['סבתא אסתר', 'ester@example.com', 'בשבילך, לעתיד'],
    ['השכנים, משפחת כהן', null, 'מזל טוב!'],
  ];
  let s = 7;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);

  const kids = [
    { first: 'נועה', birth: '2019-05-12', avatar: '🦄', track: 'equity', goal: 'לימודים באוניברסיטה', goalAmount: 15000000, msg: 'נועה חוסכת לחלום הגדול שלה 🎓' },
    { first: 'איתי', birth: '2013-11-03', avatar: '🚀', track: 'sp500', goal: 'דירה ראשונה', goalAmount: 40000000, msg: 'איתי עולה לתורה בקרוב! במקום צ\'ק, מתנה שגדלה איתו 🚀' },
  ];

  for (const k of kids) {
    const code = k.first === 'נועה' ? 'noa2019demo' : 'itay2013demo';
    const childId = db
      .prepare(`INSERT INTO children (guardian_id, first_name, last_name, birth_date, avatar, gift_code, track, goal_text, goal_amount, public_message) VALUES (?,?,?,?,?,?,?,?,?,?)`)
      .run(parent, k.first, 'לוי', k.birth, k.avatar, code, k.track, k.goal, k.goalAmount, k.msg).lastInsertRowid;
    const child = db.prepare('SELECT * FROM children WHERE id=?').get(childId);
    child.partner_account_id = partner.openAccount({ child }).accountId;
    db.prepare('UPDATE children SET partner_account_id=? WHERE id=?').run(child.partner_account_id, childId);

    for (let age = 0; age <= ageOn(k.birth); age++) {
      const date = addYears(k.birth, age);
      if (date > today()) break;
      const ev = db.prepare('INSERT INTO events (child_id, type, title, date, active) VALUES (?,?,?,?,0)').run(childId, 'birthday', age === 0 ? 'לידה' : `יום הולדת ${age}`, date).lastInsertRowid;
      const n = 3 + Math.floor(rand() * 4);
      for (let i = 0; i < n; i++) {
        const [name, email, message] = givers[(age + i) % givers.length];
        const amount = [5200, 10000, 18000, 20000, 36000, 50000][Math.floor(rand() * 6)] * (age === 0 ? 2 : 1);
        const d = new Date(Date.parse(date) + Math.floor(rand() * 5) * 86400000).toISOString().slice(0, 10);
        if (d > today()) continue;
        const cid = db
          .prepare(`INSERT INTO contributions (child_id, event_id, giver_name, giver_email, amount, message, unlock_age, status, payment_ref, paid_at, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
          .run(childId, ev, name, email, amount, message, i === 0 && age % 4 === 2 ? 18 : null, 'paid', 'SEED-' + childId + '-' + age + '-' + i, d + ' 10:00:00', d + ' 09:58:00').lastInsertRowid;
        investContribution(db, partner, child, db.prepare('SELECT * FROM contributions WHERE id=?').get(cid), d);
      }
    }
    const nb = nextBirthday(k.birth);
    const turning = ageOn(k.birth) + 1;
    if (turning === 13) db.prepare('INSERT INTO events (child_id, type, title, date, goal_amount) VALUES (?,?,?,?,?)').run(childId, 'bar_mitzvah', 'בר מצווה לאיתי', nb, 3000000);
    else db.prepare('INSERT INTO events (child_id, type, title, date) VALUES (?,?,?,?)').run(childId, 'birthday', `יום הולדת ${turning}`, nb);
  }
  for (const [lid, stars] of [['what-is-money', 3], ['three-jars', 3]]) db.prepare('INSERT INTO lesson_progress (child_id, lesson_id, score) VALUES (1,?,?)').run(lid, stars);
  for (const [lid, stars] of [['needs-wants', 4], ['compound-interest', 5], ['what-is-a-share', 5]]) db.prepare('INSERT INTO lesson_progress (child_id, lesson_id, score) VALUES (2,?,?)').run(lid, stars);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const db = openDb(file);
  seed(db);
  console.log('Seeded', file, '\n  parent: demo@kfq.app / demo1234\n  admin:  admin@kfq.app / admin1234\n  gift pages: /g/noa2019demo  /g/itay2013demo');
}

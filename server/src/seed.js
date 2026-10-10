/**
 * Demo data: one verified parent with two children whose birthday gifts have been
 * invested every year since birth (back-dated against sandbox prices), plus an admin.
 *   parent: demo@kfq.app / demo1234     admin: admin@kfq.app / admin1234
 *   kids (username / PIN): noa, itay, omer / 1234
 *   employer HR: hr@alpha.example / demo1234
 *   newborn אלה: fund documents still missing; רוני (yael@example.com): waiting for the investment house
 */
import fs from 'node:fs';
import path from 'node:path';
import { openDb } from './db.js';
import { hashPassword } from './lib/auth.js';
import { SandboxInvestmentPartner } from './adapters/investment-partner.js';
import { investContribution } from './lib/portfolio.js';
import { SandboxPayments } from './adapters/payments.js';
import { runDuePledges, newPledgeToken } from './lib/pledges.js';
import { executeWithdrawal } from './lib/wishes.js';
import { DOCUMENTS, newApplicationRef } from './lib/fund.js';
import { linkReports, sendGifts } from './lib/employer.js';
import { addYears, today, nextBirthday, ageOn } from './lib/dates.js';


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
    { first: 'נועה', birth: '2019-05-12', avatar: '🦄', track: 'equity', provider: 'altshuler', goal: 'לימודים באוניברסיטה', goalAmount: 15000000, msg: 'נועה חוסכת לחלום הגדול שלה 🎓', code: 'noa2019demo', user: 'noa' },
    { first: 'עומר', birth: '2009-03-20', avatar: '⭐', track: 'conservative', provider: 'meitav', goal: 'תואר ראשון ורישיון נהיגה', goalAmount: 12000000, msg: 'עומר בכיתה י"ב ומתכנן את השנים שאחרי הצבא', code: 'omer2009demo', user: 'omer' },
    { first: 'איתי', birth: '2013-11-03', avatar: '🚀', track: 'equity', provider: 'altshuler', goal: 'דירה ראשונה', goalAmount: 40000000, msg: 'איתי עולה לתורה בקרוב! במקום צ\'ק, מתנה שגדלה איתו 🚀', code: 'itay2013demo', user: 'itay' },
  ];

  for (const k of kids) {
    const code = k.code;
    const childId = db
      .prepare(`INSERT INTO children (guardian_id, first_name, last_name, birth_date, avatar, gift_code, track, goal_text, goal_amount, public_message, provider, application_ref, account_opened_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(parent, k.first, 'לוי', k.birth, k.avatar, code, k.track, k.goal, k.goalAmount, k.msg, k.provider, newApplicationRef(), k.birth).lastInsertRowid;
    db.prepare('UPDATE children SET kid_username=?, kid_pin_hash=? WHERE id=?').run(k.user, hashPassword('1234'), childId);
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
  // Monthly gifts with half a year of history: grandma by card, grandpa by bank direct debit.
  const sixMonthsAgo = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 6, 10)).toISOString().slice(0, 10);
  const kidId = (u) => db.prepare('SELECT id FROM children WHERE kid_username=?').get(u).id;
  const addPledge = (user, name, email, amount, method, source = 'gift', message = 'כל חודש קצת, בשבילך') =>
    db.prepare(`INSERT INTO pledges (child_id, token, giver_name, giver_email, amount, method, message, status, card_token, institution_code, mandate_ref, next_date, source) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(kidId(user), newPledgeToken(), name, email, amount, method, message, 'active', method === 'card' ? 'tok_seed' : null, method === 'masav' ? '52741' : null, method === 'masav' ? '700001' : null, sixMonthsAgo, source);
  addPledge('noa', 'סבתא רחל', 'rachel@example.com', 10000, 'card');
  addPledge('itay', 'סבא משה', 'moshe@example.com', 15000, 'masav');
  addPledge('omer', 'דודה שירה', 'shira@example.com', 5000, 'card');
  // Omer's own money: part of his waiter's pay every month by bank direct debit.
  addPledge('omer', 'עומר', null, 40000, 'masav', 'waiting_tables', 'חלק מהמשכורת מהמסעדה');
  const ctx = { db, partner, payments: new SandboxPayments(), notifier: { send() {} } };
  while (runDuePledges(ctx).charged) {}

  // Itay's own earnings: babysitting and dog walking, paid straight to his QR.
  const itayRow = db.prepare("SELECT * FROM children WHERE kid_username='itay'").get();
  for (const [source, payer, amount, method, daysAgo] of [
    ['dog_walking', 'משפחת כהן', 8000, 'bit', 150], ['babysitting', 'משפחת אברהם', 12000, 'paybox', 110],
    ['pocket_money', 'איתי', 5000, 'bit', 80], ['dog_walking', 'משפחת כהן', 8000, 'bit', 45], ['babysitting', 'משפחת אברהם', 15000, 'paybox', 12],
  ]) {
    const d = new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);
    const cid = db
      .prepare(`INSERT INTO contributions (child_id, giver_name, amount, is_public, status, payment_ref, paid_at, created_at, method, source) VALUES (?,?,?,?,?,?,?,?,?,?)`)
      .run(itayRow.id, payer, amount, 0, 'paid', 'SEED-E-' + daysAgo, d + ' 18:00:00', d + ' 17:58:00', method, source).lastInsertRowid;
    investContribution(db, partner, itayRow, db.prepare('SELECT * FROM contributions WHERE id=?').get(cid), d);
  }

  // Planned gifts through the years, one past withdrawal and one request waiting for the parent.
  const wish = (user, title, icon, amount, date, by = 'parent', status = 'planned') =>
    db.prepare('INSERT INTO wishes (child_id, title, icon, target_amount, target_date, created_by, status) VALUES (?,?,?,?,?,?,?)').run(kidId(user), title, icon, amount, date, by, status).lastInsertRowid;
  wish('noa', 'אופניים', '🚲', 80000, '2027-05-12');
  wish('noa', 'אייפד', '📱', 220000, '2029-05-12');
  const itayBike = wish('itay', 'אופניים', '🚲', 60000, '2023-11-03', 'parent', 'done');
  wish('itay', 'טיסה לבר מצווה', '✈️', 600000, '2026-11-03', 'child');
  wish('itay', 'מחשב נייד', '💻', 400000, '2028-11-03', 'child');
  wish('omer', 'רישיון נהיגה', '🚗', 700000, '2027-03-20', 'child');
  const omerLaptop = wish('omer', 'מחשב לתואר', '💻', 500000, '2029-10-01', 'child');
  const itay = db.prepare("SELECT * FROM children WHERE kid_username='itay'").get();
  const wd = db.prepare(`INSERT INTO withdrawals (child_id, wish_id, amount, requested_by, created_at) VALUES (?,?,?,?,?)`).run(itay.id, itayBike, 60000, 'child', '2023-11-05 10:00:00').lastInsertRowid;
  executeWithdrawal(ctx, itay, db.prepare('SELECT * FROM withdrawals WHERE id=?').get(wd), { method: 'bit', destination: '050-1234567' }, '2023-11-05');
  db.prepare(`INSERT INTO withdrawals (child_id, wish_id, amount, requested_by, note, tax_estimate) VALUES (?,?,?,?,?,?)`).run(kidId('omer'), omerLaptop, 120000, 'child', 'מקדמה למחשב, אחסוך את השאר', 4200);

  // A newborn whose QR is already collecting gifts while the parent finishes the fund documents,
  // and another family's baby whose application waits for the investment house.
  const newborn = (guardian, first, birth, avatar, provider, code, docs, status) => {
    const id = db
      .prepare(`INSERT INTO children (guardian_id, first_name, last_name, birth_date, avatar, gift_code, track, provider, account_status, application_ref, public_message) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
      .run(guardian, first, guardian === parent ? 'לוי' : 'כהן', birth, avatar, code, 'equity', provider, status, newApplicationRef(), `${first} נולדה! במקום עוד בגד, מתנה שגדלה איתה 💕`).lastInsertRowid;
    for (const d of DOCUMENTS.slice(0, docs))
      db.prepare(`INSERT INTO child_documents (child_id, doc_type, status, file_name, uploaded_at) VALUES (?,?,?,?,?)`).run(id, d.id, 'received', d.kind === 'upload' ? `${d.id}.pdf` : null, birth + ' 20:00:00');
    const ev = db.prepare('INSERT INTO events (child_id, type, title, date) VALUES (?,?,?,?)').run(id, 'birthday', 'לידה', birth).lastInsertRowid;
    db.prepare('INSERT INTO events (child_id, type, title, date) VALUES (?,?,?,?)').run(id, 'birthday', 'יום הולדת 1', addYears(birth, 1));
    givers.slice(0, 4).forEach(([name, email, message], i) => {
      const d = new Date(Date.parse(birth) + (i + 2) * 86400000).toISOString().slice(0, 10);
      db.prepare(`INSERT INTO contributions (child_id, event_id, giver_name, giver_email, amount, message, status, payment_ref, paid_at, method) VALUES (?,?,?,?,?,?,?,?,?,?)`)
        .run(id, ev, name, email, [36000, 18000, 50000, 26000][i], message, 'paid', 'SEED-NB-' + id + '-' + i, d + ' 11:00:00', ['bit', 'card', 'bank_transfer', 'paybox'][i]);
    });
    return id;
  };
  const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
  newborn(parent, 'אלה', daysAgo(40), '🐣', 'altshuler', 'ella2026demo', 3, 'pending_docs');
  // Parents deposit part of the event gifts: Omer's bar mitzvah, Ella's naming ceremony.
  const omerRow = db.prepare("SELECT * FROM children WHERE kid_username='omer'").get();
  const bm = db.prepare('INSERT INTO events (child_id, type, title, date, active) VALUES (?,?,?,?,0)').run(omerRow.id, 'bar_mitzvah', 'בר המצווה של עומר', '2022-03-24').lastInsertRowid;
  const bmc = db.prepare(`INSERT INTO contributions (child_id, event_id, giver_name, giver_email, amount, message, is_public, status, payment_ref, paid_at, method, source) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(omerRow.id, bm, 'מיכל לוי', 'demo@kfq.app', 1200000, 'חצי ממתנות הבר מצווה', 0, 'paid', 'SEED-BM', '2022-03-28 10:00:00', 'bank_transfer', 'event_gifts').lastInsertRowid;
  investContribution(db, partner, omerRow, db.prepare('SELECT * FROM contributions WHERE id=?').get(bmc), '2022-03-28');
  const ella = db.prepare("SELECT * FROM children WHERE gift_code='ella2026demo'").get();
  const zb = db.prepare('INSERT INTO events (child_id, type, title, date, active) VALUES (?,?,?,?,0)').run(ella.id, 'brita', 'הבריתה של אלה', daysAgo(30)).lastInsertRowid;
  db.prepare(`INSERT INTO contributions (child_id, event_id, giver_name, giver_email, amount, message, is_public, status, payment_ref, paid_at, method, source) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(ella.id, zb, 'מיכל לוי', 'demo@kfq.app', 400000, 'מתנות מהבריתה', 0, 'paid', 'SEED-ZB', daysAgo(28) + ' 10:00:00', 'bank_transfer', 'event_gifts');
  const yael = addUser('yael@example.com', 'demo1234', 'יעל כהן', 'parent', 'verified');
  newborn(yael, 'רוני', daysAgo(12), '🐥', 'more', 'roni2026demo', DOCUMENTS.length, 'in_review');

  // An employer (fictional) that swapped its school-bag gift for a deposit into the newborn's QR.
  const emp = db
    .prepare(`INSERT INTO employers (slug, name, kind, email, password_hash, contact_name, logo, gift_amount, gift_message, occasions, occasion_amounts) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .run('alpha', 'אלפא טכנולוגיות', 'employer', 'hr@alpha.example', hashPassword('demo1234'), 'דנה רוזן, משאבי אנוש', '🏢', 50000, 'מזל טוב מכל המשפחה של אלפא! 💙', 'birth,bar_mitzvah,bat_mitzvah,enlistment',
      JSON.stringify({ birth: 50000, bar_mitzvah: 36000, bat_mitzvah: 36000, enlistment: 50000 }))
    .lastInsertRowid;
  db.prepare(`INSERT INTO employers (slug, name, kind, email, password_hash, contact_name, logo) VALUES (?,?,?,?,?,?,?)`)
    .run('beta-vaad', 'ועד עובדי בטא', 'committee', 'vaad@beta.example', hashPassword('demo1234'), 'יו"ר הוועד', '🤝');
  const report = (name, email, num, baby, birth, by, occasion = 'birth', eventDate = null) =>
    db.prepare('INSERT INTO birth_reports (employer_id, employee_name, employee_email, employee_number, baby_name, birth_date, reported_by, occasion, event_date) VALUES (?,?,?,?,?,?,?,?,?)').run(emp, name, email, num, baby, birth, by, occasion, eventDate).lastInsertRowid;
  const ellaReport = report('מיכל לוי', 'demo@kfq.app', '10234', 'אלה', ella.birth_date, 'employee');
  report('יעל כהן', 'yael@example.com', '10871', 'רוני', daysAgo(12), 'employee');
  report('דניאל אברהם', 'daniel@example.com', '11502', 'תמר', daysAgo(6), 'hr');
  report('נועם פרץ', 'noam@example.com', '12077', null, daysAgo(2), 'employee');
  // Same parent, other occasions: Itay's bar mitzvah next month, Omer's enlistment after school.
  report('מיכל לוי', 'demo@kfq.app', '10234', 'איתי', '2013-11-03', 'employee', 'bar_mitzvah', '2026-11-05');
  report('מיכל לוי', 'demo@kfq.app', '10234', 'עומר', '2009-03-20', 'hr', 'enlistment', '2027-08-01');
  linkReports(db);
  const empRow = db.prepare('SELECT * FROM employers WHERE id=?').get(emp);
  sendGifts({ db, partner, notifier: { send() {} } }, empRow, [ellaReport]);
  db.prepare(`UPDATE birth_reports SET status='invited', invited_at=? WHERE employee_name='דניאל אברהם'`).run(daysAgo(5) + ' 09:00:00');

  const progress = {
    noa: [['what-is-money', 3], ['three-jars', 3]],
    itay: [['needs-wants', 4], ['compound-interest', 5], ['what-is-a-share', 5]],
    omer: [['compound-interest', 5], ['what-is-a-share', 5], ['risk-return', 6], ['fees', 6], ['scams', 6]],
  };
  for (const [user, rows] of Object.entries(progress)) {
    const { id } = db.prepare('SELECT id FROM children WHERE kid_username=?').get(user);
    for (const [lid, stars] of rows) db.prepare('INSERT INTO lesson_progress (child_id, lesson_id, score) VALUES (?,?,?)').run(id, lid, stars);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.env.DB_PATH || path.resolve('data/kfq.db');
  if (file !== ':memory:') for (const f of [file, file + '-wal', file + '-shm']) fs.rmSync(f, { force: true });
  const db = openDb(file);
  seed(db);
  console.log('Seeded', file, '\n  parent: demo@kfq.app / demo1234\n  admin:  admin@kfq.app / admin1234\n  kids:   noa / itay / omer, PIN 1234\n  gift pages: /g/noa2019demo  /g/itay2013demo  /g/omer2009demo');
}

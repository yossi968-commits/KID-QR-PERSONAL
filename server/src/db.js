import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const SCHEMA = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'parent' CHECK (role IN ('parent','admin')),
  locale TEXT NOT NULL DEFAULT 'he',
  kyc_status TEXT NOT NULL DEFAULT 'none' CHECK (kyc_status IN ('none','pending','verified','rejected')),
  national_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS children (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guardian_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT,
  birth_date TEXT NOT NULL,
  avatar TEXT NOT NULL DEFAULT '🦁',
  gift_code TEXT NOT NULL UNIQUE,
  track TEXT NOT NULL DEFAULT 'equity',
  partner_account_id TEXT,
  goal_text TEXT,
  goal_amount INTEGER,
  public_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'birthday',
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  goal_amount INTEGER,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS contributions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,
  giver_name TEXT NOT NULL,
  giver_email TEXT,
  amount INTEGER NOT NULL CHECK (amount > 0),
  message TEXT,
  is_public INTEGER NOT NULL DEFAULT 1,
  unlock_age INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','invested','failed','cancelled')),
  checkout_id TEXT UNIQUE,
  payment_ref TEXT,
  thanked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  paid_at TEXT
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  contribution_id INTEGER REFERENCES contributions(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('buy','sell')),
  reason TEXT NOT NULL,
  track TEXT NOT NULL,
  amount INTEGER NOT NULL,
  units REAL NOT NULL,
  nav REAL NOT NULL,
  partner_order_id TEXT,
  date TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lesson_progress (
  child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  lesson_id TEXT NOT NULL,
  score INTEGER NOT NULL,
  completed_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (child_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel TEXT NOT NULL DEFAULT 'email',
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action TEXT NOT NULL,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_children_guardian ON children(guardian_id);
CREATE INDEX IF NOT EXISTS idx_contrib_child ON contributions(child_id);
CREATE INDEX IF NOT EXISTS idx_tx_child ON transactions(child_id);
`;

export function openDb(file = process.env.DB_PATH || path.resolve('data/kfq.db')) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(SCHEMA);
  return db;
}

/** Run fn inside a transaction; rolls back on throw. */
export function tx(db, fn) {
  db.exec('BEGIN');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

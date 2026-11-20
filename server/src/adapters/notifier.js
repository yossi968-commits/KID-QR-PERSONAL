/**
 * Notifier adapter: email / SMS / WhatsApp. The outbox implementation stores
 * every message in the database (visible in the admin console) instead of sending.
 */
export class OutboxNotifier {
  constructor(db) {
    this.db = db;
  }
  send({ channel = 'email', to, subject, body }) {
    if (!to) return;
    this.db.prepare('INSERT INTO outbox (channel, recipient, subject, body) VALUES (?,?,?,?)').run(channel, to, subject, body);
  }
}

import { openDb } from './db.js';
import { createApp } from './app.js';
import { SandboxInvestmentPartner } from './adapters/investment-partner.js';
import { SandboxPayments } from './adapters/payments.js';

import { OutboxNotifier } from './adapters/notifier.js';
import { runDuePledges } from './lib/pledges.js';
import { remindMissingDocs } from './lib/fund.js';

const db = openDb();
const ctx = { db, partner: new SandboxInvestmentPartner(), payments: new SandboxPayments(), notifier: new OutboxNotifier(db) };
const app = createApp(ctx);

// Monthly gifts: charge whatever is due at start-up and every six hours.
// Same loop reminds parents about missing fund documents.
const charge = () => { const r = runDuePledges(ctx); if (r.due) console.log('monthly gifts charged', r); remindMissingDocs(ctx); };
charge();
setInterval(charge, 6 * 60 * 60 * 1000).unref();
const port = Number(process.env.PORT) || 3000;
app.listen(port, () => console.log(`QR לעתיד API on http://localhost:${port}`));

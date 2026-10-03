import { openDb } from './db.js';
import { createApp } from './app.js';
import { SandboxInvestmentPartner } from './adapters/investment-partner.js';
import { SandboxPayments } from './adapters/payments.js';

const db = openDb();
const app = createApp({ db, partner: new SandboxInvestmentPartner(), payments: new SandboxPayments() });
const port = Number(process.env.PORT) || 3000;
app.listen(port, () => console.log(`QR לעתיד API on http://localhost:${port}`));

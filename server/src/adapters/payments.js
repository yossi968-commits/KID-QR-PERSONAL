/**
 * PaymentProvider adapter.
 *
 * Givers pay with the apps and rails Israelis already use. Money settles straight
 * into the child's account at the investment partner; the app never holds funds.
 *
 *   bit, paybox        one-time, hand-off to the app (via the processor's payment link)
 *   card               one-time or monthly (recurring charges on a stored card token)
 *   applepay/googlepay one-time
 *   bank_transfer      one-time transfer to the partner's trust account with a reference
 *   masav              monthly bank direct debit (הרשאה לחיוב חשבון) opened in the giver's bank app
 *
 * interface PaymentProvider {
 *   name: string
 *   methods: Method[]
 *   createCheckout({ amount, description, reference, method, recurring }): { checkoutId, redirectUrl }
 *   getCheckout(checkoutId): { checkoutId, amount, description, method, recurring, status, bank? }
 *   complete(checkoutId): { paymentRef, cardToken? }   // provider webhook equivalent
 *   cancel(checkoutId)
 *   chargeToken({ token, amount }): { paymentRef }      // recurring card charge
 *   createMandate({ reference }): { institutionCode, mandateRef }
 *   chargeMandate({ mandateRef, amount }): { paymentRef } // Masav debit
 *   payout({ method, destination, amount }): { payoutRef } // withdrawal to the guardian (bit/paybox/card/bank)
 * }
 *
 * SandboxPayments renders its own hosted pages inside the app (/pay/:id) and never moves money.
 */
import crypto from 'node:crypto';

export const METHODS = [
  { id: 'bit', kind: 'app', recurring: false },
  { id: 'paybox', kind: 'app', recurring: false },
  { id: 'card', kind: 'card', recurring: true },
  { id: 'applepay', kind: 'wallet', recurring: false },
  { id: 'googlepay', kind: 'wallet', recurring: false },
  { id: 'bank_transfer', kind: 'bank', recurring: false },
  { id: 'masav', kind: 'mandate', recurring: true, recurringOnly: true },
];

/** Where a withdrawal can be paid out (always to the guardian's own app, card or account). */
export const PAYOUT_METHODS = ['bit', 'paybox', 'card', 'bank'];

// Sandbox trust account at the investment partner, shown for bank transfers.
const TRUST_ACCOUNT = { bank: '31', bankName: 'הבינלאומי', branch: '012', account: '123456', beneficiary: 'בית ההשקעות (נאמנות QR לעתיד)' };
const SANDBOX_INSTITUTION_CODE = '52741';
const ref = (p, n = 5) => `${p}-${crypto.randomBytes(n).toString('hex').toUpperCase()}`;

export class SandboxPayments {
  constructor() {
    this.name = 'Sandbox Payments (mock)';
    this.methods = METHODS;
    this.checkouts = new Map();
  }

  createCheckout({ amount, description, reference, method = 'card', recurring = false, returnUrl }) {
    const m = METHODS.find((x) => x.id === method);
    if (!m) throw new Error('unknown_method');
    if (recurring && !m.recurring) throw new Error('method_not_recurring');
    const checkoutId = 'chk_' + crypto.randomBytes(8).toString('hex');
    const c = { checkoutId, amount, description, reference, returnUrl, method, recurring, status: 'open' };
    if (method === 'bank_transfer') c.bank = { ...TRUST_ACCOUNT, reference: String(100000 + Number(reference)) };
    this.checkouts.set(checkoutId, c);
    return { checkoutId, redirectUrl: `/pay/${checkoutId}` };
  }

  getCheckout(checkoutId) {
    const c = this.checkouts.get(checkoutId);
    if (!c) return null;
    const { reference, ...pub } = c;
    return pub;
  }

  complete(checkoutId) {
    const c = this.checkouts.get(checkoutId);
    if (!c || c.status !== 'open') throw new Error('checkout_not_open');
    c.status = 'paid';
    return {
      paymentRef: ref(c.method.toUpperCase()),
      reference: c.reference,
      ...(c.recurring && c.method === 'card' && { cardToken: 'tok_' + crypto.randomBytes(8).toString('hex') }),
    };
  }

  cancel(checkoutId) {
    const c = this.checkouts.get(checkoutId);
    if (c && c.status === 'open') c.status = 'cancelled';
    return c?.reference;
  }

  chargeToken({ token }) {
    if (!token?.startsWith('tok_')) throw new Error('invalid_token');
    return { paymentRef: ref('CARD-REC') };
  }

  createMandate({ reference }) {
    return { institutionCode: SANDBOX_INSTITUTION_CODE, mandateRef: String(700000 + Number(reference)) };
  }

  payout({ method, destination }) {
    if (!PAYOUT_METHODS.includes(method)) throw new Error('invalid_payout_method');
    if (!destination) throw new Error('no_destination');
    return { payoutRef: ref('OUT-' + method.toUpperCase()) };
  }

  chargeMandate({ mandateRef }) {
    if (!mandateRef) throw new Error('no_mandate');
    return { paymentRef: ref('MASAV') };
  }
}

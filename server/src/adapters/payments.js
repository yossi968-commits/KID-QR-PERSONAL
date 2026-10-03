/**
 * PaymentProvider adapter.
 *
 * Givers pay by card / Bit / Apple Pay through a licensed payment processor; funds
 * are settled directly into the child's account at the investment partner.
 *
 * interface PaymentProvider {
 *   name: string
 *   createCheckout({ amount, description, reference, returnUrl }): { checkoutId, redirectUrl }
 *   getCheckout(checkoutId): { checkoutId, amount, description, status }
 *   complete(checkoutId, method): { paymentRef }      // provider webhook equivalent
 *   cancel(checkoutId)
 * }
 *
 * SandboxPayments renders its own hosted-checkout page inside the app (/pay/:id)
 * and never moves real money. It is a mock.
 */
import crypto from 'node:crypto';

export class SandboxPayments {
  constructor() {
    this.name = 'Sandbox Payments (mock)';
    this.checkouts = new Map();
  }

  createCheckout({ amount, description, reference, returnUrl }) {
    const checkoutId = 'chk_' + crypto.randomBytes(8).toString('hex');
    this.checkouts.set(checkoutId, { checkoutId, amount, description, reference, returnUrl, status: 'open' });
    return { checkoutId, redirectUrl: `/pay/${checkoutId}` };
  }

  getCheckout(checkoutId) {
    const c = this.checkouts.get(checkoutId);
    if (!c) return null;
    const { reference, ...pub } = c;
    return pub;
  }

  complete(checkoutId, method = 'card') {
    const c = this.checkouts.get(checkoutId);
    if (!c || c.status !== 'open') throw new Error('checkout_not_open');
    c.status = 'paid';
    return { paymentRef: `${method.toUpperCase()}-${crypto.randomBytes(5).toString('hex')}`, reference: c.reference };
  }

  cancel(checkoutId) {
    const c = this.checkouts.get(checkoutId);
    if (c && c.status === 'open') c.status = 'cancelled';
    return c?.reference;
  }
}

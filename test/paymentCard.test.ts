import { describe, expect, it } from 'vitest';
import type { Payment, PaymentStatus } from '../src/payments/types.js';
import { refundHint, renderPaymentCard, shortId } from '../src/ui/paymentCard.js';

const base: Payment = {
  id: '3f2c0b8e-6d1a-4c55-9a43-0e1b2c3da91e', customerId: 'CUST-SECRET-42', amountFils: 12_500, currency: 'KWD',
  status: 'captured', idempotencyKey: 'IDEMP-SECRET-7', gatewayReference: 'K123456789',
  createdAt: '2026-11-23T08:41:02.118Z', updatedAt: '2026-11-23T08:42:10.004Z',
};
const now = new Date('2026-11-24T00:00:00Z');
const render = (p: Partial<Payment> = {}) => renderPaymentCard({ ...base, ...p }, { now });

describe('PaymentCard: amount (UX-AC-001, UX-AC-002)', () => {
  it('shows KWD to three decimals', () => expect(render()).toContain('12.500 KWD'));
  it('pads fils and handles under one dinar', () => {
    expect(render({ amountFils: 1_005 })).toContain('1.005 KWD');
    expect(render({ amountFils: 250 })).toContain('0.250 KWD');
  });
});

describe('PaymentCard: status variants (UX-AC-003)', () => {
  const cases: [PaymentStatus, string, string][] = [
    ['created', 'Awaiting payment', 'clock'], ['pending', 'Processing', 'spinner'], ['captured', 'Paid', 'check'],
    ['failed', 'Failed', 'cross'], ['refunded', 'Refunded', 'return'],
  ];
  it.each(cases)('%s → "%s" with %s icon', (status, text, icon) => {
    const html = render({ status });
    expect(html).toContain(`payment-card--${status}`);
    expect(html).toMatch(new RegExp(`payment-card__icon--${icon}" aria-hidden="true"></span>${text}</p>`));
  });
  it('explains pending and failed states', () => {
    expect(render({ status: 'pending' })).toContain('waiting for confirmation from KNET');
    expect(render({ status: 'failed' })).toContain('No money was taken.');
  });
});

describe('PaymentCard: refund hint (UX-AC-004, UX-AC-005)', () => {
  it('shows the refund deadline for an eligible captured payment', () => {
    expect(refundHint(base, now)).toEqual({ eligible: true, until: '2026-12-23T08:42:10.004Z', reason: null });
    expect(render()).toContain('Refundable until 23 Dec 2026');
  });
  it('shows the reason and no deadline after the window', () => {
    const html = renderPaymentCard(base, { now: new Date('2027-01-15T00:00:00Z') });
    expect(html).toContain('Refunds are allowed within 30 days of capture.');
    expect(html).not.toContain('Refundable until');
  });
  it('has no refund hint for non-captured payments', () => {
    for (const status of ['created', 'pending', 'failed', 'refunded'] as const) {
      expect(refundHint({ ...base, status }, now)).toBeNull();
      expect(render({ status })).not.toMatch(/Refundable|Refunds are/);
    }
  });
});

describe('PaymentCard: data exposure and safety (UX-AC-006)', () => {
  it('never renders the customer ID or idempotency key', () => {
    const html = render();
    expect(html).not.toContain('CUST-SECRET-42');
    expect(html).not.toContain('IDEMP-SECRET-7');
  });
  it('escapes values from the gateway', () => {
    const html = render({ gatewayReference: '<img src=x onerror=alert(1)>' });
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });
  it('shows a dash when there is no gateway reference yet', () => {
    expect(render({ gatewayReference: undefined, status: 'pending' })).toContain('<bdi dir="ltr">—</bdi>');
  });
});

describe('PaymentCard: accessibility and RTL (U-03)', () => {
  it('is a labelled article with a focusable heading and a polite live status', () => {
    const html = render();
    expect(html).toMatch(/<article [^>]*aria-labelledby="payment-card-[^"]+-heading"/);
    expect(html).toMatch(/<h2 [^>]*tabindex="-1"/);
    expect(html).toContain('role="status" aria-live="polite"');
  });
  it('gives the Copy button the full payment ID as its accessible name', () => {
    expect(render()).toContain(`aria-label="Copy payment ID ${base.id}"`);
    expect(shortId(base.id)).toBe('3f2c…a91e');
  });
  it('mirrors for RTL and keeps amount and reference LTR (UX-AC-010)', () => {
    const html = renderPaymentCard(base, { now, dir: 'rtl' });
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('<bdi dir="ltr">12.500 KWD</bdi>');
    expect(html).toContain('<bdi dir="ltr">K123456789</bdi>');
  });
  it('uses translated strings when given, falling back to English', () => {
    const html = renderPaymentCard(base, { now, strings: { 'paymentCard.heading': 'الدفع' } });
    expect(html).toContain('>الدفع</h2>');
    expect(html).toContain('Reference');
  });
});

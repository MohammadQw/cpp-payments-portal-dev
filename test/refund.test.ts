import { describe, expect, it } from 'vitest';
import { refundBlocker } from '../src/payments/refund.js';
import type { Payment } from '../src/payments/types.js';

const base: Payment = { id: 'p1', customerId: 'c1', amountFils: 1000, currency: 'KWD', status: 'captured',
  idempotencyKey: 'k', createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z' };

describe('refundBlocker', () => {
  it('allows a recent capture', () => expect(refundBlocker(base, new Date('2026-11-10T00:00:00Z'))).toBeNull());
  it('blocks after the window', () => expect(refundBlocker(base, new Date('2026-12-15T00:00:00Z'))).toMatch(/30 days/));
  it('blocks non-captured payments', () => expect(refundBlocker({ ...base, status: 'pending' })).toMatch(/captured/));
});

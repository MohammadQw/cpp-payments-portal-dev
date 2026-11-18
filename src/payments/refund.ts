import type { Payment } from './types.js';

export const REFUND_WINDOW_DAYS = 30;

/** Refunds (TASK-005): only captured payments, only within the window, never partial in v1. */
export function refundBlocker(p: Payment, now = new Date()): string | null {
  if (p.status !== 'captured') return `Only captured payments can be refunded (this one is ${p.status}).`;
  const ageDays = (now.getTime() - new Date(p.updatedAt).getTime()) / 86_400_000;
  if (ageDays > REFUND_WINDOW_DAYS) return `Refunds are allowed within ${REFUND_WINDOW_DAYS} days of capture.`;
  return null;
}

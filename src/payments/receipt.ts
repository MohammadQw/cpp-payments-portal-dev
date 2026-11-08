import type { Payment } from './types.js';

/** 12500 fils -> "12.500 KWD" — Kuwaiti dinar has three decimal places. */
export function formatKwd(fils: number): string {
  const sign = fils < 0 ? '-' : '';
  const abs = Math.abs(fils);
  return `${sign}${Math.floor(abs / 1000)}.${String(abs % 1000).padStart(3, '0')} KWD`;
}

export function receipt(p: Payment): string {
  return [`Receipt ${p.id}`, `Amount: ${formatKwd(p.amountFils)}`, `Status: ${p.status}`,
    `Reference: ${p.gatewayReference ?? '—'}`, `Date: ${p.updatedAt}`].join('\n');
}

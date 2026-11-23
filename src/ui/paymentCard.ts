import { formatKwd } from '../payments/receipt.js';
import { REFUND_WINDOW_DAYS, refundBlocker } from '../payments/refund.js';
import type { Payment, PaymentStatus } from '../payments/types.js';

/**
 * Payment card (TASK-009, UX-001 U-01): one payment rendered as an accessible HTML fragment.
 *
 * Pure function, no framework: the front-end stack is still an open question (UX-001 OQ-4), so
 * this renders server-side markup that any host page can embed. Every interpolated value is
 * HTML-escaped. The customer ID, idempotency key and any card data are never rendered (NFR-002).
 */

/** English source copy, keyed for translation (`paymentCard.*`, UX-001 §9). */
export const PAYMENT_CARD_STRINGS = {
  'paymentCard.heading': 'Payment',
  'paymentCard.amount': 'Amount',
  'paymentCard.reference': 'Reference',
  'paymentCard.date': 'Date',
  'paymentCard.paymentId': 'Payment ID',
  'paymentCard.copy': 'Copy',
  'paymentCard.copyLabel': 'Copy payment ID {id}',
  'paymentCard.status.created': 'Awaiting payment',
  'paymentCard.status.pending': 'Processing',
  'paymentCard.status.captured': 'Paid',
  'paymentCard.status.failed': 'Failed',
  'paymentCard.status.refunded': 'Refunded',
  'paymentCard.pendingNote': 'We’re waiting for confirmation from KNET.',
  'paymentCard.failedNote': 'No money was taken.',
  'paymentCard.refundUntil': 'Refundable until {date}',
} as const;

export type PaymentCardStringKey = keyof typeof PAYMENT_CARD_STRINGS;

/** Status icon names; the badge text carries the meaning, icons are decorative (UX-001 §6, §8). */
const STATUS_ICON: Record<PaymentStatus, string> = {
  created: 'clock',
  pending: 'spinner',
  captured: 'check',
  failed: 'cross',
  refunded: 'return',
};

export interface PaymentCardOptions {
  /** BCP 47 locale for dates. Supported locales are UX-001 OQ-2; English until decided. */
  locale?: string;
  /** IANA time zone for the displayed date. */
  timeZone?: string;
  /** Text direction of the host page; the card mirrors through logical CSS properties. */
  dir?: 'ltr' | 'rtl';
  /** Reference time for refund eligibility. */
  now?: Date;
  /** Translated strings; missing keys fall back to English. */
  strings?: Partial<Record<PaymentCardStringKey, string>>;
}

export interface RefundHint {
  eligible: boolean;
  /** ISO date until which a refund is possible, or null. */
  until: string | null;
  /** Why a captured payment can't be refunded, or null. */
  reason: string | null;
}

/** Refund hint for a payment, using the TASK-005 rules (FR-005). Only captured payments get one. */
export function refundHint(p: Payment, now = new Date()): RefundHint | null {
  if (p.status !== 'captured') return null;
  const blocker = refundBlocker(p, now);
  if (blocker) return { eligible: false, until: null, reason: blocker };
  const until = new Date(new Date(p.updatedAt).getTime() + REFUND_WINDOW_DAYS * 86_400_000);
  return { eligible: true, until: until.toISOString(), reason: null };
}

/** `3f2c0b8e-…-0e1b2c3da91e` → `3f2c…a91e`. */
export function shortId(id: string): string {
  return id.length <= 9 ? id : `${id.slice(0, 4)}…${id.slice(-4)}`;
}

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

function formatDate(iso: string, locale: string, timeZone: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(d);
}

function formatDay(iso: string, locale: string, timeZone: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone }).format(new Date(iso));
}

export function renderPaymentCard(p: Payment, options: PaymentCardOptions = {}): string {
  const { locale = 'en-GB', timeZone = 'Asia/Kuwait', dir = 'ltr', now = new Date() } = options;
  const t = (key: PaymentCardStringKey, vars: Record<string, string> = {}): string => {
    const template = options.strings?.[key] ?? PAYMENT_CARD_STRINGS[key];
    return escapeHtml(template).replace(/\{(\w+)\}/g, (_, name: string) => vars[name] ?? '');
  };

  const id = escapeHtml(p.id);
  const headingId = `payment-card-${id}-heading`;
  const status = t(`paymentCard.status.${p.status}`);
  const reference = p.gatewayReference ? escapeHtml(p.gatewayReference) : '—';

  const notes: string[] = [];
  if (p.status === 'pending') notes.push(t('paymentCard.pendingNote'));
  if (p.status === 'failed') notes.push(t('paymentCard.failedNote'));
  const hint = refundHint(p, now);
  if (hint?.eligible && hint.until) notes.push(t('paymentCard.refundUntil', { date: escapeHtml(formatDay(hint.until, locale, timeZone)) }));
  if (hint && !hint.eligible && hint.reason) notes.push(escapeHtml(hint.reason));

  return [
    `<article class="payment-card payment-card--${p.status}" dir="${dir}" aria-labelledby="${headingId}">`,
    `  <header class="payment-card__header">`,
    `    <h2 class="payment-card__heading" id="${headingId}" tabindex="-1">${t('paymentCard.heading')}</h2>`,
    `    <p class="payment-card__status" role="status" aria-live="polite">` +
      `<span class="payment-card__icon payment-card__icon--${STATUS_ICON[p.status]}" aria-hidden="true"></span>${status}</p>`,
    `  </header>`,
    `  <p class="payment-card__amount"><span class="visually-hidden">${t('paymentCard.amount')}: </span><bdi dir="ltr">${escapeHtml(formatKwd(p.amountFils))}</bdi></p>`,
    `  <dl class="payment-card__details">`,
    `    <dt>${t('paymentCard.reference')}</dt><dd><bdi dir="ltr">${reference}</bdi></dd>`,
    `    <dt>${t('paymentCard.date')}</dt><dd>${escapeHtml(formatDate(p.updatedAt, locale, timeZone))}</dd>`,
    `    <dt>${t('paymentCard.paymentId')}</dt><dd><bdi dir="ltr" title="${id}">${escapeHtml(shortId(p.id))}</bdi> ` +
      `<button type="button" class="payment-card__copy" data-copy="${id}" aria-label="${t('paymentCard.copyLabel', { id })}">${t('paymentCard.copy')}</button></dd>`,
    `  </dl>`,
    ...notes.map((n) => `  <p class="payment-card__note">${n}</p>`),
    `</article>`,
  ].join('\n');
}

/**
 * Card styles: logical properties only so the card mirrors in RTL (UX-001 §9). Colours are
 * placeholders until design tokens exist (UX-001 OQ-7).
 */
export const PAYMENT_CARD_CSS = `
.payment-card { --pc-surface:#fff; --pc-text:#1a1a1a; --pc-muted:#5c5c5c; --pc-border:#c8c8c8; --pc-focus:#0b57d0;
  --pc-success:#1e6b34; --pc-warning:#8a5a00; --pc-danger:#a4262c; --pc-info:#0b57d0;
  background:var(--pc-surface); color:var(--pc-text); border:1px solid var(--pc-border); border-radius:12px;
  padding-block:16px; padding-inline:16px; max-inline-size:32rem; }
.payment-card__header { display:flex; justify-content:space-between; align-items:center; gap:8px; }
.payment-card__heading { margin:0; font-size:1rem; }
.payment-card__heading:focus-visible, .payment-card__copy:focus-visible { outline:2px solid var(--pc-focus); outline-offset:2px; }
.payment-card__status { margin:0; display:inline-flex; align-items:center; gap:4px; padding-block:2px; padding-inline:8px;
  border:1px solid currentColor; border-radius:999px; font-size:.875rem; }
.payment-card--captured .payment-card__status { color:var(--pc-success); }
.payment-card--pending .payment-card__status, .payment-card--created .payment-card__status { color:var(--pc-warning); }
.payment-card--failed .payment-card__status { color:var(--pc-danger); }
.payment-card--refunded .payment-card__status { color:var(--pc-info); }
.payment-card__amount { font-size:1.75rem; font-weight:600; margin-block:12px; }
.payment-card__details { display:grid; grid-template-columns:max-content 1fr; gap:4px 16px; margin:0; }
.payment-card__details dt { color:var(--pc-muted); }
.payment-card__details dd { margin:0; }
.payment-card__copy { min-inline-size:24px; min-block-size:24px; margin-inline-start:8px; }
.payment-card__note { margin-block:12px 0; padding-block-start:12px; border-block-start:1px solid var(--pc-border); color:var(--pc-muted); }
.payment-card__icon--return { display:inline-block; }
[dir="rtl"] .payment-card__icon--return { transform:scaleX(-1); }
.visually-hidden { position:absolute; inline-size:1px; block-size:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; }
@media (max-width: 480px) { .payment-card__details { grid-template-columns:1fr; } .payment-card__details dd { margin-block-end:8px; } }
@media (prefers-reduced-motion: reduce) { .payment-card * { animation:none !important; transition:none !important; } }
`;

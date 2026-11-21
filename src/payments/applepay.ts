/**
 * Apple Pay via the acquiring bank (TASK-008, in progress).
 * Open question for Checkpoint A: merchant validation is done by the bank's endpoint, so the
 * portal never holds the Apple Pay merchant identity certificate — confirm with Security.
 */
export interface ApplePaySession {
  merchantSessionId: string;
  expiresAt: string;
}

export function isSessionExpired(s: ApplePaySession, now = new Date()): boolean {
  return new Date(s.expiresAt).getTime() <= now.getTime();
}

import { describe, expect, it } from 'vitest';
import { formatKwd } from '../src/payments/receipt.js';

describe('formatKwd', () => {
  it('uses three decimals', () => expect(formatKwd(12_500)).toBe('12.500 KWD'));
  it('pads fils', () => expect(formatKwd(1_005)).toBe('1.005 KWD'));
  it('handles under one dinar', () => expect(formatKwd(250)).toBe('0.250 KWD'));
});

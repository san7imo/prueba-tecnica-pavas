import { describe, expect, it } from 'vitest';

import { formatCurrency, multiplyDecimals } from '../src/utils/formatters.js';

describe('decimal presentation helpers', () => {
  it('multiplies decimal strings without JavaScript floating-point arithmetic', () => {
    expect(multiplyDecimals('2.00', '50000.00')).toBe('100000.0000');
    expect(multiplyDecimals('1.50', '0.10')).toBe('0.1500');
  });

  it('formats and rounds COP values using Colombian separators', () => {
    expect(formatCurrency('130000.00')).toBe('$\u00a0130.000,00');
    expect(formatCurrency('0.155')).toBe('$\u00a00,16');
  });
});

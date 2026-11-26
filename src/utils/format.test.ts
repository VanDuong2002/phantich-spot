import { describe, it, expect } from 'vitest';
import { formatPrice, formatPercent, formatDateTimeVi } from './format';

describe('formatPrice', () => {
  it('formats large coins with 2 decimals and thousands separators', () => {
    expect(formatPrice(97250.5)).toBe('97,250.50');
  });

  it('formats mid-price coins with up to 4 decimals', () => {
    expect(formatPrice(1.23456)).toBe('1.2346');
    expect(formatPrice(12.5)).toBe('12.50');
  });

  it('formats sub-dollar coins >= 0.01 with 4 decimals', () => {
    expect(formatPrice(0.05678)).toBe('0.0568');
  });

  it('preserves significant digits for micro-cap coins like PEPE', () => {
    expect(formatPrice(0.00001234)).toBe('0.00001234');
  });

  it('handles zero and non-finite inputs safely', () => {
    expect(formatPrice(0)).toBe('0');
    expect(formatPrice(Number.NaN)).toBe('—');
    expect(formatPrice(Number.POSITIVE_INFINITY)).toBe('—');
  });
});

describe('formatPercent', () => {
  it('formats signed and unsigned percentages', () => {
    expect(formatPercent(2.14, true)).toBe('+2.14%');
    expect(formatPercent(-3.4, true)).toBe('-3.40%');
    expect(formatPercent(64.5, false)).toBe('64.50%');
  });

  it('handles non-finite inputs safely', () => {
    expect(formatPercent(Number.NaN)).toBe('—');
  });
});

describe('formatDateTimeVi', () => {
  it('formats timestamp as HH:mm · dd/MM/yyyy in local timezone', () => {
    const ts = new Date(2026, 10, 26, 9, 5).getTime();
    expect(formatDateTimeVi(ts)).toBe('09:05 · 26/11/2026');
  });

  it('handles non-finite timestamps safely', () => {
    expect(formatDateTimeVi(Number.NaN)).toBe('—');
  });
});

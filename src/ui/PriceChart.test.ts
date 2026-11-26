import { describe, it, expect } from 'vitest';
import { getChartPriceFormat } from './PriceChart';

describe('getChartPriceFormat', () => {
  it('uses 8 decimals for micro-cap pairs like PEPEUSDT (< 0.0001)', () => {
    expect(getChartPriceFormat(0.00001234)).toEqual({
      type: 'price',
      precision: 8,
      minMove: 1e-8,
    });
  });

  it('uses 6 decimals for sub-cent pairs (< 0.01)', () => {
    expect(getChartPriceFormat(0.0045)).toEqual({
      type: 'price',
      precision: 6,
      minMove: 1e-6,
    });
  });

  it('uses 4 decimals for sub-dollar pairs like DOGEUSDT (< 1)', () => {
    expect(getChartPriceFormat(0.3521)).toEqual({
      type: 'price',
      precision: 4,
      minMove: 1e-4,
    });
  });

  it('uses 2 decimals for >= $1 pairs like BTCUSDT', () => {
    expect(getChartPriceFormat(97250.5)).toEqual({
      type: 'price',
      precision: 2,
      minMove: 0.01,
    });
  });

  it('falls back to 2 decimals for zero or non-finite values', () => {
    expect(getChartPriceFormat(0)).toEqual({
      type: 'price',
      precision: 2,
      minMove: 0.01,
    });
    expect(getChartPriceFormat(Number.NaN)).toEqual({
      type: 'price',
      precision: 2,
      minMove: 0.01,
    });
  });
});

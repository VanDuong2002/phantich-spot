import { describe, it, expect } from 'vitest';
import {
  calcEMASeries,
  calcRSISeries,
  calcMACDSeries,
  calcATRSeries,
  calcVolumeRatio,
  findSwingLevels,
  computeIndicatorSnapshot,
} from './indicators';
import type { Candle, IndicatorParams } from '../types/market';

const makeCandles = (closes: number[], volumes?: number[]): Candle[] =>
  closes.map((c, i) => ({
    openTime: i * 3600_000,
    closeTime: (i + 1) * 3600_000 - 1,
    open: c - 1,
    high: c + 2,
    low: c - 2,
    close: c,
    volume: volumes ? volumes[i] : 100 + i,
  }));

const DEFAULT_PARAMS: IndicatorParams = {
  emaFast: 21,
  emaMid: 50,
  emaSlow: 200,
  rsiPeriod: 14,
  rsiOversold: 30,
  rsiOverbought: 70,
  macdFast: 12,
  macdSlow: 26,
  macdSignal: 9,
  atrPeriod: 14,
  volumeSmaPeriod: 20,
};

describe('technical indicators', () => {
  it('returns null for EMA200 when candle history is shorter than 200 (newly listed coin)', () => {
    const closes = Array.from({ length: 60 }, (_, i) => 100 + i);
    const ema200 = calcEMASeries(closes, 200);
    expect(ema200.at(-1)).toBeNull();
    expect(ema200.every((v) => v === null)).toBe(true);
    expect(calcEMASeries(closes, 50).at(-1)).toBeGreaterThan(100);
  });

  it('initializes EMA with SMA of first period values and applies smoothing factor', () => {
    const values = [2, 4, 6, 8, 10];
    const ema3 = calcEMASeries(values, 3);
    // First two are null; index 2 is SMA(2,4,6) = 4
    expect(ema3[0]).toBeNull();
    expect(ema3[1]).toBeNull();
    expect(ema3[2]).toBeCloseTo(4, 8);
    // k = 2 / (3 + 1) = 0.5 -> index 3: 8 * 0.5 + 4 * 0.5 = 6; index 4: 10 * 0.5 + 6 * 0.5 = 8
    expect(ema3[3]).toBeCloseTo(6, 8);
    expect(ema3[4]).toBeCloseTo(8, 8);
  });

  it('computes RSI close to 100 on monotonic uptrend and close to 0 on downtrend', () => {
    const up = Array.from({ length: 30 }, (_, i) => 100 + i * 2);
    const down = Array.from({ length: 30 }, (_, i) => 200 - i * 2);
    expect(calcRSISeries(up, 14).at(-1)!).toBeGreaterThan(95);
    expect(calcRSISeries(down, 14).at(-1)!).toBeLessThan(5);
  });

  it('returns 50 for RSI when price is completely flat (avgGain === 0 && avgLoss === 0)', () => {
    const flat = Array.from({ length: 20 }, () => 100);
    const rsi = calcRSISeries(flat, 14);
    expect(rsi[13]).toBeNull();
    expect(rsi[14]).toBe(50);
    expect(rsi.at(-1)).toBe(50);
  });

  it('computes positive MACD histogram in sustained uptrend', () => {
    const closes = Array.from({ length: 50 }, (_, i) => 100 + i * i * 0.1);
    const macd = calcMACDSeries(closes, 12, 26, 9);
    expect(macd.macd.at(-1)!).toBeGreaterThan(0);
    expect(macd.histogram.at(-1)!).toBeGreaterThan(0);
    expect(macd.signal.at(-1)).not.toBeNull();
  });

  it('returns null MACD signal/histogram when history is shorter than slow + signal - 1', () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i);
    const macd = calcMACDSeries(closes, 12, 26, 9);
    expect(macd.macd.at(-1)).not.toBeNull();
    expect(macd.signal.at(-1)).toBeNull();
    expect(macd.histogram.at(-1)).toBeNull();
  });

  it('computes ATR and identifies swing support/resistance levels', () => {
    const wave = [100, 105, 110, 106, 102, 98, 103, 108, 115, 111, 107, 104, 109, 112, 110, 108, 105, 103, 106, 109];
    const candles = makeCandles(wave);
    expect(calcATRSeries(candles, 14).at(-1)!).toBeGreaterThan(0);
    const levels = findSwingLevels(candles, 2);
    expect(levels.supports.length).toBeGreaterThan(0);
    expect(levels.resistances.length).toBeGreaterThan(0);
    // Supports are below current price and sorted descending (nearest first)
    for (let i = 1; i < levels.supports.length; i++) {
      expect(levels.supports[i - 1]).toBeGreaterThanOrEqual(levels.supports[i]);
    }
    // Resistances are above current price and sorted ascending (nearest first)
    for (let i = 1; i < levels.resistances.length; i++) {
      expect(levels.resistances[i - 1]).toBeLessThanOrEqual(levels.resistances[i]);
    }
  });

  it('computes volume ratio and returns null when history is insufficient or average volume is 0', () => {
    const closes = Array.from({ length: 20 }, (_, i) => 100 + i);
    const vols = [...Array(19).fill(100), 200];
    const candles = makeCandles(closes, vols);
    const ratio = calcVolumeRatio(candles, 20);
    // Average = (19*100 + 200)/20 = 105; ratio = 200/105
    expect(ratio).toBeCloseTo(200 / 105, 6);

    expect(calcVolumeRatio(candles.slice(0, 10), 20)).toBeNull();

    const zeroVolCandles = makeCandles(closes, Array(20).fill(0));
    expect(calcVolumeRatio(zeroVolCandles, 20)).toBeNull();
  });

  it('computes complete IndicatorSnapshot and handles empty or short candle arrays without NaN', () => {
    const emptySnapshot = computeIndicatorSnapshot([], DEFAULT_PARAMS);
    expect(emptySnapshot).toEqual({
      price: 0,
      ema21: null,
      ema50: null,
      ema200: null,
      rsi: null,
      macd: null,
      macdSignal: null,
      macdHistogram: null,
      atr: null,
      volumeRatio: null,
    });

    const shortCandles = makeCandles(Array.from({ length: 60 }, (_, i) => 100 + i));
    const shortSnapshot = computeIndicatorSnapshot(shortCandles, DEFAULT_PARAMS);
    expect(shortSnapshot.price).toBe(159);
    expect(shortSnapshot.ema21).not.toBeNull();
    expect(shortSnapshot.ema50).not.toBeNull();
    expect(shortSnapshot.ema200).toBeNull();
    expect(shortSnapshot.rsi).not.toBeNull();
    expect(shortSnapshot.macd).not.toBeNull();
    expect(shortSnapshot.macdSignal).not.toBeNull();
    expect(shortSnapshot.macdHistogram).not.toBeNull();
    expect(shortSnapshot.atr).not.toBeNull();
    expect(shortSnapshot.volumeRatio).not.toBeNull();
    for (const val of Object.values(shortSnapshot)) {
      if (val !== null) {
        expect(Number.isNaN(val)).toBe(false);
        expect(Number.isFinite(val)).toBe(true);
      }
    }
  });
});

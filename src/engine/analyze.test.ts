import { describe, it, expect } from 'vitest';
import { analyzeCoin } from './analyze';
import { scoreTimeframe } from './scorer';
import { buildTradePlanAndLevels } from './tradePlan';
import { generateNarrative } from './narrative';
import { BUILT_IN_MODES } from '../settings/presets';
import type { AnalysisMode, Candle, MultiTimeframeData } from '../types/market';

const balanced = BUILT_IN_MODES.find((m) => m.id === 'balanced')!;

const trendCandles = (start: number, step: number, count: number): Candle[] =>
  Array.from({ length: count }, (_, i) => {
    const close = Math.max(1, start + i * step);
    return {
      openTime: i * 3600_000,
      closeTime: (i + 1) * 3600_000 - 1,
      open: close - step * 0.5,
      high: close * 1.015,
      low: close * 0.985,
      close,
      volume: i === count - 1 ? 300 : 120,
    };
  });

const sidewaysCandles = (base: number, amplitude: number, count: number): Candle[] =>
  Array.from({ length: count }, (_, i) => {
    const wave = Math.sin(i * 0.4) * amplitude;
    const close = Math.max(1, base + wave);
    return {
      openTime: i * 3600_000,
      closeTime: (i + 1) * 3600_000 - 1,
      open: close - Math.cos(i * 0.4) * amplitude * 0.2,
      high: close * 1.01,
      low: close * 0.99,
      close,
      volume: 120,
    };
  });

const makeData = (
  c1w: Candle[],
  c1d: Candle[],
  c4h: Candle[],
  c1h: Candle[]
): MultiTimeframeData => ({
  symbol: 'BTCUSDT',
  ticker: {
    symbol: 'BTCUSDT',
    lastPrice: c1h.at(-1)!.close,
    priceChangePercent: 2.1,
    highPrice: c1h.at(-1)!.high,
    lowPrice: c1h.at(-1)!.low,
    quoteVolume: 1_000_000_000,
  },
  candles: { '1w': c1w, '1d': c1d, '4h': c4h, '1h': c1h },
  fetchedAt: Date.now(),
});

describe('analyzeCoin', () => {
  it('returns MUA with valid tradePlan when all 4 timeframes align bullish', () => {
    const data = makeData(
      trendCandles(20000, 300, 220),
      trendCandles(50000, 200, 240),
      trendCandles(80000, 80, 240),
      trendCandles(94000, 25, 240)
    );
    const report = analyzeCoin(data, balanced);
    expect(report.verdict).toBe('MUA');
    expect(report.score).toBeGreaterThanOrEqual(balanced.buyThreshold);
    expect(report.tradePlan).not.toBeNull();
    expect(report.tradePlan!.stopLoss).toBeLessThan(report.tradePlan!.entryLow);
    expect(report.tradePlan!.tp1).toBeGreaterThan(report.tradePlan!.entryHigh);
    expect(report.tradePlan!.tp2).toBeGreaterThan(report.tradePlan!.tp1);
    expect(report.tradePlan!.riskReward).toBeGreaterThanOrEqual(balanced.minRiskReward);
    expect(report.headline.length).toBeGreaterThan(10);
    expect(report.summary.length).toBeGreaterThan(20);
    expect(report.reasons.length).toBeGreaterThan(0);
  });

  it('downgrades MUA to DUNG_NGOAI with warning when 1D is bearish (anti-false-signal)', () => {
    const data = makeData(
      trendCandles(120000, -250, 220),
      trendCandles(120000, -250, 240),
      trendCandles(50000, 100, 240),
      trendCandles(65000, 40, 240)
    );
    const report = analyzeCoin(data, balanced);
    expect(report.verdict).not.toBe('MUA');
    expect(report.tradePlan).toBeNull();
    expect(report.referenceLevels.nearestSupport).toBeGreaterThan(0);

    // Even when overall weighted score exceeds buyThreshold, bearish 1D must downgrade MUA -> DUNG_NGOAI with warning
    const lowerTfHeavyMode: AnalysisMode = {
      ...balanced,
      timeframeWeights: { '1w': 5, '1d': 10, '4h': 45, '1h': 40 },
      buyThreshold: 60,
      requireHigherTfNotBearish: true,
    };
    const dataCounterTrend = makeData(
      trendCandles(20000, 300, 220),
      trendCandles(120000, -250, 240),
      trendCandles(80000, 80, 240),
      trendCandles(94000, 25, 240)
    );
    const downgraded = analyzeCoin(dataCounterTrend, lowerTfHeavyMode);
    expect(downgraded.score).toBeGreaterThanOrEqual(lowerTfHeavyMode.buyThreshold);
    expect(downgraded.verdict).toBe('DUNG_NGOAI');
    expect(downgraded.tradePlan).toBeNull();
    expect(downgraded.warnings.some((w) => w.includes('1D'))).toBe(true);
  });

  it('downgrades MUA to DUNG_NGOAI with 1W warning when 1W is strongly bearish while 1D/4H/1H are bullish', () => {
    const modeWith1WGuard: AnalysisMode = {
      ...balanced,
      timeframeWeights: { '1w': 10, '1d': 30, '4h': 35, '1h': 25 },
      buyThreshold: 60,
      requireHigherTfNotBearish: true,
    };
    const dataBearish1W = makeData(
      trendCandles(120000, -250, 220),
      trendCandles(50000, 200, 240),
      trendCandles(80000, 80, 240),
      trendCandles(94000, 25, 240)
    );
    const report = analyzeCoin(dataBearish1W, modeWith1WGuard);
    expect(report.timeframes['1w'].score).toBeLessThan(-15);
    expect(report.timeframes['1d'].score).toBeGreaterThan(15);
    expect(report.score).toBeGreaterThanOrEqual(modeWith1WGuard.buyThreshold);
    expect(report.verdict).toBe('DUNG_NGOAI');
    expect(report.tradePlan).toBeNull();
    expect(report.headline).toContain('1W');
    expect(report.summary).toContain('1W');
    expect(report.warnings.some((w) => w.includes('1W'))).toBe(true);
  });

  it('cites both 1D và 1W when both higher timeframes trigger the bearish downgrade', () => {
    const lowerTfHeavyMode: AnalysisMode = {
      ...balanced,
      timeframeWeights: { '1w': 5, '1d': 5, '4h': 50, '1h': 40 },
      buyThreshold: 60,
      requireHigherTfNotBearish: true,
    };
    const dataBearishBoth = makeData(
      trendCandles(120000, -250, 220),
      trendCandles(120000, -250, 240),
      trendCandles(80000, 80, 240),
      trendCandles(94000, 25, 240)
    );
    const report = analyzeCoin(dataBearishBoth, lowerTfHeavyMode);
    expect(report.timeframes['1w'].score).toBeLessThan(-15);
    expect(report.timeframes['1d'].score).toBeLessThan(-15);
    expect(report.score).toBeGreaterThanOrEqual(lowerTfHeavyMode.buyThreshold);
    expect(report.verdict).toBe('DUNG_NGOAI');
    expect(report.tradePlan).toBeNull();
    expect(report.headline).toContain('1D và 1W');
    expect(report.summary).toContain('1D và 1W');
    expect(report.warnings.some((w) => w.includes('1D và 1W'))).toBe(true);
  });

  it('downgrades MUA to DUNG_NGOAI with warning when riskReward is below minRiskReward', () => {
    const strictRrMode: AnalysisMode = {
      ...balanced,
      minRiskReward: 5.0,
    };
    const data = makeData(
      trendCandles(20000, 300, 220),
      trendCandles(50000, 200, 240),
      trendCandles(80000, 80, 240),
      trendCandles(94000, 25, 240)
    );
    const report = analyzeCoin(data, strictRrMode);
    expect(report.score).toBeGreaterThanOrEqual(strictRrMode.buyThreshold);
    expect(report.verdict).toBe('DUNG_NGOAI');
    expect(report.tradePlan).toBeNull();
    expect(report.referenceLevels.nearestSupport).toBeGreaterThan(0);
    expect(report.warnings.some((w) => w.includes('R:R'))).toBe(true);
  });

  it('returns BAN with null tradePlan when all timeframes are strongly bearish', () => {
    const data = makeData(
      trendCandles(120000, -300, 220),
      trendCandles(110000, -250, 240),
      trendCandles(90000, -150, 240),
      trendCandles(60000, -50, 240)
    );
    const report = analyzeCoin(data, balanced);
    expect(report.verdict).toBe('BAN');
    expect(report.tradePlan).toBeNull();
    expect(report.referenceLevels.nearestSupport).toBeGreaterThan(0);
    expect(report.referenceLevels.nearestResistance).toBeGreaterThan(0);
  });

  it('returns GIU with null tradePlan when score is moderately bullish and 1D is not bearish', () => {
    const data = makeData(
      sidewaysCandles(60000, 500, 220),
      sidewaysCandles(60000, 400, 240),
      sidewaysCandles(60000, 300, 240),
      sidewaysCandles(60000, 200, 240)
    );
    const moderateMode: AnalysisMode = {
      ...balanced,
      buyThreshold: 80,
      sellThreshold: 30,
    };
    const report = analyzeCoin(data, moderateMode);
    expect(report.verdict).toBe('GIU');
    expect(report.tradePlan).toBeNull();
    expect(report.referenceLevels.nearestSupport).toBeGreaterThan(0);
  });

  it('handles newly listed coin with short 1W history without NaN and adds note', () => {
    const data = makeData(
      trendCandles(1, 0.05, 40),
      trendCandles(1, 0.01, 220),
      trendCandles(2, 0.005, 220),
      trendCandles(3, 0.002, 220)
    );
    const report = analyzeCoin(data, balanced);
    expect(Number.isFinite(report.score)).toBe(true);
    expect(report.timeframes['1w'].snapshot.ema200).toBeNull();
    expect(report.warnings.some((w) => w.includes('EMA200'))).toBe(true);
  });
});

describe('engine module exports', () => {
  it('scoreTimeframe returns score in [-100, 100] and valid trend', () => {
    const tf = scoreTimeframe(trendCandles(50000, 200, 240), '1d', balanced);
    expect(tf.timeframe).toBe('1d');
    expect(tf.score).toBeGreaterThanOrEqual(-100);
    expect(tf.score).toBeLessThanOrEqual(100);
    expect(tf.trend).toBe('UP');
  });

  it('buildTradePlanAndLevels returns consistent entry, SL, TP1, TP2 and referenceLevels', () => {
    const c4h = trendCandles(80000, 80, 240);
    const c1d = trendCandles(50000, 200, 240);
    const currentPrice = c4h.at(-1)!.close;
    const { tradePlan, referenceLevels } = buildTradePlanAndLevels(c4h, c1d, currentPrice, balanced);
    expect(tradePlan.entryLow).toBeLessThanOrEqual(tradePlan.entryHigh);
    expect(tradePlan.stopLoss).toBeLessThan(tradePlan.entryLow);
    expect(tradePlan.tp1).toBeGreaterThan(tradePlan.entryHigh);
    expect(tradePlan.tp2).toBeGreaterThan(tradePlan.tp1);
    expect(tradePlan.riskReward).toBeGreaterThan(0);
    expect(referenceLevels.nearestSupport).toBeLessThan(currentPrice);
    expect(referenceLevels.nearestResistance).toBeGreaterThan(currentPrice);
    expect(referenceLevels.invalidationLevel).toBeLessThanOrEqual(referenceLevels.nearestSupport);
  });

  it('generateNarrative returns non-empty Vietnamese editorial fields', () => {
    const data = makeData(
      trendCandles(20000, 300, 220),
      trendCandles(50000, 200, 240),
      trendCandles(80000, 80, 240),
      trendCandles(94000, 25, 240)
    );
    const report = analyzeCoin(data, balanced);
    const { headline, summary, reasons, warnings, ...base } = report;
    const narrative = generateNarrative(base);
    expect(narrative.headline).toBe(headline);
    expect(narrative.summary).toBe(summary);
    expect(narrative.reasons.length).toBeGreaterThan(0);
    expect(Array.isArray(narrative.warnings)).toBe(true);
  });
});

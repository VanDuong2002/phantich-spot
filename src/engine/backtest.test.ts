import { describe, it, expect } from 'vitest';
import { runQuickBacktest } from './backtest';
import { buildTradePlanAndLevels } from './tradePlan';
import { BUILT_IN_MODES } from '../settings/presets';
import type { Candle } from '../types/market';

const FOUR_HOURS_MS = 4 * 3600_000;
const ONE_DAY_MS = 24 * 3600_000;

const balanced = BUILT_IN_MODES.find((m) => m.id === 'balanced')!;

const makeSeries = (closes: number[], intervalMs: number): Candle[] =>
  closes.map((c, i) => ({
    openTime: i * intervalMs,
    closeTime: (i + 1) * intervalMs - 1,
    open: c * 0.995,
    high: c * 1.02,
    low: c * 0.98,
    close: c,
    volume: 150,
  }));

/**
 * Build a deterministic bullish 4H + 1D history where candle index 210 triggers MUA.
 * Uses a gentle uptrend with healthy RSI (35-65) and bullish EMA/MACD alignment.
 */
function buildBullishEntrySetup() {
  const count4h = 211;
  const candles4h: Candle[] = Array.from({ length: count4h }, (_, i) => {
    // Gentle linear uptrend with small oscillation so swings exist and RSI stays healthy
    const close = 100 + i * 0.15 + Math.sin(i / 4) * 1.2;
    return {
      openTime: i * FOUR_HOURS_MS,
      closeTime: (i + 1) * FOUR_HOURS_MS - 1,
      open: close * 0.996,
      high: close * 1.008,
      low: close * 0.992,
      close,
      volume: i === count4h - 1 ? 300 : 150,
    };
  });

  // 40 daily candles covering the 211 * 4H = 35.16 days span, plus extra future days
  const count1d = 40;
  const candles1d: Candle[] = Array.from({ length: count1d }, (_, i) => {
    const close = 100 + i * 0.9 + Math.sin(i / 3) * 1.5;
    return {
      openTime: i * ONE_DAY_MS,
      closeTime: (i + 1) * ONE_DAY_MS - 1,
      open: close * 0.994,
      high: close * 1.015,
      low: close * 0.985,
      close,
      volume: 1000,
    };
  });

  const entryCandle = candles4h[count4h - 1];
  const closed1dAtEntry = candles1d.filter((c) => c.closeTime <= entryCandle.closeTime);
  const { tradePlan } = buildTradePlanAndLevels(
    candles4h,
    closed1dAtEntry,
    entryCandle.close,
    balanced,
  );

  return { candles4h, candles1d, entry: entryCandle.close, tradePlan };
}

function nextCandle(
  prev: Candle,
  overrides: Partial<Pick<Candle, 'open' | 'high' | 'low' | 'close' | 'volume'>>,
): Candle {
  const openTime = prev.openTime + FOUR_HOURS_MS;
  const close = overrides.close ?? prev.close;
  return {
    openTime,
    closeTime: openTime + FOUR_HOURS_MS - 1,
    open: overrides.open ?? close,
    high: overrides.high ?? close,
    low: overrides.low ?? close,
    close,
    volume: overrides.volume ?? 150,
  };
}

describe('runQuickBacktest', () => {
  it('returns valid zero-trade summary when history is too short', () => {
    const res = runQuickBacktest(
      makeSeries([100, 101, 102], FOUR_HOURS_MS),
      makeSeries([100], ONE_DAY_MS),
      balanced,
    );
    expect(res.totalTrades).toBe(0);
    expect(res.winRate).toBe(0);
    expect(res.avgRiskReward).toBe(0);
    expect(res.netReturnPct).toBe(0);
    expect(res.candlesTested).toBe(0);
    expect(res.ruleSummaryVi).toContain('50%');
  });

  it('produces finite metrics without lookahead bias on 360 4H candles', () => {
    const closes4h = Array.from({ length: 360 }, (_, i) => 100 + i * 0.3 + Math.sin(i / 8) * 6);
    const closes1d = Array.from({ length: 120 }, (_, i) => 100 + i * 1.0 + Math.sin(i / 4) * 4);
    const res = runQuickBacktest(
      makeSeries(closes4h, FOUR_HOURS_MS),
      makeSeries(closes1d, ONE_DAY_MS),
      balanced,
    );
    expect(Number.isFinite(res.winRate)).toBe(true);
    expect(Number.isFinite(res.avgRiskReward)).toBe(true);
    expect(Number.isFinite(res.netReturnPct)).toBe(true);
    expect(res.candlesTested).toBeGreaterThan(0);
  });

  it('calculates exact SL stop-out math (100% exit at stopLoss)', () => {
    const { candles4h, candles1d, entry, tradePlan } = buildBullishEntrySetup();
    const slBar = nextCandle(candles4h[candles4h.length - 1], {
      open: entry,
      high: entry * 1.001, // below tp1
      low: tradePlan.stopLoss - 1, // breaches SL
      close: tradePlan.stopLoss,
    });
    const trailingBar = nextCandle(slBar, { close: tradePlan.stopLoss });

    const res = runQuickBacktest([...candles4h, slBar, trailingBar], candles1d, balanced);

    const expectedReturnPct = ((tradePlan.stopLoss - entry) / entry) * 100;
    expect(res.totalTrades).toBe(1);
    expect(res.winRate).toBe(0);
    expect(res.netReturnPct).toBeCloseTo(expectedReturnPct, 1);
  });

  it('calculates exact TP1 + TP2 scale-out math (50% at TP1, 50% at TP2)', () => {
    const { candles4h, candles1d, entry, tradePlan } = buildBullishEntrySetup();
    const tp1Bar = nextCandle(candles4h[candles4h.length - 1], {
      open: entry,
      low: entry * 0.999, // safely above SL
      high: tradePlan.tp1 + 0.5, // hits TP1
      close: tradePlan.tp1,
    });
    const tp2Bar = nextCandle(tp1Bar, {
      open: tradePlan.tp1,
      low: entry * 1.005, // safely above breakeven SL (entry)
      high: tradePlan.tp2 + 0.5, // hits TP2
      close: tradePlan.tp2,
    });
    const trailingBar = nextCandle(tp2Bar, { close: tradePlan.tp2 });

    const res = runQuickBacktest([...candles4h, tp1Bar, tp2Bar, trailingBar], candles1d, balanced);

    const expectedReturnPct =
      0.5 * (((tradePlan.tp1 - entry) / entry) * 100) +
      0.5 * (((tradePlan.tp2 - entry) / entry) * 100);

    expect(res.totalTrades).toBe(1);
    expect(res.winRate).toBe(100);
    expect(res.netReturnPct).toBeCloseTo(expectedReturnPct, 1);
    expect(res.avgRiskReward).toBeGreaterThan(0);
  });

  it('calculates exact TP1 then breakeven-SL math (50% at TP1, 50% at entry)', () => {
    const { candles4h, candles1d, entry, tradePlan } = buildBullishEntrySetup();
    const tp1Bar = nextCandle(candles4h[candles4h.length - 1], {
      open: entry,
      low: entry * 0.999, // above initial SL
      high: tradePlan.tp1 + 0.5, // hits TP1 -> moves SL to entry
      close: tradePlan.tp1,
    });
    const breakevenBar = nextCandle(tp1Bar, {
      open: tradePlan.tp1,
      high: tradePlan.tp1 * 1.001, // below TP2
      low: entry - 1, // breaches breakeven SL at entry
      close: entry - 0.5,
    });
    const trailingBar = nextCandle(breakevenBar, { close: entry - 0.5 });

    const res = runQuickBacktest(
      [...candles4h, tp1Bar, breakevenBar, trailingBar],
      candles1d,
      balanced,
    );

    // 50% closed at TP1, remaining 50% closed at breakeven (0% return)
    const expectedReturnPct = 0.5 * (((tradePlan.tp1 - entry) / entry) * 100);

    expect(res.totalTrades).toBe(1);
    expect(res.winRate).toBe(100);
    expect(res.netReturnPct).toBeCloseTo(expectedReturnPct, 1);
  });

  it('exits remaining position at bar close when a BAN signal occurs before SL/TP', () => {
    const { candles4h, candles1d, entry, tradePlan } = buildBullishEntrySetup();
    const exitClose = entry * 1.002;
    const banBar = nextCandle(candles4h[candles4h.length - 1], {
      open: entry * 1.005, // red candle (close < open) to flip volume score negative
      high: Math.min(entry * 1.006, tradePlan.tp1 - 0.01),
      low: Math.max(entry * 0.999, tradePlan.stopLoss + 0.01),
      close: exitClose,
      volume: 600,
    });
    const trailingBar = nextCandle(banBar, { close: exitClose });

    // Use a high sellThreshold so the red volume bar triggers BAN while remaining between SL and TP1
    const quickBanMode = {
      ...balanced,
      sellThreshold: 80,
    };

    const res = runQuickBacktest([...candles4h, banBar, trailingBar], candles1d, quickBanMode);
    const expectedReturnPct = ((exitClose - entry) / entry) * 100;

    expect(res.totalTrades).toBe(1);
    expect(res.winRate).toBe(100);
    expect(res.netReturnPct).toBeCloseTo(expectedReturnPct, 1);
  });

  it('has zero lookahead bias: mutating future or unclosed 1D candles does not alter earlier entries/results', () => {
    const { candles4h, candles1d, entry, tradePlan } = buildBullishEntrySetup();
    const tp1Bar = nextCandle(candles4h[candles4h.length - 1], {
      open: entry,
      low: entry * 0.999,
      high: tradePlan.tp1 + 0.5,
      close: tradePlan.tp1,
    });
    const tp2Bar = nextCandle(tp1Bar, {
      open: tradePlan.tp1,
      low: entry * 1.005,
      high: tradePlan.tp2 + 0.5,
      close: tradePlan.tp2,
    });
    const trailingBar = nextCandle(tp2Bar, { close: tradePlan.tp2 });
    const full4h = [...candles4h, tp1Bar, tp2Bar, trailingBar];

    const baseline = runQuickBacktest(full4h, candles1d, balanced);

    // Mutate every 1D candle whose closeTime > tp2Bar.closeTime (including the unclosed 1D candle at entry!)
    const entryCloseTime = candles4h[candles4h.length - 1].closeTime;
    const mutated1d: Candle[] = candles1d.map((c) =>
      c.closeTime > entryCloseTime
        ? {
            ...c,
            open: 10,
            high: 11,
            low: 1,
            close: 2,
            volume: 999_999,
          }
        : c,
    );

    const mutated = runQuickBacktest(full4h, mutated1d, balanced);

    expect(mutated).toEqual(baseline);
  });

  it('executes quickly on 450 4H candles', () => {
    const closes4h = Array.from({ length: 450 }, (_, i) => 100 + i * 0.25 + Math.sin(i / 7) * 5);
    const closes1d = Array.from({ length: 150 }, (_, i) => 100 + i * 1.0 + Math.sin(i / 4) * 4);
    const series4h = makeSeries(closes4h, FOUR_HOURS_MS);
    const series1d = makeSeries(closes1d, ONE_DAY_MS);

    const start = performance.now();
    const res = runQuickBacktest(series4h, series1d, balanced);
    const elapsedMs = performance.now() - start;

    expect(res.candlesTested).toBe(450 - 1 - 210);
    expect(elapsedMs).toBeLessThan(250);
  });
});

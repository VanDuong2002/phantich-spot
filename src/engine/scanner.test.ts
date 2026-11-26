import { describe, it, expect, vi } from 'vitest';
import {
  filterScanResults,
  runMarketScan,
  sortScanResults,
  STABLECOIN_BASES,
} from './scanner';
import { BUILT_IN_MODES } from '../settings/presets';
import type { AnalysisReport, Candle, MultiTimeframeData, Verdict } from '../types/market';

const balanced = BUILT_IN_MODES.find((m) => m.id === 'balanced')!;

function makeReport(symbol: string, verdict: Verdict, score: number): AnalysisReport {
  return {
    symbol,
    currentPrice: 100,
    priceChangePercent24h: 1.5,
    fetchedAt: Date.now(),
    modeName: 'Cân bằng',
    score,
    verdict,
    headline: `${symbol} headline`,
    summary: 'summary',
    reasons: [],
    warnings: [],
    timeframes: {
      '1w': { timeframe: '1w', score: 0, trend: 'NEUTRAL', snapshot: { price: 100, ema21: 100, ema50: 100, ema200: 100, rsi: 50, macd: 0, macdSignal: 0, macdHistogram: 0, atr: 2, volumeRatio: 1 } },
      '1d': { timeframe: '1d', score: 0, trend: 'NEUTRAL', snapshot: { price: 100, ema21: 100, ema50: 100, ema200: 100, rsi: 50, macd: 0, macdSignal: 0, macdHistogram: 0, atr: 2, volumeRatio: 1 } },
      '4h': { timeframe: '4h', score: 0, trend: 'NEUTRAL', snapshot: { price: 100, ema21: 100, ema50: 100, ema200: 100, rsi: 50, macd: 0, macdSignal: 0, macdHistogram: 0, atr: 2, volumeRatio: 1 } },
      '1h': { timeframe: '1h', score: 0, trend: 'NEUTRAL', snapshot: { price: 100, ema21: 100, ema50: 100, ema200: 100, rsi: 50, macd: 0, macdSignal: 0, macdHistogram: 0, atr: 2, volumeRatio: 1 } },
    },
    tradePlan: null,
    referenceLevels: { nearestSupport: 95, nearestResistance: 105, invalidationLevel: 92 },
  };
}

function makeCandles(start: number, step: number, count: number): Candle[] {
  return Array.from({ length: count }, (_, i) => {
    const close = Math.max(1, start + i * step);
    return {
      openTime: i * 3600_000,
      closeTime: (i + 1) * 3600_000 - 1,
      open: close - step * 0.5,
      high: close * 1.015,
      low: close * 0.985,
      close,
      volume: 200,
    };
  });
}

function makeMarketData(symbol: string, step: number): MultiTimeframeData {
  const c1w = makeCandles(50, step * 2, 220);
  const c1d = makeCandles(80, step, 240);
  const c4h = makeCandles(100, step * 0.5, 240);
  const c1h = makeCandles(120, step * 0.2, 240);
  return {
    symbol,
    ticker: {
      symbol,
      lastPrice: c1h.at(-1)!.close,
      priceChangePercent: step > 0 ? 3.2 : -3.2,
      highPrice: c1h.at(-1)!.high,
      lowPrice: c1h.at(-1)!.low,
      quoteVolume: 50_000_000,
    },
    candles: { '1w': c1w, '1d': c1d, '4h': c4h, '1h': c1h },
    fetchedAt: Date.now(),
  };
}

describe('market scanner engine', () => {
  it('excludes common stablecoins in STABLECOIN_BASES', () => {
    expect(STABLECOIN_BASES.has('USDC')).toBe(true);
    expect(STABLECOIN_BASES.has('FDUSD')).toBe(true);
    expect(STABLECOIN_BASES.has('BTC')).toBe(false);
  });

  it('sorts MUA first, then GIU, DUNG_NGOAI, BAN, with higher score first within each group', () => {
    const unsorted = [
      makeReport('SOLUSDT', 'DUNG_NGOAI', 45),
      makeReport('ETHUSDT', 'MUA', 71),
      makeReport('BTCUSDT', 'MUA', 82),
      makeReport('LINKUSDT', 'BAN', 20),
      makeReport('BNBUSDT', 'GIU', 58),
    ];
    const sorted = sortScanResults(unsorted);
    expect(sorted.map((r) => r.symbol)).toEqual([
      'BTCUSDT',
      'ETHUSDT',
      'BNBUSDT',
      'SOLUSDT',
      'LINKUSDT',
    ]);
  });

  it('filters results by ALL, MUA, and MUA_GIU', () => {
    const list = [
      makeReport('BTCUSDT', 'MUA', 78),
      makeReport('ETHUSDT', 'GIU', 55),
      makeReport('SOLUSDT', 'DUNG_NGOAI', 42),
    ];
    expect(filterScanResults(list, 'ALL')).toHaveLength(3);
    expect(filterScanResults(list, 'MUA').map((r) => r.symbol)).toEqual(['BTCUSDT']);
    expect(filterScanResults(list, 'MUA_GIU').map((r) => r.symbol)).toEqual(['BTCUSDT', 'ETHUSDT']);
  });

  it('runs concurrent scan, skips failed coins gracefully, and reports progress', async () => {
    const progressCalls: number[] = [];
    const fetcher = vi.fn(async (symbol: string) => {
      if (symbol === 'BADUSDT') throw new Error('400');
      return makeMarketData(symbol, symbol === 'BTCUSDT' ? 2 : -1);
    });

    const results = await runMarketScan(['BTCUSDT', 'BADUSDT', 'ETHUSDT'], balanced, fetcher, {
      concurrency: 2,
      onProgress: (p) => progressCalls.push(p.completed),
    });

    expect(results).toHaveLength(2);
    expect(progressCalls).toEqual([1, 2, 3]);
    expect(results[0].symbol).toBe('BTCUSDT');
  });

  it('stops early when AbortSignal is aborted', async () => {
    const controller = new AbortController();
    const fetcher = vi.fn(async (symbol: string) => {
      controller.abort();
      return makeMarketData(symbol, 1);
    });

    const results = await runMarketScan(['BTCUSDT', 'ETHUSDT', 'SOLUSDT'], balanced, fetcher, {
      concurrency: 1,
      signal: controller.signal,
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(results).toHaveLength(0);
  });
});

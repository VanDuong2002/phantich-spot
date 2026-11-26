import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MarketScanner } from './MarketScanner';
import { BUILT_IN_MODES } from '../settings/presets';
import type { AnalysisReport } from '../types/market';

const balanced = BUILT_IN_MODES.find((m) => m.id === 'balanced')!;

const sampleBuyReport: AnalysisReport = {
  symbol: 'SOLUSDT',
  currentPrice: 145.5,
  priceChangePercent24h: 4.2,
  fetchedAt: Date.now(),
  modeName: 'Cân bằng',
  score: 76.4,
  verdict: 'MUA',
  headline: 'SOL tăng đẹp',
  summary: 'Đồng thuận 4 khung.',
  reasons: [],
  warnings: [],
  timeframes: {
    '1w': { timeframe: '1w', score: 40, trend: 'UP', snapshot: { price: 145.5, ema21: 130, ema50: 120, ema200: 100, rsi: 60, macd: 2, macdSignal: 1, macdHistogram: 1, atr: 5, volumeRatio: 1.2 } },
    '1d': { timeframe: '1d', score: 50, trend: 'UP', snapshot: { price: 145.5, ema21: 140, ema50: 132, ema200: 110, rsi: 58, macd: 1, macdSignal: 0.5, macdHistogram: 0.5, atr: 4, volumeRatio: 1.3 } },
    '4h': { timeframe: '4h', score: 55, trend: 'UP', snapshot: { price: 145.5, ema21: 143, ema50: 139, ema200: 128, rsi: 54, macd: 0.8, macdSignal: 0.3, macdHistogram: 0.5, atr: 2.5, volumeRatio: 1.4 } },
    '1h': { timeframe: '1h', score: 30, trend: 'UP', snapshot: { price: 145.5, ema21: 145, ema50: 144, ema200: 140, rsi: 55, macd: 0.2, macdSignal: 0.1, macdHistogram: 0.1, atr: 1.2, volumeRatio: 1.1 } },
  },
  tradePlan: {
    entryLow: 142,
    entryHigh: 145.5,
    stopLoss: 136,
    stopLossPct: -5.4,
    tp1: 155,
    tp1Pct: 7.8,
    tp2: 164,
    tp2Pct: 14.1,
    riskReward: 2.1,
  },
  referenceLevels: { nearestSupport: 140, nearestResistance: 155, invalidationLevel: 136 },
};

describe('MarketScanner', () => {
  it('renders empty state and triggers scan on click', () => {
    const onStartScan = vi.fn();
    render(
      <MarketScanner
        activeMode={balanced}
        topN={30}
        onChangeTopN={() => {}}
        filter="ALL"
        onChangeFilter={() => {}}
        results={[]}
        isScanning={false}
        progress={null}
        error={null}
        onStartScan={onStartScan}
        onStopScan={() => {}}
        onSelectCoin={() => {}}
      />,
    );

    fireEvent.click(screen.getByText('Bắt đầu quét Top 30 coin'));
    expect(onStartScan).toHaveBeenCalledTimes(1);
  });

  it('renders buy result row with Buy Zone & R:R and opens detail on Xem click', () => {
    const onSelectCoin = vi.fn();
    render(
      <MarketScanner
        activeMode={balanced}
        topN={30}
        onChangeTopN={() => {}}
        filter="MUA"
        onChangeFilter={() => {}}
        results={[sampleBuyReport]}
        isScanning={false}
        progress={null}
        error={null}
        onStartScan={() => {}}
        onStopScan={() => {}}
        onSelectCoin={onSelectCoin}
      />,
    );

    expect(screen.getByText('SOL/USDT')).toBeTruthy();
    expect(screen.getByText(/R:R 1:2\.1/)).toBeTruthy();
    fireEvent.click(screen.getByText('Xem'));
    expect(onSelectCoin).toHaveBeenCalledWith('SOLUSDT');
  });
});

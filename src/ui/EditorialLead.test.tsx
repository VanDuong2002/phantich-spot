import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EditorialLead } from './EditorialLead';
import type { AnalysisReport } from '../types/market';

const baseReport: AnalysisReport = {
  symbol: 'BTCUSDT',
  currentPrice: 97250,
  priceChangePercent24h: 2.1,
  fetchedAt: Date.now(),
  modeName: 'Cân bằng',
  score: 72,
  verdict: 'MUA',
  headline: 'Bitcoin: Xu hướng tăng đa khung được xác nhận',
  summary: 'Ba trên bốn khung đồng thuận tăng.',
  reasons: ['Giá nằm trên EMA200 1D'],
  warnings: [],
  timeframes: {
    '1w': {
      timeframe: '1w',
      score: 60,
      trend: 'UP',
      snapshot: {
        price: 97250,
        ema21: 90000,
        ema50: 85000,
        ema200: 70000,
        rsi: 61,
        macd: 10,
        macdSignal: 8,
        macdHistogram: 2,
        atr: 3000,
        volumeRatio: 1.2,
      },
    },
    '1d': {
      timeframe: '1d',
      score: 55,
      trend: 'UP',
      snapshot: {
        price: 97250,
        ema21: 94000,
        ema50: 91000,
        ema200: 82000,
        rsi: 58,
        macd: 5,
        macdSignal: 3,
        macdHistogram: 2,
        atr: 1800,
        volumeRatio: 1.1,
      },
    },
    '4h': {
      timeframe: '4h',
      score: 50,
      trend: 'UP',
      snapshot: {
        price: 97250,
        ema21: 96000,
        ema50: 95000,
        ema200: 92000,
        rsi: 48,
        macd: 2,
        macdSignal: 1,
        macdHistogram: 1,
        atr: 900,
        volumeRatio: 1.3,
      },
    },
    '1h': {
      timeframe: '1h',
      score: 10,
      trend: 'NEUTRAL',
      snapshot: {
        price: 97250,
        ema21: 97000,
        ema50: 96800,
        ema200: 95500,
        rsi: 52,
        macd: 0,
        macdSignal: 0,
        macdHistogram: 0,
        atr: 400,
        volumeRatio: 0.9,
      },
    },
  },
  tradePlan: {
    entryLow: 95800,
    entryHigh: 96500,
    stopLoss: 93900,
    stopLossPct: -3.4,
    tp1: 100200,
    tp1Pct: 4.1,
    tp2: 104000,
    tp2Pct: 8.1,
    riskReward: 2.3,
  },
  referenceLevels: {
    nearestSupport: 95000,
    nearestResistance: 100200,
    invalidationLevel: 93900,
  },
};

describe('EditorialLead', () => {
  it('renders Spot Trade Plan on MUA verdict', () => {
    render(<EditorialLead report={baseReport} />);
    expect(screen.getByText('Kế hoạch lệnh Spot')).toBeTruthy();
    expect(screen.getByText(/93,900/)).toBeTruthy();
  });

  it('renders Reference Levels instead of Trade Plan on DUNG_NGOAI verdict', () => {
    render(<EditorialLead report={{ ...baseReport, verdict: 'DUNG_NGOAI', tradePlan: null }} />);
    expect(screen.getByText('Mốc kỹ thuật tham chiếu')).toBeTruthy();
    expect(screen.queryByText('Kế hoạch lệnh Spot')).toBeNull();
  });
});

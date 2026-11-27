import { describe, it, expect } from 'vitest';
import {
  analyzeNewsFeed,
  annotateMacroEvent,
  extractRelatedCoins,
  filterNewsItems,
} from './newsAnalyzer';
import type { RawNewsItem } from '../types/news';

const now = Date.now();

const sampleItems: RawNewsItem[] = [
  {
    id: '1',
    title: 'At least 13 Niger soldiers killed in Sanam armed attack',
    description: 'Unrelated geopolitical conflict with no financial or crypto context.',
    link: 'https://example.com/noise',
    source: 'Al Jazeera',
    publishedAt: now - 1000,
  },
  {
    id: '2',
    title: 'Spot Bitcoin ETF sees record $850M net inflow as BlackRock accumulates BTC',
    description: 'Institutional demand surges for Bitcoin ETFs.',
    link: 'https://example.com/btc-etf',
    source: 'CoinTelegraph',
    publishedAt: now - 2000,
  },
  {
    id: '3',
    title: 'Federal Reserve Chair Powell signals hawkish stance as hot inflation persists',
    description: 'FOMC minutes warn of higher for longer interest rates weighing on crypto.',
    link: 'https://example.com/fed',
    source: 'Decrypt',
    publishedAt: now - 3000,
  },
  {
    id: '4',
    title: 'Solana mainnet upgrade boosts throughput while SOL rally continues',
    description: 'Solana ecosystem adoption grows.',
    link: 'https://example.com/sol',
    source: 'CoinTelegraph',
    publishedAt: now - 4000,
  },
];

describe('newsAnalyzer', () => {
  it('filters out non-crypto geopolitical noise and keeps market-relevant items', () => {
    const { items } = analyzeNewsFeed(sampleItems);
    expect(items).toHaveLength(3);
    expect(items.some((i) => i.title.includes('Niger'))).toBe(false);
  });

  it('extracts related coin tickers from full names and symbols', () => {
    expect(extractRelatedCoins('Bitcoin and Solana rally while Ethereum upgrades')).toEqual([
      'BTC',
      'ETH',
      'SOL',
    ]);
  });

  it('classifies bullish ETF inflow and bearish hawkish FED news with deep Vietnamese meaning and impact', () => {
    const { items } = analyzeNewsFeed(sampleItems);
    const btcEtf = items.find((i) => i.id === '2')!;
    const fed = items.find((i) => i.id === '3')!;

    expect(btcEtf.sentiment).toBe('BULLISH');
    expect(btcEtf.category).toBe('ETF_INSTITUTIONAL');
    expect(btcEtf.coins).toContain('BTC');
    expect(btcEtf.meaningVi).toContain('$850M');
    expect(btcEtf.impactVi.length).toBeGreaterThan(20);
    expect(btcEtf.actionHintVi.length).toBeGreaterThan(10);

    expect(fed.sentiment).toBe('BEARISH');
    expect(fed.category).toBe('FED_MACRO');
    expect(fed.impact).toBe('HIGH');
    expect(fed.impactVi).toContain('DXY');
  });

  it('filters out TradingView user chart ideas as non-news noise', () => {
    const { items } = analyzeNewsFeed([
      {
        id: 'tv1',
        title: 'BTCUSDT - BULLISH BREAKOUT POTENTIAL',
        description: 'Chart idea',
        link: 'https://tradingview.com/chart/1',
        source: 'TradingView Crypto Ideas',
        publishedAt: now,
      },
    ]);
    expect(items).toHaveLength(0);
  });

  it('filters by SELECTED_COIN, FED_MACRO, BULLISH, BEARISH, and search query', () => {
    const { items } = analyzeNewsFeed(sampleItems);
    expect(filterNewsItems(items, 'SELECTED_COIN', 'SOL')).toHaveLength(1);
    expect(filterNewsItems(items, 'FED_MACRO', 'BTC')).toHaveLength(1);
    expect(filterNewsItems(items, 'BULLISH', 'BTC')).toHaveLength(2);
    expect(filterNewsItems(items, 'BEARISH', 'BTC')).toHaveLength(1);
    expect(filterNewsItems(items, 'ALL', 'BTC', 'BlackRock')).toHaveLength(1);
  });

  it('annotates FED/FOMC and CPI macro events with Vietnamese crypto impact notes', () => {
    const fomc = annotateMacroEvent({
      id: 'f1',
      title: 'FOMC Statement & Federal Funds Rate Decision',
      country: 'USD',
      dateIso: '2026-12-09T19:00:00Z',
      timestampMs: Date.parse('2026-12-09T19:00:00Z'),
      impact: 'High',
      forecast: '',
      previous: '',
      isFomc: true,
    });
    expect(fomc.cryptoNoteVi).toContain('FED');
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NewsFeed } from './NewsFeed';
import type { AnalyzedNewsItem, MacroEvent } from '../types/news';

const sampleNews: AnalyzedNewsItem[] = [
  {
    id: 'n1',
    title: 'BlackRock Bitcoin ETF logs record inflow',
    description: 'Institutional buying accelerates.',
    link: 'https://example.com/1',
    source: 'CoinTelegraph',
    publishedAt: Date.now() - 600_000,
    sentiment: 'BULLISH',
    sentimentScore: 45,
    impact: 'HIGH',
    category: 'ETF_INSTITUTIONAL',
    categoryLabelVi: 'ETF & Tổ chức',
    coins: ['BTC'],
    reasonVi: 'Dòng tiền tổ chức / ETF mua ròng',
  },
  {
    id: 'n2',
    title: 'Federal Reserve warns on sticky inflation',
    description: 'FOMC keeps rates higher.',
    link: 'https://example.com/2',
    source: 'Decrypt',
    publishedAt: Date.now() - 1_200_000,
    sentiment: 'BEARISH',
    sentimentScore: -40,
    impact: 'HIGH',
    category: 'FED_MACRO',
    categoryLabelVi: 'FED & Vĩ mô',
    coins: [],
    reasonVi: 'Áp lực vĩ mô / lãi suất diều hâu',
  },
];

const sampleCalendar: MacroEvent[] = [
  {
    id: 'c1',
    title: 'FOMC Statement & Federal Funds Rate Decision',
    country: 'USD',
    dateIso: '2026-12-09T19:00:00Z',
    timestampMs: Date.now() + 86_400_000,
    impact: 'High',
    forecast: '4.25%',
    previous: '4.50%',
    isFomc: true,
    cryptoNoteVi: 'Tin cực mạnh từ FED.',
  },
];

describe('NewsFeed', () => {
  it('renders news sentiment summary, filters by selected coin, and displays RED FED calendar', () => {
    const onSelectCoin = vi.fn();
    render(
      <NewsFeed
        selectedSymbol="BTCUSDT"
        items={sampleNews}
        calendar={sampleCalendar}
        fearGreed={{ value: 62, classification: 'Greed', classificationVi: 'Tham lam', updatedAt: Date.now() }}
        fetchedAt={Date.now()}
        loading={false}
        error={null}
        onRefresh={() => {}}
        onSelectCoin={onSelectCoin}
      />,
    );

    expect(screen.getByText('FOMC Statement & Federal Funds Rate Decision')).toBeTruthy();
    expect(screen.getByText('TIN ĐỎ')).toBeTruthy();

    fireEvent.click(screen.getByText('Liên quan BTC'));
    expect(screen.getByText('BlackRock Bitcoin ETF logs record inflow')).toBeTruthy();
    expect(screen.queryByText('Federal Reserve warns on sticky inflation')).toBeNull();
  });
});

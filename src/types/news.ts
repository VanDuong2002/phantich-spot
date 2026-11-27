export type NewsSentiment = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

export type NewsImpact = 'HIGH' | 'MEDIUM';

export type NewsCategory =
  | 'FED_MACRO'
  | 'ETF_INSTITUTIONAL'
  | 'REGULATION'
  | 'SECURITY'
  | 'EXCHANGE_LISTING'
  | 'ECOSYSTEM'
  | 'MARKET_MOVE';

export type NewsFilter = 'ALL' | 'SELECTED_COIN' | 'FED_MACRO' | 'BULLISH' | 'BEARISH';

export interface RawNewsItem {
  id: string;
  title: string;
  description: string;
  link: string;
  source: string;
  publishedAt: number; // Unix ms
}

export interface AnalyzedNewsItem extends RawNewsItem {
  sentiment: NewsSentiment;
  sentimentScore: number; // -100 to +100
  impact: NewsImpact;
  category: NewsCategory;
  categoryLabelVi: string;
  coins: string[]; // Base assets e.g. ['BTC', 'ETH']
  reasonVi: string;
}

export interface NewsMarketSummary {
  outlook: 'TANG' | 'GIAM' | 'TRUNG_TINH';
  score: number; // -100 to +100
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;
  highImpactCount: number;
  headlineVi: string;
  summaryVi: string;
  topThemesVi: string[];
}

export type MacroImpactLevel = 'High' | 'Medium' | 'Low';

export interface MacroEvent {
  id: string;
  title: string;
  country: string;
  dateIso: string;
  timestampMs: number;
  impact: MacroImpactLevel;
  forecast: string;
  previous: string;
  isFomc?: boolean;
  cryptoNoteVi?: string;
}

export interface FearGreedIndex {
  value: number;
  classification: string;
  classificationVi: string;
  updatedAt: number;
}

export interface NewsBundle {
  rawNews: RawNewsItem[];
  calendar: MacroEvent[];
  fearGreed: FearGreedIndex | null;
  fetchedAt: number;
}

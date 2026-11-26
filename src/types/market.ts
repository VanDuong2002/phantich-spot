export type Timeframe = '1h' | '4h' | '1d' | '1w';

export type Verdict = 'MUA' | 'GIU' | 'BAN' | 'DUNG_NGOAI';

export interface Candle {
  openTime: number;
  closeTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface SymbolInfo {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  status: string;
}

export interface Ticker24h {
  symbol: string;
  lastPrice: number;
  priceChangePercent: number;
  highPrice: number;
  lowPrice: number;
  quoteVolume: number;
}

export interface MultiTimeframeData {
  symbol: string;
  ticker: Ticker24h;
  candles: Record<Timeframe, Candle[]>;
  fetchedAt: number;
}

export interface IndicatorParams {
  emaFast: number;
  emaMid: number;
  emaSlow: number;
  rsiPeriod: number;
  rsiOversold: number;
  rsiOverbought: number;
  macdFast: number;
  macdSlow: number;
  macdSignal: number;
  atrPeriod: number;
  volumeSmaPeriod: number;
}

export interface AnalysisMode {
  id: string;
  name: string;
  description: string;
  isBuiltIn: boolean;
  timeframeWeights: Record<Timeframe, number>;
  indicatorWeights: {
    ema: number;
    rsi: number;
    macd: number;
    volume: number;
  };
  params: IndicatorParams;
  buyThreshold: number;
  sellThreshold: number;
  minRiskReward: number;
  requireHigherTfNotBearish: boolean;
}

export interface SettingsSchema {
  version: 1;
  activeModeId: string;
  modes: AnalysisMode[];
  watchlist: string[];
  extensions: Record<string, unknown>;
}

export interface IndicatorSnapshot {
  price: number;
  ema21: number | null;
  ema50: number | null;
  ema200: number | null;
  rsi: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHistogram: number | null;
  atr: number | null;
  volumeRatio: number | null;
}

export interface TimeframeAnalysis {
  timeframe: Timeframe;
  score: number;
  trend: 'UP' | 'DOWN' | 'NEUTRAL';
  snapshot: IndicatorSnapshot;
}

export interface TradePlan {
  entryLow: number;
  entryHigh: number;
  stopLoss: number;
  stopLossPct: number;
  tp1: number;
  tp1Pct: number;
  tp2: number;
  tp2Pct: number;
  riskReward: number;
}

export interface ReferenceLevels {
  nearestSupport: number;
  nearestResistance: number;
  invalidationLevel: number;
}

export interface AnalysisReport {
  symbol: string;
  currentPrice: number;
  priceChangePercent24h: number;
  fetchedAt: number;
  modeName: string;
  score: number;
  verdict: Verdict;
  headline: string;
  summary: string;
  reasons: string[];
  warnings: string[];
  timeframes: Record<Timeframe, TimeframeAnalysis>;
  tradePlan: TradePlan | null;
  referenceLevels: ReferenceLevels;
}

export interface BacktestResult {
  totalTrades: number;
  winRate: number;
  avgRiskReward: number;
  netReturnPct: number;
  candlesTested: number;
  ruleSummaryVi: string;
}

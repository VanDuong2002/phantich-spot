import type {
  Candle,
  MultiTimeframeData,
  SymbolInfo,
  Ticker24h,
  Timeframe,
} from '../types/market';

const BINANCE_ENDPOINTS = [
  'https://data-api.binance.vision',
  'https://api.binance.com',
] as const;

const KLINE_TTL_MS: Record<Timeframe, number> = {
  '1h': 60_000,
  '4h': 60_000,
  '1d': 300_000,
  '1w': 300_000,
};

const TICKER_TTL_MS = 30_000;
const ALL_TICKERS_TTL_MS = 60_000;
const EXCHANGE_INFO_TTL_MS = 24 * 60 * 60 * 1000;

const MULTI_TF_LIMITS: Record<Timeframe, number> = {
  '1h': 250,
  '4h': 450,
  '1d': 300,
  '1w': 250,
};

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

interface RawExchangeSymbol {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  status: string;
  isSpotTradingAllowed?: boolean;
}

interface RawExchangeInfoResponse {
  symbols?: RawExchangeSymbol[];
}

interface RawTicker24hResponse {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  highPrice: string;
  lowPrice: string;
  quoteVolume: string;
}

type RawKlineRow = [
  number,
  string,
  string,
  string,
  string,
  string,
  number,
  ...unknown[],
];

const cache = new Map<string, CacheEntry<unknown>>();

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

async function fetchJsonWithFallback<T>(path: string): Promise<T> {
  let lastError: unknown = null;

  for (const baseUrl of BINANCE_ENDPOINTS) {
    try {
      const response = await fetch(`${baseUrl}${path}`);
      if (!response.ok) {
        lastError = new Error(`Binance HTTP ${response.status} from ${baseUrl}${path}`);
        continue;
      }
      return (await response.json()) as T;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Failed to fetch ${path} from all Binance endpoints`);
}

async function getCached<T>(
  key: string,
  ttlMs: number,
  forceRefresh: boolean,
  fetcher: () => Promise<T>,
): Promise<T> {
  if (!forceRefresh) {
    const existing = cache.get(key);
    if (existing && Date.now() < existing.expiresAt) {
      return existing.value as T;
    }
  }

  const value = await fetcher();
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

/** Clears all cached Binance market data responses. */
export function clearBinanceCache(): void {
  cache.clear();
}

/** Fetches active spot-tradable USDT pairs from Binance exchangeInfo. */
export async function fetchUsdtSymbols(forceRefresh = false): Promise<SymbolInfo[]> {
  return getCached('exchangeInfo:usdt', EXCHANGE_INFO_TTL_MS, forceRefresh, async () => {
    const data = await fetchJsonWithFallback<RawExchangeInfoResponse>('/api/v3/exchangeInfo');
    const symbols = Array.isArray(data.symbols) ? data.symbols : [];
    return symbols
      .filter(
        (item) =>
          item.status === 'TRADING' &&
          item.quoteAsset === 'USDT' &&
          item.isSpotTradingAllowed !== false,
      )
      .map((item) => ({
        symbol: item.symbol,
        baseAsset: item.baseAsset,
        quoteAsset: item.quoteAsset,
        status: item.status,
      }));
  });
}

/** Fetches OHLCV kline candles for a symbol and timeframe with TTL caching. */
export async function fetchKlines(
  symbol: string,
  timeframe: Timeframe,
  limit = 250,
  forceRefresh = false,
): Promise<Candle[]> {
  const normalized = normalizeSymbol(symbol);
  const cacheKey = `klines:${normalized}:${timeframe}:${limit}`;

  return getCached(cacheKey, KLINE_TTL_MS[timeframe], forceRefresh, async () => {
    const params = new URLSearchParams({
      symbol: normalized,
      interval: timeframe,
      limit: String(limit),
    });
    const raw = await fetchJsonWithFallback<RawKlineRow[]>(
      `/api/v3/klines?${params.toString()}`,
    );
    return raw.map((row) => ({
      openTime: Number(row[0]),
      open: Number(row[1]),
      high: Number(row[2]),
      low: Number(row[3]),
      close: Number(row[4]),
      volume: Number(row[5]),
      closeTime: Number(row[6]),
    }));
  });
}

/** Fetches 24-hour ticker statistics for a symbol with a 30s cache. */
export async function fetchTicker24h(
  symbol: string,
  forceRefresh = false,
): Promise<Ticker24h> {
  const normalized = normalizeSymbol(symbol);
  const cacheKey = `ticker24h:${normalized}`;

  return getCached(cacheKey, TICKER_TTL_MS, forceRefresh, async () => {
    const params = new URLSearchParams({ symbol: normalized });
    const raw = await fetchJsonWithFallback<RawTicker24hResponse>(
      `/api/v3/ticker/24hr?${params.toString()}`,
    );
    return {
      symbol: raw.symbol,
      lastPrice: Number(raw.lastPrice),
      priceChangePercent: Number(raw.priceChangePercent),
      highPrice: Number(raw.highPrice),
      lowPrice: Number(raw.lowPrice),
      quoteVolume: Number(raw.quoteVolume),
    };
  });
}

/** Fetches 24h ticker statistics for all symbols with a 60s cache. */
export async function fetchAllTickers24h(forceRefresh = false): Promise<Ticker24h[]> {
  return getCached('ticker24h:all', ALL_TICKERS_TTL_MS, forceRefresh, async () => {
    const rawList = await fetchJsonWithFallback<RawTicker24hResponse[]>('/api/v3/ticker/24hr');
    if (!Array.isArray(rawList)) return [];
    return rawList.map((raw) => ({
      symbol: raw.symbol,
      lastPrice: Number(raw.lastPrice),
      priceChangePercent: Number(raw.priceChangePercent),
      highPrice: Number(raw.highPrice),
      lowPrice: Number(raw.lowPrice),
      quoteVolume: Number(raw.quoteVolume),
    }));
  });
}

/**
 * Fetches top N active Spot USDT pairs ranked by 24h quote volume,
 * excluding specified base assets (e.g., stablecoins).
 */
export async function fetchTopUsdtSymbolsByVolume(
  topN: number,
  excludeBases: ReadonlySet<string> = new Set(),
  forceRefresh = false,
): Promise<Ticker24h[]> {
  const [symbols, allTickers] = await Promise.all([
    fetchUsdtSymbols(forceRefresh),
    fetchAllTickers24h(forceRefresh),
  ]);

  const tradableMap = new Map<string, SymbolInfo>();
  for (const sym of symbols) {
    if (!excludeBases.has(sym.baseAsset.toUpperCase())) {
      tradableMap.set(sym.symbol, sym);
    }
  }

  return allTickers
    .filter((t) => tradableMap.has(t.symbol) && Number.isFinite(t.quoteVolume) && t.quoteVolume > 0)
    .sort((a, b) => b.quoteVolume - a.quoteVolume)
    .slice(0, Math.max(1, topN));
}

/** Fetches 24h ticker and 1h/4h/1d/1w klines in parallel for a symbol. */
export async function fetchMultiTimeframeData(
  symbol: string,
  forceRefresh = false,
): Promise<MultiTimeframeData> {
  const normalized = normalizeSymbol(symbol);

  const [ticker, h1, h4, d1, w1] = await Promise.all([
    fetchTicker24h(normalized, forceRefresh),
    fetchKlines(normalized, '1h', MULTI_TF_LIMITS['1h'], forceRefresh),
    fetchKlines(normalized, '4h', MULTI_TF_LIMITS['4h'], forceRefresh),
    fetchKlines(normalized, '1d', MULTI_TF_LIMITS['1d'], forceRefresh),
    fetchKlines(normalized, '1w', MULTI_TF_LIMITS['1w'], forceRefresh),
  ]);

  return {
    symbol: normalized,
    ticker,
    candles: {
      '1h': h1,
      '4h': h4,
      '1d': d1,
      '1w': w1,
    },
    fetchedAt: Date.now(),
  };
}

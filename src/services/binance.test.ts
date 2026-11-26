import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchKlines,
  fetchTicker24h,
  fetchUsdtSymbols,
  fetchMultiTimeframeData,
  clearBinanceCache,
} from './binance';

const sampleKline = [
  1700000000000, '95000', '96000', '94000', '95500', '123.4', 1700003599999,
];

const sampleTickerResponse = {
  symbol: 'BTCUSDT',
  lastPrice: '95500.50',
  priceChangePercent: '2.35',
  highPrice: '96500.00',
  lowPrice: '93000.00',
  quoteVolume: '1234567890.12',
};

const sampleExchangeInfo = {
  symbols: [
    {
      symbol: 'BTCUSDT',
      baseAsset: 'BTC',
      quoteAsset: 'USDT',
      status: 'TRADING',
      isSpotTradingAllowed: true,
    },
    {
      symbol: 'ETHUSDT',
      baseAsset: 'ETH',
      quoteAsset: 'USDT',
      status: 'TRADING',
    },
    {
      symbol: 'LTCUSDT',
      baseAsset: 'LTC',
      quoteAsset: 'USDT',
      status: 'BREAK',
      isSpotTradingAllowed: true,
    },
    {
      symbol: 'SOLBTC',
      baseAsset: 'SOL',
      quoteAsset: 'BTC',
      status: 'TRADING',
      isSpotTradingAllowed: true,
    },
    {
      symbol: 'XRPUSDT',
      baseAsset: 'XRP',
      quoteAsset: 'USDT',
      status: 'TRADING',
      isSpotTradingAllowed: false,
    },
  ],
};

describe('binance public client', () => {
  beforeEach(() => {
    clearBinanceCache();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fetches from data-api.binance.vision and caches subsequent calls', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [sampleKline],
    });
    vi.stubGlobal('fetch', fetchMock);

    const first = await fetchKlines('BTCUSDT', '4h', 250);
    const second = await fetchKlines('BTCUSDT', '4h', 250);
    expect(first).toHaveLength(1);
    expect(first[0].close).toBe(95500);
    expect(first[0]).toEqual({
      openTime: 1700000000000,
      open: 95000,
      high: 96000,
      low: 94000,
      close: 95500,
      volume: 123.4,
      closeTime: 1700003599999,
    });
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('data-api.binance.vision');
  });

  it('falls back to api.binance.com when primary endpoint returns 451 or network error', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 451 })
      .mockResolvedValueOnce({ ok: true, json: async () => [sampleKline] });
    vi.stubGlobal('fetch', fetchMock);

    const candles = await fetchKlines('BTCUSDT', '1d', 250);
    expect(candles).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toContain('api.binance.com');
  });

  it('falls back to api.binance.com when primary endpoint rejects with network error', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({ ok: true, json: async () => [sampleKline] });
    vi.stubGlobal('fetch', fetchMock);

    const candles = await fetchKlines('ETHUSDT', '1h', 100);
    expect(candles).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain('data-api.binance.vision');
    expect(fetchMock.mock.calls[1][0]).toContain('api.binance.com');
  });

  it('throws an error when both endpoints fail', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: false, status: 500 });
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchKlines('BTCUSDT', '1h', 250)).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('bypasses cache when forceRefresh is true', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [sampleKline],
    });
    vi.stubGlobal('fetch', fetchMock);

    await fetchKlines('BTCUSDT', '1h', 250);
    await fetchKlines('BTCUSDT', '1h', 250, true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('expires kline cache according to timeframe TTL (60s for 1h/4h, 300s for 1d/1w)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [sampleKline],
    });
    vi.stubGlobal('fetch', fetchMock);

    await fetchKlines('BTCUSDT', '1h', 250);
    await fetchKlines('BTCUSDT', '1d', 250);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(61_000);
    await fetchKlines('BTCUSDT', '1h', 250);
    await fetchKlines('BTCUSDT', '1d', 250);
    expect(fetchMock).toHaveBeenCalledTimes(3); // 1h expired, 1d still cached

    vi.advanceTimersByTime(240_000); // total 301s
    await fetchKlines('BTCUSDT', '1d', 250);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('fetches and caches 24h ticker with 30s TTL', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => sampleTickerResponse,
    });
    vi.stubGlobal('fetch', fetchMock);

    const ticker = await fetchTicker24h('btcusdt');
    expect(ticker).toEqual({
      symbol: 'BTCUSDT',
      lastPrice: 95500.5,
      priceChangePercent: 2.35,
      highPrice: 96500,
      lowPrice: 93000,
      quoteVolume: 1234567890.12,
    });

    await fetchTicker24h('BTCUSDT');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(31_000);
    await fetchTicker24h('BTCUSDT');
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await fetchTicker24h('BTCUSDT', true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('fetches and filters spot trading USDT symbols with 24h cache', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => sampleExchangeInfo,
    });
    vi.stubGlobal('fetch', fetchMock);

    const symbols = await fetchUsdtSymbols();
    expect(symbols).toEqual([
      { symbol: 'BTCUSDT', baseAsset: 'BTC', quoteAsset: 'USDT', status: 'TRADING' },
      { symbol: 'ETHUSDT', baseAsset: 'ETH', quoteAsset: 'USDT', status: 'TRADING' },
    ]);

    await fetchUsdtSymbols();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(24 * 60 * 60 * 1000 + 1);
    await fetchUsdtSymbols();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('fetches multi-timeframe data in parallel with expected candle limits', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/api/v3/ticker/24hr')) {
        return { ok: true, json: async () => sampleTickerResponse };
      }
      return { ok: true, json: async () => [sampleKline] };
    });
    vi.stubGlobal('fetch', fetchMock);

    const data = await fetchMultiTimeframeData('BTCUSDT');
    expect(data.symbol).toBe('BTCUSDT');
    expect(data.ticker.lastPrice).toBe(95500.5);
    expect(data.candles['1h']).toHaveLength(1);
    expect(data.candles['4h']).toHaveLength(1);
    expect(data.candles['1d']).toHaveLength(1);
    expect(data.candles['1w']).toHaveLength(1);
    expect(typeof data.fetchedAt).toBe('number');

    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(urls).toHaveLength(5);
    expect(urls.some((u) => u.includes('ticker/24hr') && u.includes('symbol=BTCUSDT'))).toBe(true);
    expect(urls.some((u) => u.includes('interval=1h') && u.includes('limit=250'))).toBe(true);
    expect(urls.some((u) => u.includes('interval=4h') && u.includes('limit=450'))).toBe(true);
    expect(urls.some((u) => u.includes('interval=1d') && u.includes('limit=300'))).toBe(true);
    expect(urls.some((u) => u.includes('interval=1w') && u.includes('limit=250'))).toBe(true);

    // Second call with forceRefresh=true bypasses cache for all 5 requests
    await fetchMultiTimeframeData('BTCUSDT', true);
    expect(fetchMock).toHaveBeenCalledTimes(10);
  });
});

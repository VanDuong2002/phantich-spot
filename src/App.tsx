import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { analyzeCoin } from './engine/analyze';
import { runQuickBacktest } from './engine/backtest';
import { analyzeNewsFeed } from './engine/newsAnalyzer';
import {
  runMarketScan,
  STABLECOIN_BASES,
  type ScanFilter,
  type ScanProgress,
} from './engine/scanner';
import {
  fetchMultiTimeframeData,
  fetchTicker24h,
  fetchTopUsdtSymbolsByVolume,
  fetchUsdtSymbols,
} from './services/binance';
import { fetchNewsBundle } from './services/news';
import { loadSettings, saveSettings } from './settings/storage';
import type {
  AnalysisReport,
  MultiTimeframeData,
  SettingsSchema,
  SymbolInfo,
  Ticker24h,
} from './types/market';
import type { NewsBundle, NewsFilter } from './types/news';
import { BacktestCard } from './ui/BacktestCard';
import { CoinNewsStrip } from './ui/CoinNewsStrip';
import { CoinSelectorBar } from './ui/CoinSelectorBar';
import { EditorialLead } from './ui/EditorialLead';
import { IndicatorMatrix } from './ui/IndicatorMatrix';
import { Masthead, type AppTab } from './ui/Masthead';
import { MarketScanner } from './ui/MarketScanner';
import { NewsFeed } from './ui/NewsFeed';
import { PriceChart } from './ui/PriceChart';
import { SettingsDrawer } from './ui/SettingsDrawer';

const NEWS_REFRESH_INTERVAL_MS = 3 * 60 * 1000;

function readScannerTopN(settings: SettingsSchema): number {
  const scannerExt = settings.extensions?.scanner as { topN?: unknown } | undefined;
  const n = scannerExt?.topN;
  if (n === 20 || n === 30 || n === 50) return n;
  return 30;
}

function EditorialSkeleton() {
  return (
    <div aria-busy="true" aria-label="Đang tải dữ liệu thị trường" className="py-6 animate-pulse">
      <div className="grid grid-cols-1 gap-6 border-b border-[#D6D0C4] pb-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-7 lg:border-r lg:border-[#D6D0C4] lg:pr-7">
          <div className="flex items-center gap-3">
            <div className="h-5 w-20 bg-[#E5DFD3]" />
            <div className="h-4 w-32 bg-[#E5DFD3]" />
          </div>
          <div className="h-8 w-5/6 bg-[#E5DFD3]" />
          <div className="h-8 w-2/3 bg-[#E5DFD3]" />
          <div className="space-y-2 pt-2">
            <div className="h-4 w-full bg-[#EAE5DA]" />
            <div className="h-4 w-11/12 bg-[#EAE5DA]" />
            <div className="h-4 w-4/5 bg-[#EAE5DA]" />
          </div>
        </div>
        <div className="space-y-4 lg:col-span-5 lg:pl-7">
          <div className="h-52 border border-[#D6D0C4] bg-[#F3EFE6]" />
          <div className="grid grid-cols-4 gap-px border border-[#D6D0C4] bg-[#D6D0C4]">
            <div className="h-16 bg-[#F3EFE6]" />
            <div className="h-16 bg-[#F3EFE6]" />
            <div className="h-16 bg-[#F3EFE6]" />
            <div className="h-16 bg-[#F3EFE6]" />
          </div>
        </div>
      </div>
      <div className="mt-6 h-[380px] border border-[#D6D0C4] bg-[#F3EFE6]" />
    </div>
  );
}

export default function App() {
  const [settings, setSettings] = useState<SettingsSchema>(() => loadSettings());
  const [activeTab, setActiveTab] = useState<AppTab>('detail');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState<string>(
    () => settings.watchlist[0] ?? 'BTCUSDT',
  );
  const [symbols, setSymbols] = useState<SymbolInfo[]>([]);
  const [tickers, setTickers] = useState<Record<string, Ticker24h>>({});
  const [marketData, setMarketData] = useState<MultiTimeframeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Market Scanner state
  const [scanFilter, setScanFilter] = useState<ScanFilter>('ALL');
  const [scanResults, setScanResults] = useState<AnalysisReport[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  // News & FED Calendar state
  const [newsBundle, setNewsBundle] = useState<NewsBundle | null>(null);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsError, setNewsError] = useState<string | null>(null);
  const [newsInitialFilter, setNewsInitialFilter] = useState<NewsFilter>('ALL');

  const requestSeqRef = useRef(0);
  const scanAbortRef = useRef<AbortController | null>(null);

  const scannerTopN = readScannerTopN(settings);

  const updateSettings = useCallback((updater: (prev: SettingsSchema) => SettingsSchema) => {
    setSettings((prev) => {
      const next = updater(prev);
      saveSettings(next);
      return next;
    });
  }, []);

  const activeMode = useMemo(() => {
    return (
      settings.modes.find((mode) => mode.id === settings.activeModeId) ??
      settings.modes[0]
    );
  }, [settings.modes, settings.activeModeId]);

  const loadMarketData = useCallback(async (symbol: string, forceRefresh = false) => {
    const seq = ++requestSeqRef.current;
    if (forceRefresh) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const data = await fetchMultiTimeframeData(symbol, forceRefresh);
      if (seq !== requestSeqRef.current) return;

      setMarketData(data);
      setTickers((prev) => ({
        ...prev,
        [data.symbol]: data.ticker,
      }));
    } catch (err) {
      if (seq !== requestSeqRef.current) return;
      const detail = err instanceof Error ? err.message : 'Lỗi kết nối không xác định';
      setError(
        `Không thể tải dữ liệu thị trường cho ${symbol} từ Binance (${detail}). Vui lòng kiểm tra kết nối mạng và thử lại.`,
      );
    } finally {
      if (seq === requestSeqRef.current) {
        setLoading(false);
        setIsRefreshing(false);
      }
    }
  }, []);

  // Load selected coin multi-timeframe data
  useEffect(() => {
    void loadMarketData(selectedSymbol, false);
  }, [selectedSymbol, loadMarketData]);

  // Load tradable USDT pairs once
  useEffect(() => {
    let cancelled = false;
    fetchUsdtSymbols()
      .then((list) => {
        if (!cancelled) setSymbols(list);
      })
      .catch(() => {
        // Non-blocking: search falls back to watchlist & direct entry
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Load 24h tickers for watchlist badges
  useEffect(() => {
    let cancelled = false;
    const list = settings.watchlist;
    if (list.length === 0) return;

    Promise.allSettled(list.map((sym) => fetchTicker24h(sym))).then((results) => {
      if (cancelled) return;
      setTickers((prev) => {
        const next = { ...prev };
        for (const res of results) {
          if (res.status === 'fulfilled') {
            next[res.value.symbol] = res.value;
          }
        }
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [settings.watchlist]);

  const handleSelectMode = useCallback(
    (modeId: string) => {
      updateSettings((prev) => ({
        ...prev,
        activeModeId: modeId,
      }));
    },
    [updateSettings],
  );

  const handleSettingsChange = useCallback(
    (next: SettingsSchema) => {
      updateSettings(() => next);
    },
    [updateSettings],
  );

  const handleToggleWatchlist = useCallback(
    (symbol: string) => {
      updateSettings((prev) => {
        const exists = prev.watchlist.includes(symbol);
        const watchlist = exists
          ? prev.watchlist.filter((s) => s !== symbol)
          : [symbol, ...prev.watchlist];
        return { ...prev, watchlist };
      });
    },
    [updateSettings],
  );

  const handleChangeScannerTopN = useCallback(
    (topN: number) => {
      updateSettings((prev) => ({
        ...prev,
        extensions: {
          ...prev.extensions,
          scanner: {
            ...((prev.extensions?.scanner as Record<string, unknown> | undefined) ?? {}),
            topN,
          },
        },
      }));
    },
    [updateSettings],
  );

  const handleStopScan = useCallback(() => {
    scanAbortRef.current?.abort();
    scanAbortRef.current = null;
    setIsScanning(false);
  }, []);

  const handleStartScan = useCallback(async () => {
    if (!activeMode) return;
    scanAbortRef.current?.abort();
    const controller = new AbortController();
    scanAbortRef.current = controller;

    setIsScanning(true);
    setScanError(null);
    setScanProgress({ completed: 0, total: scannerTopN, currentSymbol: '', failedCount: 0 });

    try {
      const topTickers = await fetchTopUsdtSymbolsByVolume(scannerTopN, STABLECOIN_BASES);
      if (controller.signal.aborted) return;

      const targetSymbols = topTickers.map((t) => t.symbol);
      setScanProgress({
        completed: 0,
        total: targetSymbols.length,
        currentSymbol: targetSymbols[0] ?? '',
        failedCount: 0,
      });

      const finalResults = await runMarketScan(
        targetSymbols,
        activeMode,
        (sym) => fetchMultiTimeframeData(sym, false),
        {
          concurrency: 5,
          signal: controller.signal,
          onProgress: (progress, partial) => {
            setScanProgress(progress);
            setScanResults(partial);
          },
        },
      );

      if (!controller.signal.aborted) {
        setScanResults(finalResults);
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        const detail = err instanceof Error ? err.message : 'Lỗi kết nối không xác định';
        setScanError(`Không thể tải danh sách quét từ Binance (${detail}). Vui lòng thử lại.`);
      }
    } finally {
      if (scanAbortRef.current === controller) {
        scanAbortRef.current = null;
        setIsScanning(false);
      }
    }
  }, [activeMode, scannerTopN]);

  useEffect(() => {
    return () => {
      scanAbortRef.current?.abort();
    };
  }, []);

  const handleSelectCoinFromScanner = useCallback((symbol: string) => {
    setSelectedSymbol(symbol);
    setActiveTab('detail');
  }, []);

  const loadNews = useCallback(async () => {
    setNewsLoading(true);
    setNewsError(null);
    try {
      const bundle = await fetchNewsBundle();
      setNewsBundle(bundle);
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Lỗi kết nối';
      setNewsError(`Không thể tải bản tin thị trường (${detail}). Vui lòng thử lại.`);
    } finally {
      setNewsLoading(false);
    }
  }, []);

  // Load news on mount and auto-refresh every 3 minutes
  useEffect(() => {
    void loadNews();
    const timer = window.setInterval(() => {
      void loadNews();
    }, NEWS_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [loadNews]);

  const analyzedNews = useMemo(() => {
    if (!newsBundle) return [];
    return analyzeNewsFeed(newsBundle.rawNews).items;
  }, [newsBundle]);

  const upcomingRedEventCount = useMemo(() => {
    if (!newsBundle) return 0;
    const now = Date.now();
    return newsBundle.calendar.filter(
      (ev) => ev.impact === 'High' && ev.timestampMs > now,
    ).length;
  }, [newsBundle]);

  const handleOpenNewsForCoin = useCallback(() => {
    setNewsInitialFilter('SELECTED_COIN');
    setActiveTab('news');
  }, []);

  const handleRefresh = useCallback(() => {
    if (activeTab === 'scanner') {
      void handleStartScan();
      return;
    }
    if (activeTab === 'news') {
      void loadNews();
      return;
    }
    void loadMarketData(selectedSymbol, true);
  }, [activeTab, handleStartScan, loadNews, selectedSymbol, loadMarketData]);

  const scannerBuyCount = useMemo(
    () => scanResults.filter((r) => r.verdict === 'MUA').length,
    [scanResults],
  );

  const report = useMemo(() => {
    if (!marketData || !activeMode) return null;
    return analyzeCoin(marketData, activeMode);
  }, [marketData, activeMode]);

  const backtest = useMemo(() => {
    if (!marketData || !activeMode) return null;
    return runQuickBacktest(
      marketData.candles['4h'],
      marketData.candles['1d'],
      activeMode,
    );
  }, [marketData, activeMode]);

  return (
    <div
      data-settings-open={settingsOpen ? 'true' : 'false'}
      className="min-h-screen bg-[#FAF7F0] text-[#1C1917]"
    >
      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 lg:px-8">
        <Masthead
          modes={settings.modes}
          activeModeId={settings.activeModeId}
          activeTab={activeTab}
          scannerBuyCount={scannerBuyCount}
          upcomingRedEventCount={upcomingRedEventCount}
          onSelectTab={(tab) => {
            if (tab === 'news') setNewsInitialFilter('ALL');
            setActiveTab(tab);
          }}
          onSelectMode={handleSelectMode}
          onRefresh={handleRefresh}
          onOpenSettings={() => setSettingsOpen(true)}
          fetchedAt={
            activeTab === 'news'
              ? (newsBundle?.fetchedAt ?? null)
              : (marketData?.fetchedAt ?? null)
          }
          isRefreshing={
            activeTab === 'scanner'
              ? isScanning
              : activeTab === 'news'
                ? newsLoading
                : isRefreshing
          }
        />

        {activeTab === 'detail' ? (
          <>
            <CoinSelectorBar
              selectedSymbol={selectedSymbol}
              symbols={symbols}
              watchlist={settings.watchlist}
              tickers={tickers}
              onSelectSymbol={setSelectedSymbol}
              onToggleWatchlist={handleToggleWatchlist}
            />

            {error && (
              <div
                role="alert"
                className="mt-4 flex flex-col gap-3 border border-[#B91C1C] border-l-4 bg-[#F3EFE6] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-2.5 text-sm text-[#1C1917]">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#B91C1C]" />
                  <span>{error}</span>
                </div>
                <button
                  type="button"
                  onClick={() => void loadMarketData(selectedSymbol, true)}
                  className="inline-flex shrink-0 items-center gap-1.5 border border-[#B91C1C] bg-[#B91C1C] px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-[#FAF7F0] transition-opacity hover:opacity-90 cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Thử lại</span>
                </button>
              </div>
            )}

            <main>
              {loading && (!marketData || marketData.symbol !== selectedSymbol) ? (
                <EditorialSkeleton />
              ) : report && marketData && backtest ? (
                <>
                  <EditorialLead report={report} />
                  <PriceChart
                    candlesByTf={marketData.candles}
                    report={report}
                    emaPeriods={{
                      fast: activeMode.params.emaFast,
                      mid: activeMode.params.emaMid,
                      slow: activeMode.params.emaSlow,
                    }}
                  />
                  <IndicatorMatrix timeframes={report.timeframes} />
                  <BacktestCard result={backtest} modeName={activeMode.name} />
                  <CoinNewsStrip
                    selectedSymbol={selectedSymbol}
                    items={analyzedNews}
                    onOpenNewsTab={handleOpenNewsForCoin}
                  />
                </>
              ) : null}
            </main>
          </>
        ) : activeTab === 'scanner' ? (
          <main>
            <MarketScanner
              activeMode={activeMode}
              topN={scannerTopN}
              onChangeTopN={handleChangeScannerTopN}
              filter={scanFilter}
              onChangeFilter={setScanFilter}
              results={scanResults}
              isScanning={isScanning}
              progress={scanProgress}
              error={scanError}
              onStartScan={() => void handleStartScan()}
              onStopScan={handleStopScan}
              onSelectCoin={handleSelectCoinFromScanner}
            />
          </main>
        ) : (
          <main>
            <NewsFeed
              key={newsInitialFilter}
              selectedSymbol={selectedSymbol}
              items={analyzedNews}
              calendar={newsBundle?.calendar ?? []}
              fearGreed={newsBundle?.fearGreed ?? null}
              fetchedAt={newsBundle?.fetchedAt ?? null}
              loading={newsLoading}
              error={newsError}
              initialFilter={newsInitialFilter}
              onRefresh={() => void loadNews()}
              onSelectCoin={handleSelectCoinFromScanner}
            />
          </main>
        )}

        <footer className="editorial-double-top mt-4 pt-3 pb-6 text-center text-[11px] text-[#57534E]">
          PhanTich Spot · Dữ liệu công khai từ Binance Spot API · Nội dung phân tích kỹ thuật tự động chỉ mang tính tham khảo, không phải khuyến nghị đầu tư tài chính.
        </footer>
      </div>

      <SettingsDrawer
        open={settingsOpen}
        settings={settings}
        onChange={handleSettingsChange}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}

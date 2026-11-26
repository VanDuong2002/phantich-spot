import type { AnalysisMode, AnalysisReport, MultiTimeframeData, Verdict } from '../types/market';
import { analyzeCoin } from './analyze';

export const STABLECOIN_BASES: ReadonlySet<string> = new Set([
  'USDC',
  'FDUSD',
  'TUSD',
  'USDE',
  'DAI',
  'BUSD',
  'EUR',
  'EURI',
  'USDP',
  'USD1',
  'RLUSD',
  'BFUSD',
  'AEUR',
  'USDT',
  'PAX',
  'USTC',
  'XUSD',
]);

export type ScanFilter = 'ALL' | 'MUA' | 'MUA_GIU';

export interface ScanProgress {
  completed: number;
  total: number;
  currentSymbol: string;
  failedCount: number;
}

export interface RunMarketScanOptions {
  concurrency?: number;
  signal?: AbortSignal;
  onProgress?: (progress: ScanProgress, partialResults: AnalysisReport[]) => void;
}

const VERDICT_RANK: Record<Verdict, number> = {
  MUA: 0,
  GIU: 1,
  DUNG_NGOAI: 2,
  BAN: 3,
};

/**
 * Sorts scan results by verdict priority (MUA -> GIU -> DUNG_NGOAI -> BAN),
 * then by descending composite score.
 */
export function sortScanResults(reports: AnalysisReport[]): AnalysisReport[] {
  return [...reports].sort((a, b) => {
    const rankDiff = VERDICT_RANK[a.verdict] - VERDICT_RANK[b.verdict];
    if (rankDiff !== 0) return rankDiff;
    return b.score - a.score;
  });
}

/**
 * Filters scan results according to the selected quick filter.
 */
export function filterScanResults(
  reports: AnalysisReport[],
  filter: ScanFilter,
): AnalysisReport[] {
  if (filter === 'MUA') {
    return reports.filter((r) => r.verdict === 'MUA');
  }
  if (filter === 'MUA_GIU') {
    return reports.filter((r) => r.verdict === 'MUA' || r.verdict === 'GIU');
  }
  return reports;
}

/**
 * Scans a list of symbols concurrently in small batches using the pure analyzeCoin engine.
 * Skips individual symbol failures cleanly and supports cancellation via AbortSignal.
 */
export async function runMarketScan(
  symbols: string[],
  mode: AnalysisMode,
  fetcher: (symbol: string) => Promise<MultiTimeframeData>,
  options: RunMarketScanOptions = {},
): Promise<AnalysisReport[]> {
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 5, 10));
  const { signal, onProgress } = options;
  const total = symbols.length;
  const results: AnalysisReport[] = [];
  let completed = 0;
  let failedCount = 0;
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < total) {
      if (signal?.aborted) return;
      const idx = nextIndex++;
      const symbol = symbols[idx];
      try {
        const data = await fetcher(symbol);
        if (signal?.aborted) return;
        const report = analyzeCoin(data, mode);
        results.push(report);
      } catch {
        failedCount += 1;
      } finally {
        completed += 1;
        if (!signal?.aborted) {
          onProgress?.(
            { completed, total, currentSymbol: symbol, failedCount },
            sortScanResults(results),
          );
        }
      }
    }
  }

  const workerCount = Math.min(concurrency, total);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return sortScanResults(results);
}

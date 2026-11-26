import { ArrowUpRight, Play, Radar, Square } from 'lucide-react';
import type { ScanFilter, ScanProgress } from '../engine/scanner';
import { filterScanResults } from '../engine/scanner';
import type { AnalysisMode, AnalysisReport, Timeframe, Verdict } from '../types/market';
import { formatPercent, formatPrice } from '../utils/format';

export interface MarketScannerProps {
  activeMode: AnalysisMode;
  topN: number;
  onChangeTopN: (topN: number) => void;
  filter: ScanFilter;
  onChangeFilter: (filter: ScanFilter) => void;
  results: AnalysisReport[];
  isScanning: boolean;
  progress: ScanProgress | null;
  error: string | null;
  onStartScan: () => void;
  onStopScan: () => void;
  onSelectCoin: (symbol: string) => void;
}

const TOP_N_OPTIONS = [20, 30, 50] as const;

const FILTER_OPTIONS: { id: ScanFilter; label: string }[] = [
  { id: 'ALL', label: 'Tất cả' },
  { id: 'MUA', label: 'Chỉ MUA' },
  { id: 'MUA_GIU', label: 'MUA & GIỮ' },
];

const VERDICT_BADGE: Record<Verdict, { label: string; cls: string }> = {
  MUA: { label: 'MUA', cls: 'bg-[#15803D] text-[#FAF7F0] border-[#15803D]' },
  GIU: { label: 'GIỮ', cls: 'bg-[#B45309] text-[#FAF7F0] border-[#B45309]' },
  BAN: { label: 'BÁN', cls: 'bg-[#B91C1C] text-[#FAF7F0] border-[#B91C1C]' },
  DUNG_NGOAI: { label: 'ĐỨNG NGOÀI', cls: 'bg-[#475569] text-[#FAF7F0] border-[#475569]' },
};

const TF_ORDER: Timeframe[] = ['1w', '1d', '4h', '1h'];

function formatPair(symbol: string): string {
  return symbol.endsWith('USDT') && symbol.length > 4
    ? `${symbol.slice(0, -4)}/USDT`
    : symbol;
}

function trendArrow(trend: 'UP' | 'DOWN' | 'NEUTRAL'): { char: string; cls: string } {
  if (trend === 'UP') return { char: '▲', cls: 'text-[#15803D]' };
  if (trend === 'DOWN') return { char: '▼', cls: 'text-[#B91C1C]' };
  return { char: '●', cls: 'text-[#57534E]' };
}

export function MarketScanner({
  activeMode,
  topN,
  onChangeTopN,
  filter,
  onChangeFilter,
  results,
  isScanning,
  progress,
  error,
  onStartScan,
  onStopScan,
  onSelectCoin,
}: MarketScannerProps) {
  const filtered = filterScanResults(results, filter);

  const counts = {
    MUA: results.filter((r) => r.verdict === 'MUA').length,
    GIU: results.filter((r) => r.verdict === 'GIU').length,
    DUNG_NGOAI: results.filter((r) => r.verdict === 'DUNG_NGOAI').length,
    BAN: results.filter((r) => r.verdict === 'BAN').length,
  };

  const progressPct =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.completed / progress.total) * 100))
      : 0;

  return (
    <section aria-label="Máy quét coin nên mua" className="py-6">
      {/* Header & Controls */}
      <div className="flex flex-col gap-4 border-b border-[#D6D0C4] pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#57534E]">
            Bản tin thị trường · Chế độ {activeMode.name}
          </div>
          <h2 className="font-serif-editorial mt-1 text-2xl font-bold text-[#1C1917]">
            Quét coin nên mua theo thanh khoản Binance Spot
          </h2>
          <p className="mt-1 text-xs text-[#57534E]">
            Tự động lọc bỏ stablecoin, lấy Top cặp /USDT có khối lượng 24h cao nhất và chấm điểm đa khung 1W · 1D · 4H · 1H.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Top N selector */}
          <div
            role="group"
            aria-label="Phạm vi quét"
            className="inline-flex border border-[#D6D0C4] bg-[#F3EFE6]"
          >
            {TOP_N_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                disabled={isScanning}
                onClick={() => onChangeTopN(n)}
                className={`px-2.5 py-1.5 font-mono-tabular text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 ${
                  topN === n
                    ? 'bg-[#1C1917] text-[#FAF7F0]'
                    : 'text-[#57534E] hover:text-[#1C1917]'
                }`}
              >
                Top {n}
              </button>
            ))}
          </div>

          {isScanning ? (
            <button
              type="button"
              onClick={onStopScan}
              className="inline-flex items-center gap-1.5 border border-[#B91C1C] bg-[#B91C1C] px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-[#FAF7F0] transition-opacity hover:opacity-90 cursor-pointer"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
              <span>Dừng quét</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onStartScan}
              className="inline-flex items-center gap-1.5 border border-[#15803D] bg-[#15803D] px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-[#FAF7F0] transition-opacity hover:opacity-90 cursor-pointer"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>{results.length > 0 ? 'Quét lại' : 'Quét ngay'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {isScanning && progress && (
        <div className="mt-4 border border-[#D6D0C4] bg-[#F3EFE6] px-4 py-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-[#1C1917]">
              Đang phân tích {progress.completed}/{progress.total} coin
              {progress.currentSymbol ? ` (${formatPair(progress.currentSymbol)})` : ''}…
            </span>
            <span className="font-mono-tabular font-bold text-[#1C1917]">{progressPct}%</span>
          </div>
          <div className="mt-2 h-1.5 w-full bg-[#D6D0C4]">
            <div
              className="h-full bg-[#1C1917] transition-all duration-200"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          role="alert"
          className="mt-4 border border-[#B91C1C] border-l-4 bg-[#F3EFE6] px-4 py-3 text-sm text-[#1C1917]"
        >
          {error}
        </div>
      )}

      {/* Summary & Quick Filter Strip */}
      {results.length > 0 && (
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="text-[#57534E]">
              Đã quét <strong className="font-mono-tabular text-[#1C1917]">{results.length}</strong> coin:
            </span>
            <span className="font-mono-tabular font-bold text-[#15803D]">
              MUA: {counts.MUA}
            </span>
            <span className="font-mono-tabular font-semibold text-[#B45309]">
              GIỮ: {counts.GIU}
            </span>
            <span className="font-mono-tabular text-[#475569]">
              ĐỨNG NGOÀI: {counts.DUNG_NGOAI}
            </span>
            <span className="font-mono-tabular text-[#B91C1C]">
              BÁN: {counts.BAN}
            </span>
          </div>

          <div
            role="group"
            aria-label="Lọc kết quả quét"
            className="inline-flex border border-[#D6D0C4] bg-[#F3EFE6]"
          >
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onChangeFilter(opt.id)}
                className={`px-3 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                  filter === opt.id
                    ? 'bg-[#1C1917] text-[#FAF7F0]'
                    : 'text-[#57534E] hover:text-[#1C1917]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty State before first scan */}
      {!isScanning && results.length === 0 && !error && (
        <div className="mt-6 border border-[#D6D0C4] bg-[#F3EFE6] px-6 py-10 text-center">
          <Radar className="mx-auto h-8 w-8 text-[#57534E]" />
          <h3 className="font-serif-editorial mt-3 text-lg font-bold text-[#1C1917]">
            Sẵn sàng quét Top {topN} coin thanh khoản cao nhất
          </h3>
          <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-[#57534E]">
            Hệ thống sẽ tải dữ liệu 4 khung (1W, 1D, 4H, 1H) từ Binance và chấm điểm theo chế độ{' '}
            <strong className="text-[#1C1917]">{activeMode.name}</strong> để lọc ra các đồng coin có điểm mua đẹp nhất.
          </p>
          <button
            type="button"
            onClick={onStartScan}
            className="mt-4 inline-flex items-center gap-1.5 border border-[#15803D] bg-[#15803D] px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[#FAF7F0] transition-opacity hover:opacity-90 cursor-pointer"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            <span>Bắt đầu quét Top {topN} coin</span>
          </button>
        </div>
      )}

      {/* Filtered Empty State */}
      {results.length > 0 && filtered.length === 0 && (
        <div className="mt-4 border border-[#D6D0C4] bg-[#F3EFE6] px-5 py-8 text-center text-sm text-[#57534E]">
          Hiện chưa có coin nào trong Top {topN} đạt trạng thái{' '}
          <strong className="text-[#1C1917]">
            {filter === 'MUA' ? 'MUA' : 'MUA & GIỮ'}
          </strong>{' '}
          theo chế độ <strong className="text-[#1C1917]">{activeMode.name}</strong>. Bạn có thể chuyển bộ lọc sang{' '}
          <strong>Tất cả</strong> để xem bảng xếp hạng đầy đủ.
        </div>
      )}

      {/* Results Table */}
      {filtered.length > 0 && (
        <div className="mt-4 overflow-x-auto border border-[#D6D0C4]">
          <table className="w-full min-w-[740px] border-collapse bg-[#FAF7F0] text-left text-xs">
            <thead>
              <tr className="border-b border-[#1C1917] bg-[#F3EFE6] text-[10px] font-bold uppercase tracking-[0.12em] text-[#57534E]">
                <th className="px-3 py-2.5">Coin</th>
                <th className="px-3 py-2.5 text-right">Giá · 24h</th>
                <th className="px-3 py-2.5 text-center">Khuyến nghị</th>
                <th className="px-3 py-2.5 text-right">Điểm</th>
                <th className="px-3 py-2.5 text-center">4 khung (1W·1D·4H·1H)</th>
                <th className="px-3 py-2.5">Vùng mua / Hỗ trợ</th>
                <th className="px-3 py-2.5 text-right">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D6D0C4]">
              {filtered.map((item) => {
                const badge = VERDICT_BADGE[item.verdict];
                const isUp = item.priceChangePercent24h >= 0;

                return (
                  <tr
                    key={item.symbol}
                    className="transition-colors hover:bg-[#F3EFE6]/80"
                  >
                    <td className="px-3 py-2.5 font-mono-tabular font-bold text-[#1C1917]">
                      {formatPair(item.symbol)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono-tabular">
                      <div className="font-semibold text-[#1C1917]">
                        ${formatPrice(item.currentPrice)}
                      </div>
                      <div
                        className={`text-[11px] font-semibold ${
                          isUp ? 'text-[#15803D]' : 'text-[#B91C1C]'
                        }`}
                      >
                        {formatPercent(item.priceChangePercent24h, true)}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span
                        className={`inline-block border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badge.cls}`}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono-tabular font-bold text-[#1C1917]">
                      {item.score.toFixed(1)}
                      <span className="text-[10px] font-normal text-[#57534E]">/100</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-center gap-1.5 font-mono-tabular text-[11px]">
                        {TF_ORDER.map((tf) => {
                          const arrow = trendArrow(item.timeframes[tf].trend);
                          return (
                            <span
                              key={tf}
                              title={`${tf.toUpperCase()}: ${Math.round(item.timeframes[tf].score)}`}
                              className="inline-flex items-center gap-0.5 border border-[#D6D0C4] bg-[#FAF7F0] px-1.5 py-0.5"
                            >
                              <span className="text-[9px] uppercase text-[#57534E]">{tf}</span>
                              <span className={arrow.cls}>{arrow.char}</span>
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 font-mono-tabular text-[11px]">
                      {item.tradePlan ? (
                        <div>
                          <div className="font-semibold text-[#15803D]">
                            Mua ${formatPrice(item.tradePlan.entryLow)} – ${formatPrice(item.tradePlan.entryHigh)}
                          </div>
                          <div className="text-[#57534E]">
                            SL ${formatPrice(item.tradePlan.stopLoss)} · R:R 1:{item.tradePlan.riskReward.toFixed(1)}
                          </div>
                        </div>
                      ) : (
                        <div className="text-[#57534E]">
                          HT ${formatPrice(item.referenceLevels.nearestSupport)} · KC ${formatPrice(item.referenceLevels.nearestResistance)}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => onSelectCoin(item.symbol)}
                        className="inline-flex items-center gap-1 border border-[#1C1917] bg-[#FAF7F0] px-2.5 py-1 text-[11px] font-semibold text-[#1C1917] transition-colors hover:bg-[#1C1917] hover:text-[#FAF7F0] cursor-pointer"
                      >
                        <span>Xem</span>
                        <ArrowUpRight className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

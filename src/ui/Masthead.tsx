import { Newspaper, Radar, RefreshCw, SlidersHorizontal } from 'lucide-react';
import type { AnalysisMode } from '../types/market';
import { formatDateTimeVi } from '../utils/format';

export type AppTab = 'detail' | 'scanner';

export interface MastheadProps {
  modes: AnalysisMode[];
  activeModeId: string;
  activeTab: AppTab;
  scannerBuyCount?: number;
  onSelectTab: (tab: AppTab) => void;
  onSelectMode: (modeId: string) => void;
  onRefresh: () => void;
  onOpenSettings: () => void;
  fetchedAt: number | null;
  isRefreshing: boolean;
}

export function Masthead({
  modes,
  activeModeId,
  activeTab,
  scannerBuyCount = 0,
  onSelectTab,
  onSelectMode,
  onRefresh,
  onOpenSettings,
  fetchedAt,
  isRefreshing,
}: MastheadProps) {
  const displayTime = formatDateTimeVi(fetchedAt ?? Date.now());

  return (
    <header className="editorial-double-top editorial-double-bottom bg-[#FAF7F0] pt-3 pb-3">
      {/* Top dateline strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D6D0C4] pb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-[#57534E]">
        <span>Phân tích Kỹ thuật Crypto Spot · Dữ liệu Binance</span>
        <span className="font-mono-tabular text-[#1C1917]">{displayTime}</span>
      </div>

      {/* Main masthead title + controls */}
      <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-serif-editorial text-2xl font-bold tracking-[0.06em] text-[#1C1917] sm:text-3xl lg:text-4xl">
            BẢN TIN NHẬN ĐỊNH
          </h1>
          <p className="mt-0.5 text-xs text-[#57534E]">
            Tổng hợp xu hướng đa khung 1W · 1D · 4H · 1H &amp; Kế hoạch giao dịch Spot có kỷ luật
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 border border-[#D6D0C4] bg-[#F3EFE6] px-2.5 py-1.5 text-xs text-[#57534E]">
            <span className="font-medium uppercase tracking-wider">Chế độ</span>
            <select
              aria-label="Chọn chế độ phân tích"
              value={activeModeId}
              onChange={(e) => onSelectMode(e.target.value)}
              className="bg-transparent font-semibold text-[#1C1917] focus:outline-none cursor-pointer"
            >
              {modes.map((mode) => (
                <option key={mode.id} value={mode.id}>
                  {mode.name}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 border border-[#1C1917] bg-[#FAF7F0] px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-[#1C1917] transition-colors hover:bg-[#1C1917] hover:text-[#FAF7F0] disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            className="inline-flex items-center gap-1.5 border border-[#D6D0C4] bg-[#F3EFE6] px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-[#1C1917] transition-colors hover:border-[#1C1917] cursor-pointer"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>Cài đặt</span>
          </button>
        </div>
      </div>

      {/* Editorial Navigation Tabs */}
      <nav
        aria-label="Điều hướng chính"
        className="mt-3 flex items-center gap-1 border-t border-[#D6D0C4] pt-2.5"
      >
        <button
          type="button"
          onClick={() => onSelectTab('detail')}
          aria-current={activeTab === 'detail' ? 'page' : undefined}
          className={`inline-flex items-center gap-1.5 border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer ${
            activeTab === 'detail'
              ? 'border-[#1C1917] bg-[#1C1917] text-[#FAF7F0]'
              : 'border-transparent bg-transparent text-[#57534E] hover:border-[#D6D0C4] hover:bg-[#F3EFE6] hover:text-[#1C1917]'
          }`}
        >
          <Newspaper className="h-3.5 w-3.5" />
          <span>Phân tích chi tiết</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('scanner')}
          aria-current={activeTab === 'scanner' ? 'page' : undefined}
          className={`inline-flex items-center gap-1.5 border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer ${
            activeTab === 'scanner'
              ? 'border-[#1C1917] bg-[#1C1917] text-[#FAF7F0]'
              : 'border-transparent bg-transparent text-[#57534E] hover:border-[#D6D0C4] hover:bg-[#F3EFE6] hover:text-[#1C1917]'
          }`}
        >
          <Radar className="h-3.5 w-3.5" />
          <span>Quét coin nên mua</span>
          {scannerBuyCount > 0 && (
            <span className="ml-0.5 rounded-none bg-[#15803D] px-1.5 py-0.5 font-mono-tabular text-[10px] font-bold text-[#FAF7F0]">
              {scannerBuyCount}
            </span>
          )}
        </button>
      </nav>
    </header>
  );
}

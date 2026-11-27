import { useMemo, useState } from 'react';
import {
  Bookmark,
  CalendarClock,
  Clock,
  ExternalLink,
  Flame,
  RefreshCw,
  Search,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import {
  buildDailyNewsDigest,
  filterNewsItems,
  summarizeNewsSentiment,
} from '../engine/newsAnalyzer';
import type {
  AnalyzedNewsItem,
  FearGreedIndex,
  MacroEvent,
  NewsFilter,
  NewsSentiment,
  NewsTimeRange,
} from '../types/news';
import { formatDateTimeVi } from '../utils/format';

export interface NewsFeedProps {
  selectedSymbol: string;
  items: AnalyzedNewsItem[];
  pinnedIds: string[];
  onTogglePin: (newsId: string) => void;
  calendar: MacroEvent[];
  fearGreed: FearGreedIndex | null;
  fetchedAt: number | null;
  loading: boolean;
  error: string | null;
  initialFilter?: NewsFilter;
  onRefresh: () => void;
  onSelectCoin: (symbol: string) => void;
}

const SENTIMENT_META: Record<
  NewsSentiment,
  { label: string; badgeCls: string }
> = {
  BULLISH: {
    label: 'Tác động TĂNG',
    badgeCls: 'border-[#15803D] bg-[#15803D] text-[#FAF7F0]',
  },
  BEARISH: {
    label: 'Tác động GIẢM',
    badgeCls: 'border-[#B91C1C] bg-[#B91C1C] text-[#FAF7F0]',
  },
  NEUTRAL: {
    label: 'Trung tính',
    badgeCls: 'border-[#475569] bg-[#475569] text-[#FAF7F0]',
  },
};

function formatTimeAgoVi(timestampMs: number): string {
  const diffMin = Math.max(0, Math.floor((Date.now() - timestampMs) / 60_000));
  if (diffMin < 1) return 'Vừa xong';
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} giờ trước`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay} ngày trước`;
}

function formatCountdownVi(timestampMs: number): { text: string; isUpcoming: boolean } {
  const diffMs = timestampMs - Date.now();
  if (diffMs <= 0) {
    return { text: 'Đã công bố', isUpcoming: false };
  }
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return { text: `Sắp ra sau ${mins} phút`, isUpcoming: true };
  const hours = Math.floor(mins / 60);
  if (hours < 24) return { text: `Còn ${hours} giờ`, isUpcoming: true };
  const days = Math.floor(hours / 24);
  return { text: `Còn ${days} ngày`, isUpcoming: true };
}

export function NewsFeed({
  selectedSymbol,
  items,
  pinnedIds,
  onTogglePin,
  calendar,
  fearGreed,
  fetchedAt,
  loading,
  error,
  initialFilter = 'ALL',
  onRefresh,
  onSelectCoin,
}: NewsFeedProps) {
  const [filter, setFilter] = useState<NewsFilter>(initialFilter);
  const [timeRange, setTimeRange] = useState<NewsTimeRange>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyRedEvents, setOnlyRedEvents] = useState(false);

  const selectedBase = selectedSymbol.replace(/USDT$/i, '').toUpperCase();
  const pinnedSet = useMemo(() => new Set(pinnedIds), [pinnedIds]);

  const filteredItems = useMemo(
    () => filterNewsItems(items, filter, selectedBase, searchQuery, timeRange, pinnedIds),
    [items, filter, selectedBase, searchQuery, timeRange, pinnedIds],
  );

  const activeSummary = useMemo(() => {
    const scope =
      filter === 'SELECTED_COIN'
        ? selectedBase
        : filter === 'FED_MACRO'
          ? 'FED & Vĩ mô'
          : undefined;
    return summarizeNewsSentiment(filteredItems, scope);
  }, [filteredItems, filter, selectedBase]);

  const dailyDigest = useMemo(() => buildDailyNewsDigest(items), [items]);

  const visibleCalendar = useMemo(() => {
    if (!onlyRedEvents) return calendar;
    return calendar.filter((e) => e.impact === 'High' || e.isFomc);
  }, [calendar, onlyRedEvents]);

  const highImpactUpcomingCount = useMemo(
    () => calendar.filter((e) => e.impact === 'High' && e.timestampMs > Date.now()).length,
    [calendar],
  );

  const outlookBadge =
    activeSummary.outlook === 'TANG'
      ? {
          label: 'NGHIÊNG TĂNG',
          cls: 'bg-[#15803D] text-[#FAF7F0] border-[#15803D]',
          scoreCls: 'text-[#15803D]',
          Icon: TrendingUp,
        }
      : activeSummary.outlook === 'GIAM'
        ? {
            label: 'NGHIÊNG GIẢM',
            cls: 'bg-[#B91C1C] text-[#FAF7F0] border-[#B91C1C]',
            scoreCls: 'text-[#B91C1C]',
            Icon: TrendingDown,
          }
        : {
            label: 'TRUNG TÍNH',
            cls: 'bg-[#475569] text-[#FAF7F0] border-[#475569]',
            scoreCls: 'text-[#475569]',
            Icon: TrendingUp,
          };

  const filterButtons: { id: NewsFilter; label: string }[] = [
    { id: 'ALL', label: 'Tất cả thị trường' },
    { id: 'SELECTED_COIN', label: `Liên quan ${selectedBase}` },
    { id: 'FED_MACRO', label: 'FED & Vĩ mô' },
    { id: 'BULLISH', label: 'Tác động Tăng' },
    { id: 'BEARISH', label: 'Tác động Giảm' },
  ];

  const timeRangeButtons: { id: NewsTimeRange; label: string }[] = [
    { id: 'ALL', label: `Lưu trữ 7 ngày (${items.length})` },
    { id: '24H', label: '24 giờ qua' },
    { id: '3D', label: '3 ngày qua' },
    { id: 'PINNED', label: `Đã ghim (${pinnedIds.length})` },
  ];

  return (
    <section aria-label="Tin tức thị trường và Lịch tin đỏ FED" className="py-6">
      {/* Top Editorial News Synthesis Banner */}
      <div className="border border-[#D6D0C4] bg-[#F3EFE6] p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D6D0C4] pb-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <span
              className={`inline-flex items-center gap-1 border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.12em] ${outlookBadge.cls}`}
            >
              <outlookBadge.Icon className="h-3.5 w-3.5" />
              {outlookBadge.label}
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#57534E]">
              Lưu trữ đối chiếu 7 ngày · Tự động gộp tin mới mỗi 3 phút
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-[#57534E]">
            {fetchedAt && (
              <span className="font-mono-tabular">Cập nhật: {formatDateTimeVi(fetchedAt)}</span>
            )}
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="inline-flex items-center gap-1 border border-[#1C1917] bg-[#FAF7F0] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#1C1917] transition-colors hover:bg-[#1C1917] hover:text-[#FAF7F0] disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
              <span>Cập nhật</span>
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <h2 className="font-serif-editorial text-xl font-bold leading-snug text-[#1C1917] sm:text-2xl">
              {activeSummary.headlineVi}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#1C1917]/90">
              {activeSummary.summaryVi}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 border-t border-[#D6D0C4] pt-3 lg:col-span-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-5">
            <div className="border border-[#D6D0C4] bg-[#FAF7F0] p-2.5 text-center">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#57534E]">
                Tin Tăng / Giảm
              </div>
              <div className="font-mono-tabular mt-1 text-base font-bold">
                <span className="text-[#15803D]">{activeSummary.bullishCount}</span>
                <span className="mx-1 text-[#57534E]">/</span>
                <span className="text-[#B91C1C]">{activeSummary.bearishCount}</span>
              </div>
              <div className="text-[10px] text-[#57534E]">
                {activeSummary.neutralCount} trung tính
              </div>
            </div>

            <div className="border border-[#D6D0C4] bg-[#FAF7F0] p-2.5 text-center">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#57534E]">
                Điểm tin tức
              </div>
              <div className={`font-mono-tabular mt-1 text-base font-bold ${outlookBadge.scoreCls}`}>
                {activeSummary.score > 0 ? `+${activeSummary.score}` : activeSummary.score}
              </div>
              <div className="text-[10px] text-[#57534E]">Thang -100..+100</div>
            </div>

            <div className="border border-[#D6D0C4] bg-[#FAF7F0] p-2.5 text-center">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#57534E]">
                Fear &amp; Greed
              </div>
              <div className="font-mono-tabular mt-1 text-base font-bold text-[#1C1917]">
                {fearGreed ? fearGreed.value : '—'}
              </div>
              <div className="truncate text-[10px] text-[#57534E]">
                {fearGreed ? fearGreed.classificationVi : 'Đang tải'}
              </div>
            </div>
          </div>
        </div>

        {/* Daily Digest Strip for Cross-Day Comparison */}
        {dailyDigest.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#D6D0C4] pt-3 text-[11px]">
            <span className="inline-flex items-center gap-1 font-bold uppercase tracking-wider text-[#57534E]">
              <Clock className="h-3.5 w-3.5" />
              Đối chiếu theo ngày:
            </span>
            {dailyDigest.map((day) => (
              <span
                key={day.dateKey}
                className="inline-flex items-center gap-1.5 border border-[#D6D0C4] bg-[#FAF7F0] px-2 py-0.5 font-mono-tabular"
              >
                <strong className="text-[#1C1917]">{day.dateKey}</strong>
                <span className="text-[#57534E]">{day.total} tin</span>
                <span className="text-[#15803D]">{day.bullish}↑</span>
                <span className="text-[#B91C1C]">{day.bearish}↓</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="mt-4 border border-[#B91C1C] border-l-4 bg-[#F3EFE6] px-4 py-3 text-sm text-[#1C1917]"
        >
          {error}
        </div>
      )}

      {/* Main 2-column Editorial Layout: News Feed (Left) + FED / Red Macro Calendar (Right) */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column (7/12): Filtered Market-Impact News */}
        <div className="lg:col-span-7">
          {/* Topic filters + search */}
          <div className="flex flex-col gap-3 border-b border-[#1C1917] pb-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Lọc tin tức">
                {filterButtons.map((btn) => (
                  <button
                    key={btn.id}
                    type="button"
                    onClick={() => setFilter(btn.id)}
                    className={`border px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                      filter === btn.id
                        ? 'border-[#1C1917] bg-[#1C1917] text-[#FAF7F0]'
                        : 'border-[#D6D0C4] bg-[#F3EFE6] text-[#57534E] hover:border-[#1C1917] hover:text-[#1C1917]'
                    }`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>

              <div className="relative sm:w-44">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[#57534E]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm coin, từ khóa..."
                  aria-label="Tìm kiếm trong tin tức"
                  className="w-full border border-[#D6D0C4] bg-[#FAF7F0] py-1 pr-2.5 pl-8 text-xs text-[#1C1917] placeholder:text-[#57534E] focus:border-[#1C1917] focus:outline-none"
                />
              </div>
            </div>

            {/* Time Range & Pinned strip */}
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Khoảng thời gian tin tức">
              {timeRangeButtons.map((btn) => (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => setTimeRange(btn.id)}
                  className={`border px-2 py-0.5 font-mono-tabular text-[11px] font-medium transition-colors cursor-pointer ${
                    timeRange === btn.id
                      ? 'border-[#1C1917] bg-[#FAF7F0] font-bold text-[#1C1917] shadow-[inset_0_-2px_0_#1C1917]'
                      : 'border-transparent bg-transparent text-[#57534E] hover:text-[#1C1917]'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          {loading && items.length === 0 ? (
            <div className="mt-4 space-y-3 animate-pulse">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-36 border border-[#D6D0C4] bg-[#F3EFE6]" />
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="mt-4 border border-[#D6D0C4] bg-[#F3EFE6] px-5 py-8 text-center text-sm text-[#57534E]">
              Không có bản tin nào khớp bộ lọc hiện tại. Thử chuyển về{' '}
              <button
                type="button"
                onClick={() => {
                  setFilter('ALL');
                  setTimeRange('ALL');
                  setSearchQuery('');
                }}
                className="font-semibold text-[#1C1917] underline cursor-pointer"
              >
                Tất cả thị trường (7 ngày)
              </button>
              .
            </div>
          ) : (
            <div className="mt-4 divide-y divide-[#D6D0C4] border border-[#D6D0C4] bg-[#FAF7F0]">
              {filteredItems.map((news) => {
                const sMeta = SENTIMENT_META[news.sentiment];
                const isPinned = pinnedSet.has(news.id);

                return (
                  <article key={news.id} className="p-4 transition-colors hover:bg-[#F3EFE6]/50">
                    {/* Top meta row */}
                    <div className="flex flex-wrap items-center gap-2 text-[10px]">
                      <span
                        className={`border px-1.5 py-0.5 font-bold uppercase tracking-wider ${sMeta.badgeCls}`}
                      >
                        {sMeta.label}
                      </span>
                      <span className="border border-[#D6D0C4] bg-[#F3EFE6] px-1.5 py-0.5 font-semibold uppercase tracking-wider text-[#1C1917]">
                        {news.categoryLabelVi}
                      </span>
                      {news.impact === 'HIGH' && (
                        <span className="inline-flex items-center gap-0.5 font-bold uppercase text-[#B91C1C]">
                          <Flame className="h-3 w-3" />
                          Tin mạnh
                        </span>
                      )}
                      <span className="border border-[#D6D0C4] px-1.5 py-0.5 font-mono-tabular text-[#57534E]">
                        {news.horizonVi}
                      </span>

                      <div className="ml-auto flex items-center gap-2">
                        <span className="font-mono-tabular text-[#57534E]">
                          {news.source} · {formatTimeAgoVi(news.publishedAt)} ({formatDateTimeVi(news.publishedAt)})
                        </span>
                        <button
                          type="button"
                          onClick={() => onTogglePin(news.id)}
                          aria-pressed={isPinned}
                          title={isPinned ? 'Bỏ ghim tin này' : 'Ghim giữ lại tin này để đối chiếu'}
                          className={`border p-1 transition-colors cursor-pointer ${
                            isPinned
                              ? 'border-[#1C1917] bg-[#1C1917] text-[#FAF7F0]'
                              : 'border-[#D6D0C4] bg-[#F3EFE6] text-[#57534E] hover:border-[#1C1917] hover:text-[#1C1917]'
                          }`}
                        >
                          <Bookmark className={`h-3 w-3 ${isPinned ? 'fill-current' : ''}`} />
                        </button>
                      </div>
                    </div>

                    {/* Headline */}
                    <h3 className="font-serif-editorial mt-2 text-base font-bold leading-snug text-[#1C1917]">
                      <a
                        href={news.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-start gap-1 hover:underline"
                      >
                        <span>{news.title}</span>
                        <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 text-[#57534E]" />
                      </a>
                    </h3>

                    {/* Deep Structured Analysis Box */}
                    <div className="mt-2.5 space-y-1.5 border-l-2 border-[#1C1917]/40 bg-[#F3EFE6]/70 px-3 py-2.5 text-xs leading-relaxed">
                      <p className="text-[#1C1917]">
                        <strong className="uppercase tracking-wider text-[10px] text-[#57534E]">
                          Tin này nói gì:{' '}
                        </strong>
                        {news.meaningVi}
                      </p>
                      <p className="text-[#1C1917]">
                        <strong className="uppercase tracking-wider text-[10px] text-[#57534E]">
                          Ảnh hưởng thị trường:{' '}
                        </strong>
                        {news.impactVi}
                      </p>
                      <p className="text-[#57534E]">
                        <strong className="uppercase tracking-wider text-[10px] text-[#1C1917]">
                          Lưu ý giao dịch:{' '}
                        </strong>
                        {news.actionHintVi}
                      </p>
                    </div>

                    {/* Related Coin Tags */}
                    {news.coins.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        {news.coins.map((coin) => (
                          <button
                            key={coin}
                            type="button"
                            onClick={() => onSelectCoin(`${coin}USDT`)}
                            title={`Xem phân tích chi tiết ${coin}/USDT`}
                            className="border border-[#D6D0C4] bg-[#F3EFE6] px-2 py-0.5 font-mono-tabular text-[11px] font-bold text-[#1C1917] transition-colors hover:border-[#1C1917] hover:bg-[#1C1917] hover:text-[#FAF7F0] cursor-pointer"
                          >
                            ${coin}
                          </button>
                        ))}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column (5/12): FED & Upcoming Red Macro Calendar */}
        <aside className="lg:col-span-5">
          <div className="border border-[#D6D0C4] bg-[#F3EFE6] p-4 sm:p-5">
            <div className="flex items-start justify-between gap-2 border-b border-[#1C1917] pb-3">
              <div>
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#B91C1C]">
                  <CalendarClock className="h-3.5 w-3.5" />
                  <span>Lịch kinh tế Mỹ (USD)</span>
                </div>
                <h3 className="font-serif-editorial mt-1 text-lg font-bold text-[#1C1917]">
                  Tin FED &amp; Sự kiện đỏ sắp công bố
                </h3>
              </div>

              {highImpactUpcomingCount > 0 && (
                <span className="shrink-0 border border-[#B91C1C] bg-[#B91C1C] px-2 py-0.5 font-mono-tabular text-[10px] font-bold uppercase text-[#FAF7F0]">
                  {highImpactUpcomingCount} tin đỏ
                </span>
              )}
            </div>

            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="text-[#57534E]">Múi giờ hiển thị theo máy của bạn</span>
              <label className="inline-flex items-center gap-1.5 font-medium text-[#1C1917] cursor-pointer">
                <input
                  type="checkbox"
                  checked={onlyRedEvents}
                  onChange={(e) => setOnlyRedEvents(e.target.checked)}
                  className="accent-[#B91C1C]"
                />
                <span>Chỉ tin đỏ &amp; FED</span>
              </label>
            </div>

            {visibleCalendar.length === 0 ? (
              <div className="mt-4 border border-[#D6D0C4] bg-[#FAF7F0] p-4 text-center text-xs text-[#57534E]">
                Chưa có sự kiện vĩ mô Mỹ nào trong bộ lọc hiện tại.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {visibleCalendar.map((ev) => {
                  const isRed = ev.impact === 'High';
                  const countdown = formatCountdownVi(ev.timestampMs);

                  return (
                    <div
                      key={ev.id}
                      className={`border bg-[#FAF7F0] p-3.5 ${
                        isRed
                          ? 'border-[#D6D0C4] border-l-4 border-l-[#B91C1C]'
                          : 'border-[#D6D0C4] border-l-4 border-l-[#B45309]'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px]">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-1.5 py-0.5 font-bold uppercase tracking-wider text-[#FAF7F0] ${
                              isRed ? 'bg-[#B91C1C]' : 'bg-[#B45309]'
                            }`}
                          >
                            {isRed ? 'TIN ĐỎ' : 'TRUNG BÌNH'}
                          </span>
                          {ev.isFomc && (
                            <span className="border border-[#1C1917] bg-[#1C1917] px-1.5 py-0.5 font-bold uppercase tracking-wider text-[#FAF7F0]">
                              FED
                            </span>
                          )}
                        </div>
                        <span
                          className={`font-mono-tabular font-semibold ${
                            countdown.isUpcoming ? 'text-[#B91C1C]' : 'text-[#57534E]'
                          }`}
                        >
                          {countdown.text}
                        </span>
                      </div>

                      <h4 className="mt-2 text-sm font-bold text-[#1C1917]">{ev.title}</h4>
                      <div className="font-mono-tabular mt-1 text-[11px] text-[#57534E]">
                        {formatDateTimeVi(ev.timestampMs)}
                      </div>

                      {(ev.forecast || ev.previous) && (
                        <div className="mt-2 flex flex-wrap gap-4 border-t border-[#D6D0C4]/70 pt-2 font-mono-tabular text-[11px]">
                          <span>
                            Dự báo:{' '}
                            <strong className="text-[#1C1917]">{ev.forecast || '—'}</strong>
                          </span>
                          <span>
                            Kỳ trước:{' '}
                            <strong className="text-[#57534E]">{ev.previous || '—'}</strong>
                          </span>
                        </div>
                      )}

                      {ev.cryptoNoteVi && (
                        <p className="mt-2 text-[11px] leading-relaxed text-[#57534E]">
                          {ev.cryptoNoteVi}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}

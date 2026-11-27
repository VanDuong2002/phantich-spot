import { ArrowUpRight, ExternalLink, Newspaper } from 'lucide-react';
import { filterNewsItems, summarizeNewsSentiment } from '../engine/newsAnalyzer';
import type { AnalyzedNewsItem } from '../types/news';

export interface CoinNewsStripProps {
  selectedSymbol: string;
  items: AnalyzedNewsItem[];
  onOpenNewsTab: () => void;
}

export function CoinNewsStrip({
  selectedSymbol,
  items,
  onOpenNewsTab,
}: CoinNewsStripProps) {
  const base = selectedSymbol.replace(/USDT$/i, '').toUpperCase();
  const related = filterNewsItems(items, 'SELECTED_COIN', base).slice(0, 4);
  const summary = summarizeNewsSentiment(related, base);

  const outlookLabel =
    summary.outlook === 'TANG'
      ? { text: 'Tin nghiêng TĂNG', cls: 'text-[#15803D]' }
      : summary.outlook === 'GIAM'
        ? { text: 'Tin nghiêng GIẢM', cls: 'text-[#B91C1C]' }
        : { text: 'Tin Trung tính', cls: 'text-[#475569]' };

  return (
    <section
      aria-label={`Tin tức liên quan ${base}`}
      className="border-t border-[#D6D0C4] py-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <Newspaper className="h-4 w-4 text-[#1C1917]" />
          <h3 className="font-serif-editorial text-lg font-bold text-[#1C1917]">
            Tin tức tác động tới {base}
          </h3>
          {related.length > 0 && (
            <span className={`font-mono-tabular text-xs font-bold ${outlookLabel.cls}`}>
              · {outlookLabel.text} ({summary.bullishCount}↑ / {summary.bearishCount}↓)
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onOpenNewsTab}
          className="inline-flex items-center gap-1 border border-[#1C1917] bg-[#FAF7F0] px-2.5 py-1 text-xs font-semibold text-[#1C1917] transition-colors hover:bg-[#1C1917] hover:text-[#FAF7F0] cursor-pointer"
        >
          <span>Mở bản tin &amp; Lịch FED</span>
          <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {related.length === 0 ? (
        <div className="mt-3 border border-[#D6D0C4] bg-[#F3EFE6] px-4 py-3 text-xs text-[#57534E]">
          Chưa có bản tin tác động lớn nào nhắc trực tiếp đến <strong className="text-[#1C1917]">{base}</strong> trong đợt cập nhật gần nhất. Xem toàn bộ tin thị trường &amp; lịch FED ở tab Tin tức.
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          {related.map((item) => {
            const badgeCls =
              item.sentiment === 'BULLISH'
                ? 'bg-[#15803D] text-[#FAF7F0]'
                : item.sentiment === 'BEARISH'
                  ? 'bg-[#B91C1C] text-[#FAF7F0]'
                  : 'bg-[#475569] text-[#FAF7F0]';
            const badgeText =
              item.sentiment === 'BULLISH'
                ? 'TĂNG'
                : item.sentiment === 'BEARISH'
                  ? 'GIẢM'
                  : 'TRUNG TÍNH';

            return (
              <article
                key={item.id}
                className="border border-[#D6D0C4] bg-[#F3EFE6] p-3.5 transition-colors hover:border-[#1C1917]"
              >
                <div className="flex items-center justify-between gap-2 text-[10px]">
                  <span className={`px-1.5 py-0.5 font-bold uppercase tracking-wider ${badgeCls}`}>
                    {badgeText}
                  </span>
                  <span className="font-mono-tabular text-[#57534E]">{item.source}</span>
                </div>
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-serif-editorial mt-1.5 inline-flex items-start gap-1 text-sm font-bold leading-snug text-[#1C1917] hover:underline"
                >
                  <span>{item.title}</span>
                  <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-[#57534E]" />
                </a>
                <p className="mt-1.5 text-[11px] leading-relaxed text-[#1C1917]">
                  <strong>Ý nghĩa:</strong> {item.meaningVi}
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-[#57534E]">
                  <strong>Ảnh hưởng:</strong> {item.impactVi}
                </p>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

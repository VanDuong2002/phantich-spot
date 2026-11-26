import { AlertTriangle } from 'lucide-react';
import type { AnalysisReport, Timeframe, Verdict } from '../types/market';
import { formatPercent, formatPrice } from '../utils/format';

export interface EditorialLeadProps {
  report: AnalysisReport;
}

const VERDICT_META: Record<
  Verdict,
  { label: string; badgeClass: string; scoreClass: string }
> = {
  MUA: {
    label: 'MUA',
    badgeClass: 'bg-[#15803D] text-[#FAF7F0] border-[#15803D]',
    scoreClass: 'text-[#15803D]',
  },
  GIU: {
    label: 'GIỮ',
    badgeClass: 'bg-[#B45309] text-[#FAF7F0] border-[#B45309]',
    scoreClass: 'text-[#B45309]',
  },
  BAN: {
    label: 'BÁN',
    badgeClass: 'bg-[#B91C1C] text-[#FAF7F0] border-[#B91C1C]',
    scoreClass: 'text-[#B91C1C]',
  },
  DUNG_NGOAI: {
    label: 'ĐỨNG NGOÀI',
    badgeClass: 'bg-[#475569] text-[#FAF7F0] border-[#475569]',
    scoreClass: 'text-[#475569]',
  },
};

const TF_ORDER: Timeframe[] = ['1w', '1d', '4h', '1h'];

const TREND_LABEL: Record<'UP' | 'DOWN' | 'NEUTRAL', { text: string; color: string }> = {
  UP: { text: 'Tăng', color: 'text-[#15803D]' },
  DOWN: { text: 'Giảm', color: 'text-[#B91C1C]' },
  NEUTRAL: { text: 'Đi ngang', color: 'text-[#57534E]' },
};

function formatPair(symbol: string): string {
  return symbol.endsWith('USDT') && symbol.length > 4
    ? `${symbol.slice(0, -4)}/USDT`
    : symbol;
}

export function EditorialLead({ report }: EditorialLeadProps) {
  const verdictMeta = VERDICT_META[report.verdict];
  const isPriceUp = report.priceChangePercent24h >= 0;

  return (
    <section
      aria-label="Bài nhận định chính"
      className="border-b border-[#D6D0C4] py-6"
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-0">
        {/* Left Column (7/12): Editorial Verdict, Headline, Narrative, Reasons & Warnings */}
        <article className="lg:col-span-7 lg:border-r lg:border-[#D6D0C4] lg:pr-7">
          {/* Kicker strip */}
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <span
              className={`inline-block border px-2.5 py-0.5 font-bold uppercase tracking-[0.12em] ${verdictMeta.badgeClass}`}
            >
              {verdictMeta.label}
            </span>
            <span className="font-mono-tabular font-bold text-[#1C1917]">
              {formatPair(report.symbol)}
            </span>
            <span className="text-[#D6D0C4]">·</span>
            <span className="font-mono-tabular font-semibold text-[#1C1917]">
              ${formatPrice(report.currentPrice)}
            </span>
            <span
              className={`font-mono-tabular font-semibold ${
                isPriceUp ? 'text-[#15803D]' : 'text-[#B91C1C]'
              }`}
            >
              {formatPercent(report.priceChangePercent24h, true)}
            </span>
            <span className="ml-auto text-[11px] uppercase tracking-wider text-[#57534E]">
              Chế độ: <strong className="text-[#1C1917]">{report.modeName}</strong>
            </span>
          </div>

          {/* Serif Headline */}
          <h2 className="font-serif-editorial mt-3 text-2xl font-bold leading-snug text-[#1C1917] sm:text-3xl">
            {report.headline}
          </h2>

          {/* Lead Summary */}
          <p className="mt-3 text-sm leading-relaxed text-[#1C1917]/90 sm:text-[15px]">
            {report.summary}
          </p>

          {/* Key Technical Reasons */}
          {report.reasons.length > 0 && (
            <div className="mt-5 border-t border-[#D6D0C4] pt-4">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#57534E]">
                Luận điểm kỹ thuật
              </h3>
              <ul className="mt-2.5 space-y-2 text-sm text-[#1C1917]">
                {report.reasons.map((reason, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 bg-[#1C1917]" />
                    <span className="leading-relaxed">{reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Risk Warnings Callout */}
          {report.warnings.length > 0 && (
            <div
              role="note"
              className="mt-5 border border-[#D6D0C4] border-l-4 border-l-[#B45309] bg-[#F3EFE6] px-4 py-3"
            >
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#B45309]">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>Lưu ý rủi ro</span>
              </div>
              <ul className="mt-1.5 space-y-1 text-xs leading-relaxed text-[#1C1917]">
                {report.warnings.map((warning, idx) => (
                  <li key={idx}>• {warning}</li>
                ))}
              </ul>
            </div>
          )}
        </article>

        {/* Right Column (5/12): Spot Trade Plan OR Reference Levels + 4-TF Summary */}
        <aside className="flex flex-col justify-between gap-5 lg:col-span-5 lg:pl-7">
          <div className="border border-[#D6D0C4] bg-[#F3EFE6] p-4 sm:p-5">
            {/* Box Header with Composite Score */}
            <div className="flex items-baseline justify-between border-b border-[#D6D0C4] pb-3">
              <h3 className="font-serif-editorial text-base font-bold text-[#1C1917]">
                {report.tradePlan !== null
                  ? 'Kế hoạch lệnh Spot'
                  : 'Mốc kỹ thuật tham chiếu'}
              </h3>
              <div className="text-right">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-[#57534E]">
                  Điểm tổng hợp
                </span>
                <div className={`font-mono-tabular text-xl font-bold ${verdictMeta.scoreClass}`}>
                  {Math.round(report.score)}
                  <span className="text-xs font-normal text-[#57534E]">/100</span>
                </div>
              </div>
            </div>

            {report.tradePlan !== null ? (
              <dl className="mt-3 divide-y divide-[#D6D0C4]/80 text-sm">
                <div className="flex items-baseline justify-between py-2">
                  <dt className="text-xs font-medium uppercase tracking-wider text-[#57534E]">
                    Vùng mua đề xuất
                  </dt>
                  <dd className="font-mono-tabular font-semibold text-[#1C1917]">
                    ${formatPrice(report.tradePlan.entryLow)} – ${formatPrice(report.tradePlan.entryHigh)}
                  </dd>
                </div>

                <div className="flex items-baseline justify-between py-2">
                  <dt className="text-xs font-medium uppercase tracking-wider text-[#57534E]">
                    Cắt lỗ (SL)
                  </dt>
                  <dd className="font-mono-tabular font-semibold text-[#B91C1C]">
                    ${formatPrice(report.tradePlan.stopLoss)}{' '}
                    <span className="text-xs font-medium">
                      ({formatPercent(report.tradePlan.stopLossPct, true)})
                    </span>
                  </dd>
                </div>

                <div className="flex items-baseline justify-between py-2">
                  <dt className="text-xs font-medium uppercase tracking-wider text-[#57534E]">
                    Chốt lời 1 (TP1)
                  </dt>
                  <dd className="font-mono-tabular font-semibold text-[#15803D]">
                    ${formatPrice(report.tradePlan.tp1)}{' '}
                    <span className="text-xs font-medium">
                      ({formatPercent(report.tradePlan.tp1Pct, true)})
                    </span>
                  </dd>
                </div>

                <div className="flex items-baseline justify-between py-2">
                  <dt className="text-xs font-medium uppercase tracking-wider text-[#57534E]">
                    Chốt lời 2 (TP2)
                  </dt>
                  <dd className="font-mono-tabular font-semibold text-[#15803D]">
                    ${formatPrice(report.tradePlan.tp2)}{' '}
                    <span className="text-xs font-medium">
                      ({formatPercent(report.tradePlan.tp2Pct, true)})
                    </span>
                  </dd>
                </div>

                <div className="flex items-baseline justify-between pt-2.5">
                  <dt className="text-xs font-medium uppercase tracking-wider text-[#57534E]">
                    Tỷ lệ Rủi ro / Lợi nhuận
                  </dt>
                  <dd className="font-mono-tabular font-bold text-[#1C1917]">
                    1 : {report.tradePlan.riskReward.toFixed(2)}
                  </dd>
                </div>
              </dl>
            ) : (
              <dl className="mt-3 divide-y divide-[#D6D0C4]/80 text-sm">
                <div className="flex items-baseline justify-between py-2.5">
                  <dt className="text-xs font-medium uppercase tracking-wider text-[#57534E]">
                    Hỗ trợ gần nhất
                  </dt>
                  <dd className="font-mono-tabular font-semibold text-[#15803D]">
                    ${formatPrice(report.referenceLevels.nearestSupport)}
                  </dd>
                </div>

                <div className="flex items-baseline justify-between py-2.5">
                  <dt className="text-xs font-medium uppercase tracking-wider text-[#57534E]">
                    Kháng cự gần nhất
                  </dt>
                  <dd className="font-mono-tabular font-semibold text-[#B91C1C]">
                    ${formatPrice(report.referenceLevels.nearestResistance)}
                  </dd>
                </div>

                <div className="flex items-baseline justify-between pt-2.5">
                  <dt className="text-xs font-medium uppercase tracking-wider text-[#57534E]">
                    Mốc cảnh báo thủng hỗ trợ
                  </dt>
                  <dd className="font-mono-tabular font-semibold text-[#B45309]">
                    ${formatPrice(report.referenceLevels.invalidationLevel)}
                  </dd>
                </div>
              </dl>
            )}
          </div>

          {/* 4-Timeframe Compact Strip */}
          <div>
            <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#57534E]">
              Đồng thuận đa khung (1W · 1D · 4H · 1H)
            </div>
            <div className="grid grid-cols-4 border border-[#D6D0C4] bg-[#FAF7F0] divide-x divide-[#D6D0C4]">
              {TF_ORDER.map((tf) => {
                const tfData = report.timeframes[tf];
                const trendMeta = TREND_LABEL[tfData.trend];
                const scoreFormatted =
                  tfData.score > 0
                    ? `+${Math.round(tfData.score)}`
                    : `${Math.round(tfData.score)}`;

                return (
                  <div key={tf} className="px-2.5 py-2.5 text-center">
                    <div className="font-mono-tabular text-[11px] font-bold uppercase text-[#57534E]">
                      {tf}
                    </div>
                    <div className={`mt-0.5 text-xs font-bold ${trendMeta.color}`}>
                      {trendMeta.text}
                    </div>
                    <div className="font-mono-tabular mt-0.5 text-[11px] text-[#1C1917]">
                      {scoreFormatted}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

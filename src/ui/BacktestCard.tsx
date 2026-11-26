import type { BacktestResult } from '../types/market';
import { formatPercent } from '../utils/format';

export interface BacktestCardProps {
  result: BacktestResult;
  modeName: string;
}

export function BacktestCard({ result, modeName }: BacktestCardProps) {
  const hasTrades = result.totalTrades > 0;
  const returnTone =
    !hasTrades
      ? 'text-[#57534E]'
      : result.netReturnPct > 0
        ? 'text-[#15803D]'
        : result.netReturnPct < 0
          ? 'text-[#B91C1C]'
          : 'text-[#1C1917]';

  return (
    <section
      aria-label="Kiểm thử nhanh lịch sử 4H"
      className="py-6"
    >
      <div className="border border-[#D6D0C4] bg-[#F3EFE6] p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#D6D0C4] pb-3">
          <div>
            <h2 className="font-serif-editorial text-lg font-bold text-[#1C1917]">
              Kiểm thử nhanh trên dữ liệu lịch sử (4H)
            </h2>
            <p className="mt-0.5 text-xs text-[#57534E]">
              Chế độ áp dụng: <strong className="text-[#1C1917]">{modeName}</strong> · Mô phỏng trên{' '}
              <span className="font-mono-tabular font-semibold text-[#1C1917]">
                {result.candlesTested}
              </span>{' '}
              nến 4H gần nhất
            </p>
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#57534E]">
            Không nhìn trước tương lai
          </span>
        </div>

        {/* 4 KPI cells */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="border border-[#D6D0C4] bg-[#FAF7F0] px-3.5 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#57534E]">
              Số lệnh mẫu
            </div>
            <div className="font-mono-tabular mt-1 text-xl font-bold text-[#1C1917]">
              {result.totalTrades}
            </div>
          </div>

          <div className="border border-[#D6D0C4] bg-[#FAF7F0] px-3.5 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#57534E]">
              Tỷ lệ thắng
            </div>
            <div className="font-mono-tabular mt-1 text-xl font-bold text-[#1C1917]">
              {hasTrades ? formatPercent(result.winRate) : '—'}
            </div>
          </div>

          <div className="border border-[#D6D0C4] bg-[#FAF7F0] px-3.5 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#57534E]">
              R:R trung bình
            </div>
            <div className="font-mono-tabular mt-1 text-xl font-bold text-[#1C1917]">
              {hasTrades ? `${result.avgRiskReward.toFixed(2)}R` : '—'}
            </div>
          </div>

          <div className="border border-[#D6D0C4] bg-[#FAF7F0] px-3.5 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#57534E]">
              Hiệu suất ước tính
            </div>
            <div className={`font-mono-tabular mt-1 text-xl font-bold ${returnTone}`}>
              {hasTrades ? formatPercent(result.netReturnPct, true) : '—'}
            </div>
          </div>
        </div>

        {!hasTrades && (
          <p className="mt-3 text-xs text-[#57534E]">
            Chưa phát sinh lệnh MUA nào thỏa mãn đồng thời ngưỡng điểm và tỷ lệ R:R tối thiểu của chế độ{' '}
            <strong>{modeName}</strong> trong giai đoạn kiểm thử này.
          </p>
        )}

        {/* Rule summary + disclaimer */}
        <div className="mt-4 border-t border-[#D6D0C4] pt-3 text-xs leading-relaxed text-[#57534E]">
          <p>
            <strong className="text-[#1C1917]">Quy tắc mô phỏng:</strong> {result.ruleSummaryVi}.
          </p>
          <p className="mt-1 italic">
            Miễn trừ trách nhiệm: Kết quả kiểm thử trên dữ liệu quá khứ chưa tính phí giao dịch và trượt giá, chỉ phục vụ mục đích tham khảo kỹ thuật — không phải lời khuyên đầu tư hay cam kết lợi nhuận tương lai.
          </p>
        </div>
      </div>
    </section>
  );
}

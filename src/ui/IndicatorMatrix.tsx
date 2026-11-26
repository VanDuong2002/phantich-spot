import type { IndicatorSnapshot, Timeframe, TimeframeAnalysis } from '../types/market';
import { formatPrice } from '../utils/format';

export interface IndicatorMatrixProps {
  timeframes: Record<Timeframe, TimeframeAnalysis>;
}

const TF_ROWS: { tf: Timeframe; label: string; desc: string }[] = [
  { tf: '1w', label: '1W', desc: 'Tuần' },
  { tf: '1d', label: '1D', desc: 'Ngày' },
  { tf: '4h', label: '4H', desc: '4 Giờ' },
  { tf: '1h', label: '1H', desc: '1 Giờ' },
];

function summarizeEma(snapshot: IndicatorSnapshot): {
  label: string;
  detail: string;
  tone: string;
} {
  const { price, ema21, ema50, ema200 } = snapshot;
  if (ema21 === null && ema50 === null && ema200 === null) {
    return { label: 'Thiếu dữ liệu', detail: '—', tone: 'text-[#57534E]' };
  }

  if (ema21 !== null && ema50 !== null && ema200 !== null) {
    if (price > ema21 && ema21 > ema50 && ema50 > ema200) {
      return {
        label: 'Xếp tăng chuẩn',
        detail: `EMA21 $${formatPrice(ema21)}`,
        tone: 'text-[#15803D]',
      };
    }
    if (price < ema21 && ema21 < ema50 && ema50 < ema200) {
      return {
        label: 'Xếp giảm chuẩn',
        detail: `EMA21 $${formatPrice(ema21)}`,
        tone: 'text-[#B91C1C]',
      };
    }
    if (price >= ema200) {
      return {
        label: 'Trên EMA200',
        detail: `EMA200 $${formatPrice(ema200)}`,
        tone: 'text-[#15803D]',
      };
    }
    return {
      label: 'Dưới EMA200',
      detail: `EMA200 $${formatPrice(ema200)}`,
      tone: 'text-[#B91C1C]',
    };
  }

  if (ema21 !== null) {
    const above = price >= ema21;
    return {
      label: above ? 'Trên EMA21' : 'Dưới EMA21',
      detail: `$${formatPrice(ema21)}`,
      tone: above ? 'text-[#15803D]' : 'text-[#B91C1C]',
    };
  }

  return { label: 'Trung tính', detail: '—', tone: 'text-[#57534E]' };
}

function summarizeRsi(rsi: number | null): { value: string; note: string; tone: string } {
  if (rsi === null || !Number.isFinite(rsi)) {
    return { value: '—', note: 'Thiếu dữ liệu', tone: 'text-[#57534E]' };
  }
  const value = rsi.toFixed(1);
  if (rsi >= 70) return { value, note: 'Quá mua', tone: 'text-[#B45309]' };
  if (rsi <= 30) return { value, note: 'Quá bán', tone: 'text-[#15803D]' };
  if (rsi >= 55) return { value, note: 'Động lượng tăng', tone: 'text-[#15803D]' };
  if (rsi <= 45) return { value, note: 'Động lượng yếu', tone: 'text-[#B91C1C]' };
  return { value, note: 'Trung tính', tone: 'text-[#57534E]' };
}

function summarizeMacd(snapshot: IndicatorSnapshot): {
  value: string;
  note: string;
  tone: string;
} {
  const hist = snapshot.macdHistogram;
  if (hist === null || !Number.isFinite(hist)) {
    return { value: '—', note: 'Thiếu dữ liệu', tone: 'text-[#57534E]' };
  }
  const abs = Math.abs(hist);
  const formatted =
    abs >= 1 ? hist.toFixed(2) : abs >= 0.01 ? hist.toFixed(4) : hist.toPrecision(3);
  const signed = hist > 0 ? `+${formatted}` : formatted;

  if (hist > 0) return { value: signed, note: 'Histogram dương', tone: 'text-[#15803D]' };
  if (hist < 0) return { value: signed, note: 'Histogram âm', tone: 'text-[#B91C1C]' };
  return { value: '0.00', note: 'Cân bằng', tone: 'text-[#57534E]' };
}

function summarizeVolume(ratio: number | null): {
  value: string;
  note: string;
  tone: string;
} {
  if (ratio === null || !Number.isFinite(ratio)) {
    return { value: '—', note: 'Thiếu dữ liệu', tone: 'text-[#57534E]' };
  }
  const value = `${ratio.toFixed(2)}×`;
  if (ratio >= 1.5) return { value, note: 'Đột biến', tone: 'text-[#15803D]' };
  if (ratio >= 1.1) return { value, note: 'Trên TB20', tone: 'text-[#1C1917]' };
  if (ratio < 0.7) return { value, note: 'Thanh khoản thấp', tone: 'text-[#B45309]' };
  return { value, note: 'Bình thường', tone: 'text-[#57534E]' };
}

export function IndicatorMatrix({ timeframes }: IndicatorMatrixProps) {
  return (
    <section
      aria-label="Bảng ma trận chỉ báo đa khung"
      className="border-b border-[#D6D0C4] py-6"
    >
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-serif-editorial text-lg font-bold text-[#1C1917]">
          Ma trận chỉ báo kỹ thuật đa khung
        </h2>
        <span className="text-xs text-[#57534E]">
          Đánh giá độc lập từng khung thời gian (thang điểm -100 đến +100)
        </span>
      </div>

      <div className="overflow-x-auto border border-[#D6D0C4] bg-[#FAF7F0]">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[#1C1917] bg-[#F3EFE6] text-[11px] font-bold uppercase tracking-[0.12em] text-[#57534E]">
              <th className="px-4 py-2.5">Khung</th>
              <th className="px-4 py-2.5">Xu hướng EMA</th>
              <th className="px-4 py-2.5">RSI (14)</th>
              <th className="px-4 py-2.5">MACD Histogram</th>
              <th className="px-4 py-2.5">Khối lượng</th>
              <th className="px-4 py-2.5 text-right">Điểm khung</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#D6D0C4]">
            {TF_ROWS.map(({ tf, label, desc }) => {
              const analysis = timeframes[tf];
              const ema = summarizeEma(analysis.snapshot);
              const rsi = summarizeRsi(analysis.snapshot.rsi);
              const macd = summarizeMacd(analysis.snapshot);
              const vol = summarizeVolume(analysis.snapshot.volumeRatio);

              const scoreRounded = Math.round(analysis.score);
              const scoreText = scoreRounded > 0 ? `+${scoreRounded}` : `${scoreRounded}`;
              const scoreTone =
                analysis.trend === 'UP'
                  ? 'text-[#15803D] bg-[#15803D]/8'
                  : analysis.trend === 'DOWN'
                    ? 'text-[#B91C1C] bg-[#B91C1C]/8'
                    : 'text-[#475569] bg-[#F3EFE6]';

              return (
                <tr key={tf} className="transition-colors hover:bg-[#F3EFE6]/60">
                  <td className="px-4 py-3">
                    <div className="font-mono-tabular font-bold text-[#1C1917]">{label}</div>
                    <div className="text-[11px] text-[#57534E]">{desc}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className={`text-xs font-semibold ${ema.tone}`}>{ema.label}</div>
                    <div className="font-mono-tabular text-[11px] text-[#57534E]">
                      {ema.detail}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className={`font-mono-tabular text-xs font-semibold ${rsi.tone}`}>
                      {rsi.value}
                    </div>
                    <div className="text-[11px] text-[#57534E]">{rsi.note}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className={`font-mono-tabular text-xs font-semibold ${macd.tone}`}>
                      {macd.value}
                    </div>
                    <div className="text-[11px] text-[#57534E]">{macd.note}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className={`font-mono-tabular text-xs font-semibold ${vol.tone}`}>
                      {vol.value}
                    </div>
                    <div className="text-[11px] text-[#57534E]">{vol.note}</div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`font-mono-tabular inline-block min-w-[3.25rem] px-2 py-1 text-center text-xs font-bold ${scoreTone}`}
                    >
                      {scoreText}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

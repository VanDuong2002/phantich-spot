import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CandlestickSeries,
  ColorType,
  createChart,
  LineSeries,
  LineStyle,
  type UTCTimestamp,
} from 'lightweight-charts';
import { calcEMASeries } from '../engine/indicators';
import type { AnalysisReport, Candle, Timeframe } from '../types/market';

export interface PriceChartProps {
  candlesByTf: Record<Timeframe, Candle[]>;
  report: AnalysisReport;
  emaPeriods?: { fast: number; mid: number; slow: number };
}

const TIMEFRAME_TABS: { tf: Timeframe; label: string }[] = [
  { tf: '1h', label: '1H' },
  { tf: '4h', label: '4H' },
  { tf: '1d', label: '1D' },
  { tf: '1w', label: '1W' },
];

export interface ChartPriceFormat {
  type: 'price';
  precision: number;
  minMove: number;
}

/**
 * Compute adaptive Lightweight Charts priceFormat precision & minMove
 * so micro-cap and sub-dollar USDT pairs (e.g. PEPEUSDT, SHIBUSDT, DOGEUSDT)
 * never collapse to 0.00 on the price axis or price lines.
 */
export function getChartPriceFormat(price: number): ChartPriceFormat {
  if (!Number.isFinite(price) || price <= 0) {
    return { type: 'price', precision: 2, minMove: 0.01 };
  }
  const abs = Math.abs(price);
  if (abs < 0.0001) return { type: 'price', precision: 8, minMove: 1e-8 };
  if (abs < 0.01) return { type: 'price', precision: 6, minMove: 1e-6 };
  if (abs < 1) return { type: 'price', precision: 4, minMove: 1e-4 };
  return { type: 'price', precision: 2, minMove: 0.01 };
}

function buildEmaLineData(
  candles: Candle[],
  period: number,
): { time: UTCTimestamp; value: number }[] {
  const closes = candles.map((c) => c.close);
  const emaValues = calcEMASeries(closes, period);
  const result: { time: UTCTimestamp; value: number }[] = [];

  for (let i = 0; i < candles.length; i++) {
    const val = emaValues[i];
    if (val !== null && Number.isFinite(val)) {
      result.push({
        time: Math.floor(candles[i].openTime / 1000) as UTCTimestamp,
        value: val,
      });
    }
  }
  return result;
}

export function PriceChart({
  candlesByTf,
  report,
  emaPeriods = { fast: 21, mid: 50, slow: 200 },
}: PriceChartProps) {
  const [activeTf, setActiveTf] = useState<Timeframe>('4h');
  const [showEmaFast, setShowEmaFast] = useState(true);
  const [showEmaMid, setShowEmaMid] = useState(true);
  const [showEmaSlow, setShowEmaSlow] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const sortedCandles = useMemo(() => {
    const raw = candlesByTf[activeTf] ?? [];
    if (raw.length === 0) return [];
    const byTime = new Map<number, Candle>();
    for (const c of raw) {
      byTime.set(Math.floor(c.openTime / 1000), c);
    }
    return Array.from(byTime.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([, candle]) => candle);
  }, [candlesByTf, activeTf]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || sortedCandles.length === 0) return;

    const chart = createChart(container, {
      width: container.clientWidth || 640,
      height: 380,
      layout: {
        background: { type: ColorType.Solid, color: '#FAF7F0' },
        textColor: '#57534E',
        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: '#EAE5DA' },
        horzLines: { color: '#EAE5DA' },
      },
      rightPriceScale: {
        borderColor: '#D6D0C4',
      },
      timeScale: {
        borderColor: '#D6D0C4',
        timeVisible: activeTf === '1h' || activeTf === '4h',
        secondsVisible: false,
      },
      crosshair: {
        vertLine: { color: '#57534E', width: 1, style: LineStyle.Dashed },
        horzLine: { color: '#57534E', width: 1, style: LineStyle.Dashed },
      },
    });

    const latestPrice = sortedCandles[sortedCandles.length - 1]?.close ?? report.currentPrice;
    const priceFormat = getChartPriceFormat(latestPrice);

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#15803D',
      downColor: '#B91C1C',
      borderVisible: false,
      wickUpColor: '#15803D',
      wickDownColor: '#B91C1C',
      priceFormat,
    });

    candleSeries.setData(
      sortedCandles.map((c) => ({
        time: Math.floor(c.openTime / 1000) as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    );

    if (showEmaFast) {
      const emaFastSeries = chart.addSeries(LineSeries, {
        color: '#B45309',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
        priceFormat,
      });
      emaFastSeries.setData(buildEmaLineData(sortedCandles, emaPeriods.fast));
    }

    if (showEmaMid) {
      const emaMidSeries = chart.addSeries(LineSeries, {
        color: '#2563EB',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
        priceFormat,
      });
      emaMidSeries.setData(buildEmaLineData(sortedCandles, emaPeriods.mid));
    }

    if (showEmaSlow) {
      const emaSlowSeries = chart.addSeries(LineSeries, {
        color: '#1C1917',
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
        priceFormat,
      });
      emaSlowSeries.setData(buildEmaLineData(sortedCandles, emaPeriods.slow));
    }

    // Price lines: Spot Trade Plan on MUA, otherwise Support / Resistance
    if (report.tradePlan !== null) {
      const plan = report.tradePlan;
      candleSeries.createPriceLine({
        price: plan.entryHigh,
        color: '#475569',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: 'Vùng mua (cao)',
      });
      candleSeries.createPriceLine({
        price: plan.entryLow,
        color: '#475569',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: 'Vùng mua (thấp)',
      });
      candleSeries.createPriceLine({
        price: plan.stopLoss,
        color: '#B91C1C',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: 'Cắt lỗ (SL)',
      });
      candleSeries.createPriceLine({
        price: plan.tp1,
        color: '#15803D',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: 'TP1',
      });
      candleSeries.createPriceLine({
        price: plan.tp2,
        color: '#15803D',
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        axisLabelVisible: true,
        title: 'TP2',
      });
    } else {
      candleSeries.createPriceLine({
        price: report.referenceLevels.nearestSupport,
        color: '#15803D',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: 'Hỗ trợ',
      });
      candleSeries.createPriceLine({
        price: report.referenceLevels.nearestResistance,
        color: '#B91C1C',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: 'Kháng cự',
      });
    }

    chart.timeScale().fitContent();

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const width = Math.floor(entry.contentRect.width);
          if (width > 0) {
            chart.applyOptions({ width });
          }
        }
      });
      resizeObserver.observe(container);
    }

    return () => {
      resizeObserver?.disconnect();
      chart.remove();
    };
  }, [
    sortedCandles,
    activeTf,
    showEmaFast,
    showEmaMid,
    showEmaSlow,
    emaPeriods.fast,
    emaPeriods.mid,
    emaPeriods.slow,
    report.tradePlan,
    report.referenceLevels.nearestSupport,
    report.referenceLevels.nearestResistance,
  ]);

  return (
    <section
      aria-label="Biểu đồ giá và đường trung bình EMA"
      className="border-b border-[#D6D0C4] py-6"
    >
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-serif-editorial text-lg font-bold text-[#1C1917]">
            Biểu đồ diễn biến giá &amp; Mốc kỹ thuật
          </h2>
          <p className="text-xs text-[#57534E]">
            {report.tradePlan !== null
              ? 'Hiển thị Vùng mua, Cắt lỗ (SL), TP1 và TP2 theo kế hoạch lệnh Spot'
              : 'Hiển thị mốc Hỗ trợ và Kháng cự gần nhất làm tham chiếu'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* EMA checkboxes */}
          <div className="flex items-center gap-3 border border-[#D6D0C4] bg-[#F3EFE6] px-2.5 py-1 text-xs">
            <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showEmaFast}
                onChange={(e) => setShowEmaFast(e.target.checked)}
                className="accent-[#B45309]"
              />
              <span className="font-mono-tabular font-medium text-[#B45309]">
                EMA {emaPeriods.fast}
              </span>
            </label>
            <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showEmaMid}
                onChange={(e) => setShowEmaMid(e.target.checked)}
                className="accent-[#2563EB]"
              />
              <span className="font-mono-tabular font-medium text-[#2563EB]">
                EMA {emaPeriods.mid}
              </span>
            </label>
            <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showEmaSlow}
                onChange={(e) => setShowEmaSlow(e.target.checked)}
                className="accent-[#1C1917]"
              />
              <span className="font-mono-tabular font-medium text-[#1C1917]">
                EMA {emaPeriods.slow}
              </span>
            </label>
          </div>

          {/* Timeframe tabs */}
          <div
            role="tablist"
            aria-label="Chọn khung thời gian biểu đồ"
            className="inline-flex border border-[#D6D0C4] bg-[#FAF7F0] divide-x divide-[#D6D0C4]"
          >
            {TIMEFRAME_TABS.map(({ tf, label }) => {
              const active = tf === activeTf;
              return (
                <button
                  key={tf}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveTf(tf)}
                  className={`font-mono-tabular px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#1C1917] text-[#FAF7F0]'
                      : 'text-[#57534E] hover:bg-[#F3EFE6] hover:text-[#1C1917]'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="border border-[#D6D0C4] bg-[#FAF7F0] p-1">
        {sortedCandles.length > 0 ? (
          <div ref={containerRef} className="h-[380px] w-full" />
        ) : (
          <div className="flex h-[380px] items-center justify-center text-sm text-[#57534E]">
            Chưa có dữ liệu nến cho khung {activeTf.toUpperCase()}.
          </div>
        )}
      </div>
    </section>
  );
}

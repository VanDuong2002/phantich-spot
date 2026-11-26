import type { Candle, IndicatorParams, IndicatorSnapshot } from '../types/market';

function isValidPeriod(period: number): boolean {
  return Number.isInteger(period) && period >= 1;
}

function nullSeries(length: number): (number | null)[] {
  return Array.from({ length }, () => null);
}

function toRsi(avgGain: number, avgLoss: number): number {
  if (avgGain === 0 && avgLoss === 0) return 50;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/**
 * Compute Exponential Moving Average (EMA) series initialized with the SMA of the first `period` values.
 * Returns `null` for indices before enough history is available.
 */
export function calcEMASeries(values: number[], period: number): (number | null)[] {
  const result = nullSeries(values.length);
  if (!isValidPeriod(period) || values.length < period) {
    return result;
  }

  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += values[i];
  }

  let ema = sum / period;
  if (!Number.isFinite(ema)) {
    return result;
  }

  result[period - 1] = ema;
  const k = 2 / (period + 1);

  for (let i = period; i < values.length; i++) {
    const next = values[i] * k + ema * (1 - k);
    if (!Number.isFinite(next)) {
      return result;
    }
    ema = next;
    result[i] = ema;
  }

  return result;
}

/**
 * Compute Relative Strength Index (RSI) series using Wilder's smoothing method.
 */
export function calcRSISeries(values: number[], period: number): (number | null)[] {
  const result = nullSeries(values.length);
  if (!isValidPeriod(period) || values.length <= period) {
    return result;
  }

  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const change = values[i] - values[i - 1];
    if (change > 0) gainSum += change;
    else if (change < 0) lossSum += -change;
  }

  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  if (!Number.isFinite(avgGain) || !Number.isFinite(avgLoss)) {
    return result;
  }

  result[period] = toRsi(avgGain, avgLoss);

  for (let i = period + 1; i < values.length; i++) {
    const change = values[i] - values[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    if (!Number.isFinite(avgGain) || !Number.isFinite(avgLoss)) {
      return result;
    }

    result[i] = toRsi(avgGain, avgLoss);
  }

  return result;
}

/**
 * Compute MACD line, signal line, and histogram series.
 */
export function calcMACDSeries(
  values: number[],
  fast: number,
  slow: number,
  signal: number,
): {
  macd: (number | null)[];
  signal: (number | null)[];
  histogram: (number | null)[];
} {
  const length = values.length;
  const emaFast = calcEMASeries(values, fast);
  const emaSlow = calcEMASeries(values, slow);

  const macd: (number | null)[] = Array.from({ length }, (_, i) => {
    const f = emaFast[i];
    const s = emaSlow[i];
    return f !== null && s !== null ? f - s : null;
  });

  const signalLine = nullSeries(length);
  const histogram = nullSeries(length);

  const firstValidIdx = macd.findIndex((v) => v !== null);
  if (firstValidIdx === -1) {
    return { macd, signal: signalLine, histogram };
  }

  const firstNullAfter = macd.indexOf(null, firstValidIdx);
  const endIdx = firstNullAfter === -1 ? length : firstNullAfter;
  const validMacd = macd.slice(firstValidIdx, endIdx) as number[];
  const validSignal = calcEMASeries(validMacd, signal);

  for (let j = 0; j < validSignal.length; j++) {
    const idx = firstValidIdx + j;
    const sig = validSignal[j];
    signalLine[idx] = sig;
    if (sig !== null && macd[idx] !== null) {
      histogram[idx] = macd[idx]! - sig;
    }
  }

  return { macd, signal: signalLine, histogram };
}

/**
 * Compute Average True Range (ATR) series using Wilder's smoothing method.
 */
export function calcATRSeries(candles: Candle[], period: number): (number | null)[] {
  const result = nullSeries(candles.length);
  if (!isValidPeriod(period) || candles.length < period) {
    return result;
  }

  const trueRanges: number[] = candles.map((c, i) => {
    const hl = c.high - c.low;
    if (i === 0) return hl;
    const prevClose = candles[i - 1].close;
    return Math.max(hl, Math.abs(c.high - prevClose), Math.abs(c.low - prevClose));
  });

  let trSum = 0;
  for (let i = 0; i < period; i++) {
    trSum += trueRanges[i];
  }

  let atr = trSum / period;
  if (!Number.isFinite(atr)) {
    return result;
  }

  result[period - 1] = atr;

  for (let i = period; i < candles.length; i++) {
    const next = (atr * (period - 1) + trueRanges[i]) / period;
    if (!Number.isFinite(next)) {
      return result;
    }
    atr = next;
    result[i] = atr;
  }

  return result;
}

/**
 * Compute the ratio of the latest candle volume to its Simple Moving Average over `period` candles.
 */
export function calcVolumeRatio(candles: Candle[], period: number): number | null {
  if (!isValidPeriod(period) || candles.length < period) {
    return null;
  }

  const recent = candles.slice(-period);
  const sum = recent.reduce((acc, c) => acc + c.volume, 0);
  const avg = sum / period;
  const latestVolume = candles[candles.length - 1].volume;

  if (!Number.isFinite(avg) || avg <= 0 || !Number.isFinite(latestVolume)) {
    return null;
  }

  return latestVolume / avg;
}

function isPivotExtreme(
  candles: Candle[],
  index: number,
  lookback: number,
  kind: 'high' | 'low',
): boolean {
  const target = candles[index][kind];
  for (let j = index - lookback; j < index; j++) {
    const neighbor = candles[j][kind];
    if (kind === 'high' ? target < neighbor : target > neighbor) return false;
  }
  for (let j = index + 1; j <= index + lookback; j++) {
    const neighbor = candles[j][kind];
    if (kind === 'high' ? target <= neighbor : target >= neighbor) return false;
  }
  return true;
}

/**
 * Find swing support levels (below current price, sorted descending / nearest first)
 * and swing resistance levels (above current price, sorted ascending / nearest first).
 */
export function findSwingLevels(
  candles: Candle[],
  lookback = 3,
): { supports: number[]; resistances: number[] } {
  if (!isValidPeriod(lookback) || candles.length < lookback * 2 + 1) {
    return { supports: [], resistances: [] };
  }

  const currentPrice = candles[candles.length - 1].close;
  const supportSet = new Set<number>();
  const resistanceSet = new Set<number>();

  for (let i = lookback; i < candles.length - lookback; i++) {
    if (isPivotExtreme(candles, i, lookback, 'low') && candles[i].low < currentPrice) {
      supportSet.add(candles[i].low);
    }
    if (isPivotExtreme(candles, i, lookback, 'high') && candles[i].high > currentPrice) {
      resistanceSet.add(candles[i].high);
    }
  }

  return {
    supports: Array.from(supportSet).sort((a, b) => b - a),
    resistances: Array.from(resistanceSet).sort((a, b) => a - b),
  };
}

/**
 * Compute the latest technical indicator snapshot for a candle series using the given parameters.
 */
export function computeIndicatorSnapshot(
  candles: Candle[],
  params: IndicatorParams,
): IndicatorSnapshot {
  if (candles.length === 0) {
    return {
      price: 0,
      ema21: null,
      ema50: null,
      ema200: null,
      rsi: null,
      macd: null,
      macdSignal: null,
      macdHistogram: null,
      atr: null,
      volumeRatio: null,
    };
  }

  const closes = candles.map((c) => c.close);
  const macdSeries = calcMACDSeries(closes, params.macdFast, params.macdSlow, params.macdSignal);

  return {
    price: closes[closes.length - 1],
    ema21: calcEMASeries(closes, params.emaFast).at(-1) ?? null,
    ema50: calcEMASeries(closes, params.emaMid).at(-1) ?? null,
    ema200: calcEMASeries(closes, params.emaSlow).at(-1) ?? null,
    rsi: calcRSISeries(closes, params.rsiPeriod).at(-1) ?? null,
    macd: macdSeries.macd.at(-1) ?? null,
    macdSignal: macdSeries.signal.at(-1) ?? null,
    macdHistogram: macdSeries.histogram.at(-1) ?? null,
    atr: calcATRSeries(candles, params.atrPeriod).at(-1) ?? null,
    volumeRatio: calcVolumeRatio(candles, params.volumeSmaPeriod),
  };
}

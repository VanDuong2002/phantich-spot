import type {
  AnalysisMode,
  Candle,
  IndicatorParams,
  IndicatorSnapshot,
  Timeframe,
  TimeframeAnalysis,
} from '../types/market';
import { calcMACDSeries, computeIndicatorSnapshot } from './indicators';

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(max, Math.max(min, value));
}

function scoreEma(snapshot: IndicatorSnapshot): number {
  const { price, ema21, ema50, ema200 } = snapshot;
  if (!Number.isFinite(price) || price <= 0 || ema21 === null) {
    return 0;
  }

  if (ema50 === null) {
    if (price > ema21) return 50;
    if (price < ema21) return -50;
    return 0;
  }

  // Fallback for short history (e.g. newly listed coins on 1W where EMA200 is unavailable)
  if (ema200 === null) {
    let score = 0;
    score += price > ema21 ? 35 : price < ema21 ? -35 : 0;
    score += price > ema50 ? 35 : price < ema50 ? -35 : 0;
    score += ema21 > ema50 ? 30 : ema21 < ema50 ? -30 : 0;
    return clamp(score, -100, 100);
  }

  let score = 0;
  score += price > ema21 ? 25 : price < ema21 ? -25 : 0;
  score += price > ema50 ? 25 : price < ema50 ? -25 : 0;
  score += price > ema200 ? 20 : price < ema200 ? -20 : 0;
  score += ema21 > ema50 ? 15 : ema21 < ema50 ? -15 : 0;
  score += ema50 > ema200 ? 15 : ema50 < ema200 ? -15 : 0;

  return clamp(score, -100, 100);
}

function scoreRsi(rsi: number | null, params: IndicatorParams): number {
  if (rsi === null || !Number.isFinite(rsi)) {
    return 0;
  }

  const oversold = params.rsiOversold;
  const overbought = params.rsiOverbought;

  // Penalize chasing severely overbought conditions (> 75)
  if (rsi > 75) return -35;
  if (rsi > overbought) return 15;
  if (rsi >= 60) return 45;
  // Sweet spot: recovery and healthy accumulation zone (35 - 60)
  if (rsi >= 35) return 65;
  if (rsi >= oversold) return 25;
  return -15;
}

function scoreMacd(
  snapshot: IndicatorSnapshot,
  candles: Candle[],
  params: IndicatorParams,
): number {
  const { macd, macdSignal, macdHistogram } = snapshot;
  if (macd === null || macdSignal === null || macdHistogram === null) {
    return 0;
  }

  let score = 0;
  score += macd > macdSignal ? 40 : macd < macdSignal ? -40 : 0;
  score += macd > 0 ? 25 : macd < 0 ? -25 : 0;

  const closes = candles.map((c) => c.close);
  const series = calcMACDSeries(closes, params.macdFast, params.macdSlow, params.macdSignal);
  const prevHistogram = series.histogram.length >= 2 ? series.histogram[series.histogram.length - 2] : null;

  if (prevHistogram !== null && Number.isFinite(prevHistogram)) {
    if (macdHistogram > prevHistogram) score += 35;
    else if (macdHistogram < prevHistogram) score -= 35;
  } else {
    score += macdHistogram > 0 ? 15 : macdHistogram < 0 ? -15 : 0;
  }

  return clamp(score, -100, 100);
}

function scoreVolume(snapshot: IndicatorSnapshot, candles: Candle[]): number {
  const { volumeRatio } = snapshot;
  if (volumeRatio === null || !Number.isFinite(volumeRatio) || candles.length === 0) {
    return 0;
  }

  const latest = candles[candles.length - 1];
  const direction = latest.close > latest.open ? 1 : latest.close < latest.open ? -1 : 0;
  if (direction === 0) return 0;

  let magnitude = 10;
  if (volumeRatio >= 1.8) magnitude = 100;
  else if (volumeRatio >= 1.25) magnitude = 70;
  else if (volumeRatio >= 0.9) magnitude = 35;

  return clamp(direction * magnitude, -100, 100);
}

/**
 * Score a single timeframe in the range [-100, +100] and classify its trend.
 */
export function scoreTimeframe(
  candles: Candle[],
  timeframe: Timeframe,
  mode: AnalysisMode,
): TimeframeAnalysis {
  const snapshot = computeIndicatorSnapshot(candles, mode.params);
  const { ema, rsi, macd, volume } = mode.indicatorWeights;
  const totalWeight = ema + rsi + macd + volume;

  const emaScore = scoreEma(snapshot);
  const rsiScore = scoreRsi(snapshot.rsi, mode.params);
  const macdScore = scoreMacd(snapshot, candles, mode.params);
  const volumeScore = scoreVolume(snapshot, candles);

  const weighted =
    totalWeight > 0
      ? (emaScore * ema + rsiScore * rsi + macdScore * macd + volumeScore * volume) / totalWeight
      : 0;

  const score = Math.round(clamp(weighted, -100, 100) * 10) / 10;
  const trend: TimeframeAnalysis['trend'] =
    score >= 15 ? 'UP' : score <= -15 ? 'DOWN' : 'NEUTRAL';

  return {
    timeframe,
    score,
    trend,
    snapshot,
  };
}

/**
 * Combine multi-timeframe scores (each in [-100, +100]) into a normalized [0, 100] composite score.
 */
export function computeCompositeScore(
  timeframes: Record<Timeframe, TimeframeAnalysis>,
  weights: Record<Timeframe, number>,
): number {
  const keys: Timeframe[] = ['1w', '1d', '4h', '1h'];
  let weightedSum = 0;
  let totalWeight = 0;

  for (const tf of keys) {
    const w = weights[tf];
    const tfScore = timeframes[tf]?.score ?? 0;
    if (Number.isFinite(w) && w > 0 && Number.isFinite(tfScore)) {
      weightedSum += tfScore * w;
      totalWeight += w;
    }
  }

  const rawScore = totalWeight > 0 ? weightedSum / totalWeight : 0;
  const normalized = ((clamp(rawScore, -100, 100) + 100) / 2);
  return Math.round(clamp(normalized, 0, 100) * 10) / 10;
}

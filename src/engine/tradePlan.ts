import type {
  AnalysisMode,
  Candle,
  ReferenceLevels,
  TradePlan,
} from '../types/market';
import { computeIndicatorSnapshot, findSwingLevels } from './indicators';

function roundPct(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

/**
 * Compute Spot trade plan (entry zone, stop loss, TP1, TP2, risk/reward) and
 * structural reference levels (nearest support, nearest resistance, invalidation level).
 */
export function buildTradePlanAndLevels(
  candles4h: Candle[],
  candles1d: Candle[],
  currentPrice: number,
  mode: AnalysisMode,
): { tradePlan: TradePlan; referenceLevels: ReferenceLevels } {
  const snap4h = computeIndicatorSnapshot(candles4h, mode.params);
  const snap1d = computeIndicatorSnapshot(candles1d, mode.params);

  const safePrice =
    Number.isFinite(currentPrice) && currentPrice > 0
      ? currentPrice
      : snap4h.price > 0
        ? snap4h.price
        : snap1d.price > 0
          ? snap1d.price
          : 1;

  const atr =
    snap4h.atr !== null && Number.isFinite(snap4h.atr) && snap4h.atr > 0
      ? snap4h.atr
      : snap1d.atr !== null && Number.isFinite(snap1d.atr) && snap1d.atr > 0
        ? snap1d.atr
        : safePrice * 0.02;

  const swings4h = findSwingLevels(candles4h, 3);
  const swings1d = findSwingLevels(candles1d, 3);

  const supports = Array.from(new Set([...swings4h.supports, ...swings1d.supports]))
    .filter((lvl) => Number.isFinite(lvl) && lvl > 0 && lvl < safePrice)
    .sort((a, b) => b - a);

  const resistances = Array.from(new Set([...swings4h.resistances, ...swings1d.resistances]))
    .filter((lvl) => Number.isFinite(lvl) && lvl > safePrice)
    .sort((a, b) => a - b);

  // Reference support & resistance with safe EMA/ATR fallbacks when monotonic trend has no pivots
  const emaSupportCandidate =
    snap4h.ema21 !== null && snap4h.ema21 > 0 && snap4h.ema21 < safePrice
      ? snap4h.ema21
      : snap4h.ema50 !== null && snap4h.ema50 > 0 && snap4h.ema50 < safePrice
        ? snap4h.ema50
        : null;

  const nearestSupport =
    supports[0] ??
    emaSupportCandidate ??
    Math.max(safePrice * 0.05, safePrice - 1.5 * atr);

  const nearestResistance = resistances[0] ?? safePrice + 2 * atr;
  const nextResistance =
    resistances.find((r) => r > nearestResistance * 1.005) ??
    nearestResistance + 1.5 * atr;

  // Entry zone around [min(price, ema21), price], bounded by ATR
  const entryHigh = safePrice;
  const rawEntryLow =
    snap4h.ema21 !== null && Number.isFinite(snap4h.ema21) && snap4h.ema21 > 0 && snap4h.ema21 < safePrice
      ? snap4h.ema21
      : safePrice - 0.5 * atr;

  const atrEntryFloor = Math.max(safePrice * 0.5, safePrice - 1.2 * atr);
  const entryLow = Math.max(atrEntryFloor, Math.min(rawEntryLow, entryHigh));
  const entryMid = (entryLow + entryHigh) / 2;

  // Stop loss below nearest swing low minus 0.5 * ATR, at least 1.5 * ATR below entry
  const swingBelowEntry = supports.find((s) => s < entryLow) ?? Math.min(nearestSupport, entryLow);
  const swingBasedSL = swingBelowEntry - 0.5 * atr;
  const minAtrSL = entryLow - 1.5 * atr;
  const maxAtrFloor = Math.max(entryLow * 0.05, entryLow - 4 * atr);
  const stopLoss = Math.min(entryLow * 0.999, Math.max(maxAtrFloor, Math.min(swingBasedSL, minAtrSL)));

  const risk = Math.max(entryMid - stopLoss, safePrice * 0.001);

  // TP1 = max(nearest resistance, entry + 1.5 * risk); TP2 = max(next resistance, entry + 2.5 * risk)
  const tp1 = Math.max(nearestResistance, entryMid + 1.5 * risk, entryHigh + 0.5 * atr);
  const tp2 = Math.max(nextResistance, entryMid + 2.5 * risk, tp1 + risk);

  const stopLossPct = roundPct(((stopLoss - entryMid) / entryMid) * 100);
  const tp1Pct = roundPct(((tp1 - entryMid) / entryMid) * 100);
  const tp2Pct = roundPct(((tp2 - entryMid) / entryMid) * 100);
  const riskReward = Math.round(((tp1 - entryMid) / risk) * 100) / 100;

  const invalidationLevel = Math.max(
    safePrice * 0.02,
    Math.min(stopLoss, nearestSupport - 0.5 * atr),
  );

  return {
    tradePlan: {
      entryLow,
      entryHigh,
      stopLoss,
      stopLossPct,
      tp1,
      tp1Pct,
      tp2,
      tp2Pct,
      riskReward,
    },
    referenceLevels: {
      nearestSupport,
      nearestResistance,
      invalidationLevel,
    },
  };
}

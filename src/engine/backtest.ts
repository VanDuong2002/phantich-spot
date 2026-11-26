import type {
  AnalysisMode,
  BacktestResult,
  Candle,
  TimeframeAnalysis,
} from '../types/market';
import { scoreTimeframe } from './scorer';
import { buildTradePlanAndLevels } from './tradePlan';

const MIN_HISTORY_4H = 210;

export const BACKTEST_RULE_SUMMARY_VI =
  'Vào ở giá đóng cửa nến 4H báo MUA · Chốt 50% tại TP1 (dời SL về hòa vốn), 50% tại TP2';

interface OpenPosition {
  entry: number;
  initialSl: number;
  sl: number;
  tp1: number;
  tp2: number;
  remaining: number;
  tp1Hit: boolean;
  realizedReturnPct: number;
}

interface ClosedTrade {
  returnPct: number;
  rMultiple: number;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

function computeTwoTfScore(
  analysis4h: TimeframeAnalysis,
  analysis1d: TimeframeAnalysis | null,
  mode: AnalysisMode,
): number {
  const w4h = Math.max(0, mode.timeframeWeights['4h']);
  const w1d = analysis1d ? Math.max(0, mode.timeframeWeights['1d']) : 0;
  const totalWeight = w4h + w1d;

  const rawScore =
    totalWeight > 0
      ? (analysis4h.score * w4h + (analysis1d?.score ?? 0) * w1d) / totalWeight
      : analysis4h.score;

  return ((clamp(rawScore, -100, 100) + 100) / 2);
}

/**
 * Run a fast, no-lookahead historical backtest on 4H candles filtered by closed 1D candles.
 *
 * Rules:
 * - Starts at 4H index 210 (enough history for EMA200) through the penultimate 4H candle.
 * - At each 4H bar `i`, only 1D candles with `closeTime <= candles4h[i].closeTime` are visible.
 * - Enters at 4H close on MUA signal; exits via SL / TP1 (50% + move SL to breakeven) / TP2 (50%) / BAN.
 */
export function runQuickBacktest(
  candles4h: Candle[],
  candles1d: Candle[],
  mode: AnalysisMode,
): BacktestResult {
  const lastIndex = candles4h.length - 1; // exclusive upper bound (penultimate candle is lastIndex - 1)
  if (lastIndex <= MIN_HISTORY_4H) {
    return {
      totalTrades: 0,
      winRate: 0,
      avgRiskReward: 0,
      netReturnPct: 0,
      candlesTested: 0,
      ruleSummaryVi: BACKTEST_RULE_SUMMARY_VI,
    };
  }

  const closedTrades: ClosedTrade[] = [];
  let position: OpenPosition | null = null;

  // Incremental cursor over chronological 1D candles to enforce strict no-lookahead in O(N)
  let cursor1d = 0;
  let cachedCursor1d = -1;
  let cachedClosed1d: Candle[] = [];
  let cachedAnalysis1d: TimeframeAnalysis | null = null;

  const finalizeTrade = (pos: OpenPosition): void => {
    const initialRiskPct = ((pos.entry - pos.initialSl) / pos.entry) * 100;
    const rMultiple =
      initialRiskPct > 0 ? pos.realizedReturnPct / initialRiskPct : 0;
    closedTrades.push({
      returnPct: pos.realizedReturnPct,
      rMultiple,
    });
  };

  for (let i = MIN_HISTORY_4H; i < lastIndex; i++) {
    const bar = candles4h[i];

    // Advance 1D cursor to include only fully closed 1D candles at or before bar.closeTime
    while (cursor1d < candles1d.length && candles1d[cursor1d].closeTime <= bar.closeTime) {
      cursor1d++;
    }

    if (cursor1d !== cachedCursor1d) {
      cachedCursor1d = cursor1d;
      cachedClosed1d = cursor1d > 0 ? candles1d.slice(0, cursor1d) : [];
      cachedAnalysis1d =
        cachedClosed1d.length > 0
          ? scoreTimeframe(cachedClosed1d, '1d', mode)
          : null;
    }

    // 1) Manage open position exits on subsequent bars
    if (position !== null) {
      if (!position.tp1Hit) {
        if (bar.low <= position.sl) {
          position.realizedReturnPct +=
            position.remaining * ((position.sl - position.entry) / position.entry) * 100;
          position.remaining = 0;
          finalizeTrade(position);
          position = null;
          continue;
        } else if (bar.high >= position.tp1) {
          position.realizedReturnPct +=
            0.5 * ((position.tp1 - position.entry) / position.entry) * 100;
          position.remaining = 0.5;
          position.tp1Hit = true;
          position.sl = position.entry; // Move SL to breakeven
        }
      } else {
        if (bar.high >= position.tp2) {
          position.realizedReturnPct +=
            position.remaining * ((position.tp2 - position.entry) / position.entry) * 100;
          position.remaining = 0;
          finalizeTrade(position);
          position = null;
          continue;
        } else if (bar.low <= position.sl) {
          position.realizedReturnPct +=
            position.remaining * ((position.sl - position.entry) / position.entry) * 100;
          position.remaining = 0;
          finalizeTrade(position);
          position = null;
          continue;
        }
      }
    }

    // 2) Evaluate 4H + 1D composite signal
    const window4h = candles4h.slice(0, i + 1);
    const analysis4h = scoreTimeframe(window4h, '4h', mode);
    const compositeScore = computeTwoTfScore(analysis4h, cachedAnalysis1d, mode);

    // 3) If still in a position, check BAN exit signal
    if (position !== null) {
      if (compositeScore <= mode.sellThreshold) {
        position.realizedReturnPct +=
          position.remaining * ((bar.close - position.entry) / position.entry) * 100;
        position.remaining = 0;
        finalizeTrade(position);
        position = null;
      }
      continue;
    }

    // 4) Flat: check MUA entry condition
    const higherTfAllowed =
      !mode.requireHigherTfNotBearish ||
      cachedAnalysis1d === null ||
      cachedAnalysis1d.trend !== 'DOWN';

    if (compositeScore >= mode.buyThreshold && higherTfAllowed) {
      const entry = bar.close;
      const { tradePlan } = buildTradePlanAndLevels(window4h, cachedClosed1d, entry, mode);

      if (
        tradePlan.riskReward >= mode.minRiskReward &&
        tradePlan.stopLoss < entry &&
        tradePlan.tp1 > entry &&
        tradePlan.tp2 > tradePlan.tp1
      ) {
        position = {
          entry,
          initialSl: tradePlan.stopLoss,
          sl: tradePlan.stopLoss,
          tp1: tradePlan.tp1,
          tp2: tradePlan.tp2,
          remaining: 1.0,
          tp1Hit: false,
          realizedReturnPct: 0,
        };
      }
    }
  }

  const candlesTested = lastIndex - MIN_HISTORY_4H;
  const totalTrades = closedTrades.length;

  if (totalTrades === 0) {
    return {
      totalTrades: 0,
      winRate: 0,
      avgRiskReward: 0,
      netReturnPct: 0,
      candlesTested,
      ruleSummaryVi: BACKTEST_RULE_SUMMARY_VI,
    };
  }

  let wins = 0;
  let rSum = 0;
  let equity = 1;

  for (const trade of closedTrades) {
    if (trade.returnPct > 0) wins++;
    rSum += trade.rMultiple;
    equity *= 1 + trade.returnPct / 100;
  }

  const winRate = round2((wins / totalTrades) * 100);
  const avgRiskReward = round2(rSum / totalTrades);
  const netReturnPct = round2((equity - 1) * 100);

  return {
    totalTrades,
    winRate,
    avgRiskReward,
    netReturnPct,
    candlesTested,
    ruleSummaryVi: BACKTEST_RULE_SUMMARY_VI,
  };
}

import type {
  AnalysisMode,
  AnalysisReport,
  MultiTimeframeData,
  Timeframe,
  TimeframeAnalysis,
  Verdict,
} from '../types/market';
import { computeCompositeScore, scoreTimeframe } from './scorer';
import { buildTradePlanAndLevels } from './tradePlan';
import { generateNarrative } from './narrative';

/**
 * Run full multi-timeframe Spot technical analysis and produce a complete report
 * with verdict, optional trade plan (MUA only), reference levels, and Vietnamese editorial narrative.
 */
export function analyzeCoin(data: MultiTimeframeData, mode: AnalysisMode): AnalysisReport {
  const timeframes: Record<Timeframe, TimeframeAnalysis> = {
    '1w': scoreTimeframe(data.candles['1w'], '1w', mode),
    '1d': scoreTimeframe(data.candles['1d'], '1d', mode),
    '4h': scoreTimeframe(data.candles['4h'], '4h', mode),
    '1h': scoreTimeframe(data.candles['1h'], '1h', mode),
  };

  const score = computeCompositeScore(timeframes, mode.timeframeWeights);
  const score1D = timeframes['1d'].score;

  const currentPrice =
    Number.isFinite(data.ticker.lastPrice) && data.ticker.lastPrice > 0
      ? data.ticker.lastPrice
      : (data.candles['1h'].at(-1)?.close ?? data.candles['4h'].at(-1)?.close ?? 0);

  const { tradePlan: candidatePlan, referenceLevels } = buildTradePlanAndLevels(
    data.candles['4h'],
    data.candles['1d'],
    currentPrice,
    mode,
  );

  let verdict: Verdict;
  let downgradedForHigherTf = false;
  let downgradedForRiskReward = false;

  if (score >= mode.buyThreshold) {
    if (mode.requireHigherTfNotBearish && score1D < -15) {
      verdict = 'DUNG_NGOAI';
      downgradedForHigherTf = true;
    } else if (candidatePlan.riskReward < mode.minRiskReward) {
      verdict = 'DUNG_NGOAI';
      downgradedForRiskReward = true;
    } else {
      verdict = 'MUA';
    }
  } else if (score <= mode.sellThreshold) {
    verdict = 'BAN';
  } else if (score >= 50 && score1D >= -15) {
    verdict = 'GIU';
  } else {
    verdict = 'DUNG_NGOAI';
  }

  const baseReport: Omit<AnalysisReport, 'headline' | 'summary' | 'reasons' | 'warnings'> = {
    symbol: data.symbol,
    currentPrice,
    priceChangePercent24h: data.ticker.priceChangePercent,
    fetchedAt: data.fetchedAt,
    modeName: mode.name,
    score,
    verdict,
    timeframes,
    tradePlan: verdict === 'MUA' ? candidatePlan : null,
    referenceLevels,
  };

  const narrative = generateNarrative(baseReport, {
    downgradedForHigherTf,
    downgradedForRiskReward,
    calculatedRiskReward: candidatePlan.riskReward,
    minRiskReward: mode.minRiskReward,
  });

  return {
    ...baseReport,
    ...narrative,
  };
}

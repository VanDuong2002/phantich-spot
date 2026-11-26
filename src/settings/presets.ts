import type { AnalysisMode, IndicatorParams, SettingsSchema } from '../types/market';

export const DEFAULT_WATCHLIST: string[] = [
  'BTCUSDT',
  'ETHUSDT',
  'BNBUSDT',
  'SOLUSDT',
];

const DEFAULT_INDICATOR_PARAMS: IndicatorParams = {
  emaFast: 21,
  emaMid: 50,
  emaSlow: 200,
  rsiPeriod: 14,
  rsiOversold: 30,
  rsiOverbought: 70,
  macdFast: 12,
  macdSlow: 26,
  macdSignal: 9,
  atrPeriod: 14,
  volumeSmaPeriod: 20,
};

const DEFAULT_INDICATOR_WEIGHTS = {
  ema: 35,
  rsi: 25,
  macd: 25,
  volume: 15,
};

export const BUILT_IN_MODES: AnalysisMode[] = [
  {
    id: 'conservative',
    name: 'An toàn',
    description: 'Ưu tiên xu hướng khung lớn (1W/1D) và yêu cầu tỷ lệ R:R cao trước khi giải ngân.',
    isBuiltIn: true,
    timeframeWeights: { '1w': 25, '1d': 35, '4h': 30, '1h': 10 },
    indicatorWeights: { ...DEFAULT_INDICATOR_WEIGHTS },
    params: { ...DEFAULT_INDICATOR_PARAMS },
    buyThreshold: 70,
    sellThreshold: 38,
    minRiskReward: 2.0,
    requireHigherTfNotBearish: true,
  },
  {
    id: 'balanced',
    name: 'Cân bằng',
    description: 'Cân bằng giữa xu hướng trung hạn và điểm vào 4H, phù hợp giao dịch Spot tiêu chuẩn.',
    isBuiltIn: true,
    timeframeWeights: { '1w': 20, '1d': 30, '4h': 35, '1h': 15 },
    indicatorWeights: { ...DEFAULT_INDICATOR_WEIGHTS },
    params: { ...DEFAULT_INDICATOR_PARAMS },
    buyThreshold: 65,
    sellThreshold: 35,
    minRiskReward: 1.5,
    requireHigherTfNotBearish: true,
  },
  {
    id: 'aggressive',
    name: 'Năng động',
    description: 'Nhạy hơn với động lượng 4H và 1H, nới lỏng điều kiện khung lớn để bắt sóng sớm.',
    isBuiltIn: true,
    timeframeWeights: { '1w': 10, '1d': 25, '4h': 40, '1h': 25 },
    indicatorWeights: { ...DEFAULT_INDICATOR_WEIGHTS },
    params: { ...DEFAULT_INDICATOR_PARAMS },
    buyThreshold: 60,
    sellThreshold: 32,
    minRiskReward: 1.3,
    requireHigherTfNotBearish: false,
  },
];

function cloneMode(mode: AnalysisMode): AnalysisMode {
  return {
    ...mode,
    timeframeWeights: { ...mode.timeframeWeights },
    indicatorWeights: { ...mode.indicatorWeights },
    params: { ...mode.params },
  };
}

/**
 * Create a fresh copy of the default v1 settings schema using the balanced mode.
 */
export function createDefaultSettings(): SettingsSchema {
  return {
    version: 1,
    activeModeId: 'balanced',
    modes: BUILT_IN_MODES.map(cloneMode),
    watchlist: [...DEFAULT_WATCHLIST],
    extensions: {},
  };
}

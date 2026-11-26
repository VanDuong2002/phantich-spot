import type { AnalysisMode, SettingsSchema } from '../types/market';
import { createDefaultSettings } from './presets';

export const SETTINGS_STORAGE_KEY = 'phantich_settings_v1';

const TIMEFRAME_KEYS = ['1h', '4h', '1d', '1w'] as const;
const INDICATOR_WEIGHT_KEYS = ['ema', 'rsi', 'macd', 'volume'] as const;
const PARAM_KEYS = [
  'emaFast',
  'emaMid',
  'emaSlow',
  'rsiPeriod',
  'rsiOversold',
  'rsiOverbought',
  'macdFast',
  'macdSlow',
  'macdSignal',
  'atrPeriod',
  'volumeSmaPeriod',
] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasFiniteNumbers(
  obj: unknown,
  keys: readonly string[],
  nonNegative = false,
): boolean {
  if (!isPlainObject(obj)) return false;
  return keys.every((key) => {
    const val = obj[key];
    if (typeof val !== 'number' || !Number.isFinite(val)) return false;
    return nonNegative ? val >= 0 : true;
  });
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidAnalysisMode(value: unknown): value is AnalysisMode {
  if (!isPlainObject(value)) return false;
  if (!isNonEmptyString(value.id) || !isNonEmptyString(value.name)) return false;
  if (typeof value.description !== 'string') return false;
  if (typeof value.isBuiltIn !== 'boolean') return false;
  if (!hasFiniteNumbers(value.timeframeWeights, TIMEFRAME_KEYS, true)) return false;
  if (!hasFiniteNumbers(value.indicatorWeights, INDICATOR_WEIGHT_KEYS, true)) return false;
  if (!hasFiniteNumbers(value.params, PARAM_KEYS)) return false;
  if (
    typeof value.buyThreshold !== 'number' ||
    !Number.isFinite(value.buyThreshold) ||
    typeof value.sellThreshold !== 'number' ||
    !Number.isFinite(value.sellThreshold) ||
    typeof value.minRiskReward !== 'number' ||
    !Number.isFinite(value.minRiskReward)
  ) {
    return false;
  }
  return typeof value.requireHigherTfNotBearish === 'boolean';
}

function validateSettingsSchema(
  raw: unknown,
): { ok: true; settings: SettingsSchema } | { ok: false; error: string } {
  if (!isPlainObject(raw)) {
    return { ok: false, error: 'Dữ liệu cài đặt phải là một đối tượng JSON hợp lệ.' };
  }

  if (raw.version !== 1) {
    return {
      ok: false,
      error: 'Phiên bản cấu hình không hợp lệ hoặc không được hỗ trợ (yêu cầu version = 1).',
    };
  }

  if (!Array.isArray(raw.modes) || raw.modes.length === 0 || !raw.modes.every(isValidAnalysisMode)) {
    return {
      ok: false,
      error: 'Danh sách chế độ phân tích (modes) bị trống hoặc chứa cấu hình không hợp lệ.',
    };
  }

  if (
    !isNonEmptyString(raw.activeModeId) ||
    !raw.modes.some((mode) => mode.id === raw.activeModeId)
  ) {
    return {
      ok: false,
      error: 'Chế độ phân tích đang chọn (activeModeId) không tồn tại trong danh sách modes.',
    };
  }

  if (!Array.isArray(raw.watchlist) || !raw.watchlist.every(isNonEmptyString)) {
    return {
      ok: false,
      error: 'Danh sách theo dõi (watchlist) phải là mảng các mã giao dịch hợp lệ.',
    };
  }

  let extensions: Record<string, unknown> = {};
  if (raw.extensions !== undefined) {
    if (!isPlainObject(raw.extensions)) {
      return {
        ok: false,
        error: 'Trường mở rộng (extensions) phải là một đối tượng JSON.',
      };
    }
    extensions = raw.extensions;
  }

  return {
    ok: true,
    settings: {
      version: 1,
      activeModeId: raw.activeModeId,
      modes: raw.modes,
      watchlist: raw.watchlist,
      extensions,
    },
  };
}

/**
 * Load settings from localStorage, falling back to default settings on missing or invalid data.
 */
export function loadSettings(): SettingsSchema {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return createDefaultSettings();
    const result = importSettingsJson(raw);
    return result.ok ? result.settings : createDefaultSettings();
  } catch {
    return createDefaultSettings();
  }
}

/**
 * Persist the given settings schema to localStorage.
 */
export function saveSettings(settings: SettingsSchema): void {
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

/**
 * Serialize settings into a pretty-printed JSON string for export.
 */
export function exportSettingsJson(settings: SettingsSchema): string {
  return JSON.stringify(settings, null, 2);
}

/**
 * Parse and validate an imported JSON settings string, returning a Vietnamese error message on failure.
 */
export function importSettingsJson(
  raw: string,
): { ok: true; settings: SettingsSchema } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      error: 'Chuỗi JSON cấu hình không đúng định dạng, không thể đọc dữ liệu.',
    };
  }

  return validateSettingsSchema(parsed);
}

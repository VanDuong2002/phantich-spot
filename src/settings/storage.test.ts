import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadSettings,
  saveSettings,
  exportSettingsJson,
  importSettingsJson,
} from './storage';
import {
  DEFAULT_WATCHLIST,
  BUILT_IN_MODES,
  createDefaultSettings,
} from './presets';

describe('settings presets', () => {
  it('defines the three built-in analysis modes with exact weights and thresholds', () => {
    expect(BUILT_IN_MODES.map((m) => m.id)).toEqual([
      'conservative',
      'balanced',
      'aggressive',
    ]);

    const conservative = BUILT_IN_MODES.find((m) => m.id === 'conservative')!;
    expect(conservative.isBuiltIn).toBe(true);
    expect(conservative.timeframeWeights).toEqual({
      '1w': 25,
      '1d': 35,
      '4h': 30,
      '1h': 10,
    });
    expect(conservative.buyThreshold).toBe(70);
    expect(conservative.sellThreshold).toBe(38);
    expect(conservative.minRiskReward).toBe(2.0);
    expect(conservative.requireHigherTfNotBearish).toBe(true);

    const balanced = BUILT_IN_MODES.find((m) => m.id === 'balanced')!;
    expect(balanced.isBuiltIn).toBe(true);
    expect(balanced.timeframeWeights).toEqual({
      '1w': 20,
      '1d': 30,
      '4h': 35,
      '1h': 15,
    });
    expect(balanced.buyThreshold).toBe(65);
    expect(balanced.sellThreshold).toBe(35);
    expect(balanced.minRiskReward).toBe(1.5);
    expect(balanced.requireHigherTfNotBearish).toBe(true);

    const aggressive = BUILT_IN_MODES.find((m) => m.id === 'aggressive')!;
    expect(aggressive.isBuiltIn).toBe(true);
    expect(aggressive.timeframeWeights).toEqual({
      '1w': 10,
      '1d': 25,
      '4h': 40,
      '1h': 25,
    });
    expect(aggressive.buyThreshold).toBe(60);
    expect(aggressive.sellThreshold).toBe(32);
    expect(aggressive.minRiskReward).toBe(1.3);
    expect(aggressive.requireHigherTfNotBearish).toBe(false);

    for (const mode of BUILT_IN_MODES) {
      expect(mode.indicatorWeights).toEqual({
        ema: 35,
        rsi: 25,
        macd: 25,
        volume: 15,
      });
      expect(mode.params).toEqual({
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
      });
    }
  });

  it('createDefaultSettings returns isolated clones of defaults', () => {
    const a = createDefaultSettings();
    const b = createDefaultSettings();
    a.watchlist.push('DOGEUSDT');
    a.modes[0].buyThreshold = 99;
    expect(b.watchlist).toEqual(DEFAULT_WATCHLIST);
    expect(b.modes[0].buyThreshold).toBe(70);
  });
});

describe('settings storage', () => {
  beforeEach(() => localStorage.clear());

  it('returns default balanced settings when storage is empty', () => {
    const s = loadSettings();
    expect(s.version).toBe(1);
    expect(s.activeModeId).toBe('balanced');
    expect(s.modes).toHaveLength(3);
    expect(s.watchlist).toEqual(['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT']);
    expect(s.extensions).toEqual({});
  });

  it('recovers gracefully when localStorage contains corrupted JSON', () => {
    localStorage.setItem('phantich_settings_v1', '{broken json');
    const s = loadSettings();
    expect(s.activeModeId).toBe('balanced');
    expect(s.modes).toHaveLength(3);
  });

  it('recovers gracefully when localStorage contains invalid schema', () => {
    localStorage.setItem(
      'phantich_settings_v1',
      JSON.stringify({ version: 1, activeModeId: 'missing', modes: [], watchlist: [] }),
    );
    const s = loadSettings();
    expect(s.activeModeId).toBe('balanced');
    expect(s.modes).toHaveLength(3);
  });

  it('saves and reloads customized settings from localStorage', () => {
    const s = loadSettings();
    s.activeModeId = 'conservative';
    s.watchlist = ['BTCUSDT', 'ETHUSDT'];
    saveSettings(s);

    const reloaded = loadSettings();
    expect(reloaded.activeModeId).toBe('conservative');
    expect(reloaded.watchlist).toEqual(['BTCUSDT', 'ETHUSDT']);
  });

  it('round-trips JSON export/import and preserves extensions bag', () => {
    const s = loadSettings();
    s.extensions = { scannerV2: { topN: 50 } };
    saveSettings(s);
    const json = exportSettingsJson(loadSettings());
    const parsed = importSettingsJson(json);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.settings.extensions).toEqual({ scannerV2: { topN: 50 } });
    }
  });

  it('defaults omitted extensions bag to empty object on valid import', () => {
    const s = loadSettings();
    const { extensions: _omit, ...withoutExt } = s;
    const parsed = importSettingsJson(JSON.stringify(withoutExt));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.settings.extensions).toEqual({});
    }
  });

  it('rejects invalid JSON or wrong schema version with Vietnamese error', () => {
    const badVersion = importSettingsJson('{"version": 999}');
    expect(badVersion.ok).toBe(false);
    if (!badVersion.ok) expect(badVersion.error.length).toBeGreaterThan(5);

    const badJson = importSettingsJson('{not-json');
    expect(badJson.ok).toBe(false);
    if (!badJson.ok) expect(badJson.error.length).toBeGreaterThan(5);

    const missingActiveMode = importSettingsJson(
      JSON.stringify({
        ...createDefaultSettings(),
        activeModeId: 'nonexistent',
      }),
    );
    expect(missingActiveMode.ok).toBe(false);
    if (!missingActiveMode.ok) {
      expect(missingActiveMode.error.length).toBeGreaterThan(5);
    }

    const badWatchlist = importSettingsJson(
      JSON.stringify({
        ...createDefaultSettings(),
        watchlist: [123],
      }),
    );
    expect(badWatchlist.ok).toBe(false);

    const badExtensions = importSettingsJson(
      JSON.stringify({
        ...createDefaultSettings(),
        extensions: ['not-an-object'],
      }),
    );
    expect(badExtensions.ok).toBe(false);
  });
});

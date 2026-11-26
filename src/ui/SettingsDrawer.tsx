import { useEffect, useId, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  CopyPlus,
  Download,
  RotateCcw,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { createDefaultSettings } from '../settings/presets';
import { exportSettingsJson, importSettingsJson } from '../settings/storage';
import type {
  AnalysisMode,
  IndicatorParams,
  SettingsSchema,
  Timeframe,
} from '../types/market';

export interface SettingsDrawerProps {
  open: boolean;
  settings: SettingsSchema;
  onChange: (next: SettingsSchema) => void;
  onClose: () => void;
}

type DrawerTab = 'modes' | 'data';

const TIMEFRAME_FIELDS: { key: Timeframe; label: string }[] = [
  { key: '1w', label: 'Khung 1W' },
  { key: '1d', label: 'Khung 1D' },
  { key: '4h', label: 'Khung 4H' },
  { key: '1h', label: 'Khung 1H' },
];

const INDICATOR_WEIGHT_FIELDS: {
  key: keyof AnalysisMode['indicatorWeights'];
  label: string;
}[] = [
  { key: 'ema', label: 'EMA' },
  { key: 'rsi', label: 'RSI' },
  { key: 'macd', label: 'MACD' },
  { key: 'volume', label: 'Khối lượng' },
];

interface ParamFieldConfig {
  key: keyof IndicatorParams;
  label: string;
  min: number;
  max: number;
}

const PARAM_FIELDS: ParamFieldConfig[] = [
  { key: 'emaFast', label: 'EMA nhanh', min: 2, max: 500 },
  { key: 'emaMid', label: 'EMA trung', min: 2, max: 500 },
  { key: 'emaSlow', label: 'EMA chậm', min: 2, max: 500 },
  { key: 'rsiPeriod', label: 'Chu kỳ RSI', min: 2, max: 100 },
  { key: 'rsiOversold', label: 'RSI quá bán', min: 1, max: 49 },
  { key: 'rsiOverbought', label: 'RSI quá mua', min: 51, max: 99 },
  { key: 'macdFast', label: 'MACD nhanh', min: 2, max: 100 },
  { key: 'macdSlow', label: 'MACD chậm', min: 3, max: 200 },
  { key: 'macdSignal', label: 'MACD tín hiệu', min: 2, max: 100 },
  { key: 'atrPeriod', label: 'Chu kỳ ATR', min: 2, max: 100 },
  { key: 'volumeSmaPeriod', label: 'Chu kỳ KL (SMA)', min: 2, max: 200 },
];

function parseGuardedNumber(
  raw: string,
  min: number,
  max: number,
  integer = true,
): number | null {
  if (raw.trim() === '') return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return null;
  return integer ? Math.round(parsed) : Math.round(parsed * 100) / 100;
}

function readFileAsText(file: File): Promise<string> {
  if (typeof file.text === 'function') {
    return file.text();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Không thể đọc tệp đã chọn.'));
    reader.readAsText(file);
  });
}

function NumericField({
  label,
  value,
  min,
  max,
  step = 1,
  integer = true,
  suffix,
  onValidChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  integer?: boolean;
  suffix?: string;
  onValidChange: (val: number) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={id}
        className="text-[11px] font-medium uppercase tracking-wider text-[#57534E]"
      >
        {label}
      </label>
      <div className="relative flex items-center">
        <input
          id={id}
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => {
            const next = parseGuardedNumber(e.target.value, min, max, integer);
            if (next !== null) {
              onValidChange(next);
            }
          }}
          className="font-mono-tabular w-full border border-[#D6D0C4] bg-[#FAF7F0] px-2.5 py-1.5 text-sm text-[#1C1917] focus:border-[#1C1917] focus:outline-none"
        />
        {suffix && (
          <span className="pointer-events-none absolute right-2.5 text-xs text-[#57534E]">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

export function SettingsDrawer({
  open,
  settings,
  onChange,
  onClose,
}: SettingsDrawerProps) {
  const [activeTab, setActiveTab] = useState<DrawerTab>('modes');
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeMode =
    settings.modes.find((m) => m.id === settings.activeModeId) ?? settings.modes[0];

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open || !activeMode) return null;

  const updateActiveMode = (updater: (mode: AnalysisMode) => AnalysisMode) => {
    const nextModes = settings.modes.map((mode) =>
      mode.id === activeMode.id ? updater(mode) : mode,
    );
    onChange({
      ...settings,
      modes: nextModes,
    });
  };

  const handleSelectMode = (modeId: string) => {
    onChange({
      ...settings,
      activeModeId: modeId,
    });
  };

  const handleCloneMode = () => {
    const newId = `custom-${Date.now()}`;
    const cloned: AnalysisMode = {
      ...activeMode,
      id: newId,
      name: `${activeMode.name} (Bản sao)`,
      isBuiltIn: false,
      timeframeWeights: { ...activeMode.timeframeWeights },
      indicatorWeights: { ...activeMode.indicatorWeights },
      params: { ...activeMode.params },
    };
    onChange({
      ...settings,
      activeModeId: newId,
      modes: [...settings.modes, cloned],
    });
  };

  const handleDeleteMode = () => {
    if (activeMode.isBuiltIn || settings.modes.length <= 1) return;
    const remaining = settings.modes.filter((m) => m.id !== activeMode.id);
    onChange({
      ...settings,
      activeModeId: remaining[0].id,
      modes: remaining,
    });
  };

  const handleExportJson = () => {
    const json = exportSettingsJson(settings);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'phantich-settings.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setStatusMessage({
      type: 'success',
      text: 'Đã xuất cấu hình ra tệp phantich-settings.json.',
    });
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const content = await readFileAsText(file);
      const result = importSettingsJson(content);
      if (!result.ok) {
        setStatusMessage({ type: 'error', text: result.error });
      } else {
        onChange(result.settings);
        setStatusMessage({
          type: 'success',
          text: 'Đã nhập cấu hình thành công và áp dụng ngay lập tức.',
        });
      }
    } catch {
      setStatusMessage({
        type: 'error',
        text: 'Không thể đọc tệp JSON đã chọn. Vui lòng thử lại.',
      });
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleResetDefaults = () => {
    onChange(createDefaultSettings());
    setStatusMessage({
      type: 'success',
      text: 'Đã khôi phục toàn bộ cài đặt về cấu hình mặc định.',
    });
  };

  const timeframeWeightSum =
    activeMode.timeframeWeights['1w'] +
    activeMode.timeframeWeights['1d'] +
    activeMode.timeframeWeights['4h'] +
    activeMode.timeframeWeights['1h'];

  const indicatorWeightSum =
    activeMode.indicatorWeights.ema +
    activeMode.indicatorWeights.rsi +
    activeMode.indicatorWeights.macd +
    activeMode.indicatorWeights.volume;

  const extensionKeys = Object.keys(settings.extensions);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-[#1C1917]/40"
      role="dialog"
      aria-modal="true"
      aria-label="Cài đặt phân tích"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex h-full w-full max-w-xl flex-col border-l border-[#D6D0C4] bg-[#FAF7F0] text-[#1C1917] shadow-2xl">
        {/* Drawer Header */}
        <div className="editorial-double-bottom flex items-start justify-between gap-4 px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#57534E]">
              Cấu hình hệ thống · PhanTich Spot
            </p>
            <h2 className="font-serif-editorial mt-0.5 text-xl font-bold text-[#1C1917]">
              Cài đặt Phân tích
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cài đặt"
            className="border border-[#D6D0C4] bg-[#F3EFE6] p-1.5 text-[#1C1917] transition-colors hover:border-[#1C1917] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Bar */}
        <div
          role="tablist"
          aria-label="Danh mục cài đặt"
          className="grid grid-cols-2 border-b border-[#D6D0C4] bg-[#F3EFE6]"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'modes'}
            onClick={() => setActiveTab('modes')}
            className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer ${
              activeTab === 'modes'
                ? 'border-b-2 border-[#1C1917] bg-[#FAF7F0] text-[#1C1917]'
                : 'text-[#57534E] hover:text-[#1C1917]'
            }`}
          >
            Chế độ phân tích
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'data'}
            onClick={() => setActiveTab('data')}
            className={`border-l border-[#D6D0C4] px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer ${
              activeTab === 'data'
                ? 'border-b-2 border-[#1C1917] bg-[#FAF7F0] text-[#1C1917]'
                : 'text-[#57534E] hover:text-[#1C1917]'
            }`}
          >
            Dữ liệu &amp; Mở rộng
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {activeTab === 'modes' ? (
            <div className="space-y-5">
              {/* Mode Picker */}
              <section className="border border-[#D6D0C4] bg-[#F3EFE6] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D6D0C4] pb-2.5">
                  <h3 className="font-serif-editorial text-sm font-bold uppercase tracking-wider text-[#1C1917]">
                    Chọn chế độ đang dùng
                  </h3>
                  <button
                    type="button"
                    onClick={handleCloneMode}
                    className="inline-flex items-center gap-1.5 border border-[#1C1917] bg-[#FAF7F0] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#1C1917] transition-colors hover:bg-[#1C1917] hover:text-[#FAF7F0] cursor-pointer"
                  >
                    <CopyPlus className="h-3.5 w-3.5" />
                    <span>Nhân bản thành chế độ mới</span>
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {settings.modes.map((mode) => {
                    const isSelected = mode.id === activeMode.id;
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => handleSelectMode(mode.id)}
                        className={`flex flex-col items-start border px-3 py-2 text-left transition-colors cursor-pointer ${
                          isSelected
                            ? 'border-[#1C1917] bg-[#1C1917] text-[#FAF7F0]'
                            : 'border-[#D6D0C4] bg-[#FAF7F0] text-[#1C1917] hover:border-[#1C1917]'
                        }`}
                      >
                        <span className="text-sm font-semibold">{mode.name}</span>
                        <span
                          className={`mt-0.5 text-[10px] uppercase tracking-wider ${
                            isSelected ? 'text-[#D6D0C4]' : 'text-[#57534E]'
                          }`}
                        >
                          {mode.isBuiltIn ? 'Mặc định' : 'Tùy chỉnh'}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Mode Identity & Delete */}
                <div className="mt-4 space-y-3 border-t border-[#D6D0C4] pt-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <div className="flex-1">
                      <label
                        htmlFor="mode-name-input"
                        className="text-[11px] font-medium uppercase tracking-wider text-[#57534E]"
                      >
                        Tên chế độ
                      </label>
                      <input
                        id="mode-name-input"
                        type="text"
                        value={activeMode.name}
                        onChange={(e) => {
                          const nextName = e.target.value;
                          if (nextName.trim().length > 0) {
                            updateActiveMode((m) => ({ ...m, name: nextName }));
                          }
                        }}
                        className="mt-1 w-full border border-[#D6D0C4] bg-[#FAF7F0] px-2.5 py-1.5 text-sm font-medium text-[#1C1917] focus:border-[#1C1917] focus:outline-none"
                      />
                    </div>
                    {!activeMode.isBuiltIn && settings.modes.length > 1 && (
                      <button
                        type="button"
                        onClick={handleDeleteMode}
                        className="inline-flex items-center justify-center gap-1.5 border border-[#B91C1C] bg-[#FAF7F0] px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-[#B91C1C] transition-colors hover:bg-[#B91C1C] hover:text-[#FAF7F0] cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Xóa chế độ</span>
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-[#57534E]">{activeMode.description}</p>
                </div>
              </section>

              {/* Timeframe Weights */}
              <section className="border border-[#D6D0C4] bg-[#F3EFE6] p-4">
                <div className="flex items-center justify-between border-b border-[#D6D0C4] pb-2">
                  <h3 className="font-serif-editorial text-sm font-bold uppercase tracking-wider text-[#1C1917]">
                    Trọng số 4 khung thời gian
                  </h3>
                  <span className="font-mono-tabular text-xs font-medium text-[#57534E]">
                    Tổng: {timeframeWeightSum}%
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {TIMEFRAME_FIELDS.map((tf) => (
                    <NumericField
                      key={tf.key}
                      label={tf.label}
                      value={activeMode.timeframeWeights[tf.key]}
                      min={0}
                      max={100}
                      suffix="%"
                      onValidChange={(val) =>
                        updateActiveMode((m) => ({
                          ...m,
                          timeframeWeights: {
                            ...m.timeframeWeights,
                            [tf.key]: val,
                          },
                        }))
                      }
                    />
                  ))}
                </div>
              </section>

              {/* Indicator Weights */}
              <section className="border border-[#D6D0C4] bg-[#F3EFE6] p-4">
                <div className="flex items-center justify-between border-b border-[#D6D0C4] pb-2">
                  <h3 className="font-serif-editorial text-sm font-bold uppercase tracking-wider text-[#1C1917]">
                    Trọng số 4 nhóm chỉ báo
                  </h3>
                  <span className="font-mono-tabular text-xs font-medium text-[#57534E]">
                    Tổng: {indicatorWeightSum}%
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {INDICATOR_WEIGHT_FIELDS.map((ind) => (
                    <NumericField
                      key={ind.key}
                      label={ind.label}
                      value={activeMode.indicatorWeights[ind.key]}
                      min={0}
                      max={100}
                      suffix="%"
                      onValidChange={(val) =>
                        updateActiveMode((m) => ({
                          ...m,
                          indicatorWeights: {
                            ...m.indicatorWeights,
                            [ind.key]: val,
                          },
                        }))
                      }
                    />
                  ))}
                </div>
              </section>

              {/* Indicator Parameters */}
              <section className="border border-[#D6D0C4] bg-[#F3EFE6] p-4">
                <div className="border-b border-[#D6D0C4] pb-2">
                  <h3 className="font-serif-editorial text-sm font-bold uppercase tracking-wider text-[#1C1917]">
                    Thông số chỉ báo kỹ thuật
                  </h3>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {PARAM_FIELDS.map((field) => (
                    <NumericField
                      key={field.key}
                      label={field.label}
                      value={activeMode.params[field.key]}
                      min={field.min}
                      max={field.max}
                      onValidChange={(val) =>
                        updateActiveMode((m) => ({
                          ...m,
                          params: {
                            ...m.params,
                            [field.key]: val,
                          },
                        }))
                      }
                    />
                  ))}
                </div>
              </section>

              {/* Decision Thresholds & Risk Guard */}
              <section className="border border-[#D6D0C4] bg-[#F3EFE6] p-4">
                <div className="border-b border-[#D6D0C4] pb-2">
                  <h3 className="font-serif-editorial text-sm font-bold uppercase tracking-wider text-[#1C1917]">
                    Ngưỡng tín hiệu &amp; Kỷ luật rủi ro
                  </h3>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <NumericField
                    label="Ngưỡng điểm MUA"
                    value={activeMode.buyThreshold}
                    min={1}
                    max={100}
                    onValidChange={(val) =>
                      updateActiveMode((m) => ({ ...m, buyThreshold: val }))
                    }
                  />
                  <NumericField
                    label="Ngưỡng điểm BÁN"
                    value={activeMode.sellThreshold}
                    min={0}
                    max={99}
                    onValidChange={(val) =>
                      updateActiveMode((m) => ({ ...m, sellThreshold: val }))
                    }
                  />
                  <NumericField
                    label="R:R tối thiểu"
                    value={activeMode.minRiskReward}
                    min={0.5}
                    max={10}
                    step={0.1}
                    integer={false}
                    onValidChange={(val) =>
                      updateActiveMode((m) => ({ ...m, minRiskReward: val }))
                    }
                  />
                </div>

                <label className="mt-4 flex items-start gap-3 border-t border-[#D6D0C4] pt-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={activeMode.requireHigherTfNotBearish}
                    onChange={(e) =>
                      updateActiveMode((m) => ({
                        ...m,
                        requireHigherTfNotBearish: e.target.checked,
                      }))
                    }
                    className="mt-0.5 h-4 w-4 accent-[#1C1917] cursor-pointer"
                  />
                  <div>
                    <span className="block text-sm font-semibold text-[#1C1917]">
                      Chặn MUA ngược khung lớn
                    </span>
                    <span className="block text-xs text-[#57534E]">
                      Tự động hạ tín hiệu về Đứng ngoài nếu xu hướng khung 1D hoặc 1W đang giảm mạnh.
                    </span>
                  </div>
                </label>
              </section>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Status banner */}
              {statusMessage && (
                <div
                  role={statusMessage.type === 'error' ? 'alert' : 'status'}
                  className={`flex items-start gap-2.5 border border-l-4 px-3.5 py-3 text-sm ${
                    statusMessage.type === 'error'
                      ? 'border-[#B91C1C] bg-[#F3EFE6] text-[#1C1917]'
                      : 'border-[#15803D] bg-[#F3EFE6] text-[#1C1917]'
                  }`}
                >
                  {statusMessage.type === 'error' ? (
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#B91C1C]" />
                  ) : (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#15803D]" />
                  )}
                  <span>{statusMessage.text}</span>
                </div>
              )}

              {/* Backup / Restore JSON */}
              <section className="border border-[#D6D0C4] bg-[#F3EFE6] p-4">
                <h3 className="font-serif-editorial border-b border-[#D6D0C4] pb-2 text-sm font-bold uppercase tracking-wider text-[#1C1917]">
                  Sao lưu &amp; Khôi phục cấu hình
                </h3>
                <p className="mt-2.5 text-xs leading-relaxed text-[#57534E]">
                  Xuất toàn bộ chế độ phân tích, danh sách theo dõi và không gian mở rộng ra tệp JSON để sao lưu hoặc chia sẻ giữa các thiết bị.
                </p>

                <div className="mt-4 flex flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={handleExportJson}
                    className="inline-flex items-center justify-center gap-2 border border-[#1C1917] bg-[#1C1917] px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[#FAF7F0] transition-opacity hover:opacity-90 cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Xuất cấu hình (JSON)</span>
                  </button>

                  <label className="inline-flex items-center justify-center gap-2 border border-[#1C1917] bg-[#FAF7F0] px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[#1C1917] transition-colors hover:bg-[#1C1917] hover:text-[#FAF7F0] cursor-pointer">
                    <Upload className="h-3.5 w-3.5" />
                    <span>Nhập cấu hình (JSON)</span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json,application/json"
                      aria-label="Nhập cấu hình (JSON)"
                      onChange={(e) => void handleImportFile(e)}
                      className="sr-only"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={handleResetDefaults}
                    className="mt-1 inline-flex items-center justify-center gap-2 border border-[#D6D0C4] bg-[#FAF7F0] px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[#57534E] transition-colors hover:border-[#B91C1C] hover:text-[#B91C1C] cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Khôi phục mặc định</span>
                  </button>
                </div>
              </section>

              {/* Reserved Extension Slot (v2) */}
              <section className="border border-dashed border-[#D6D0C4] bg-[#F3EFE6] p-4">
                <div className="flex items-center justify-between gap-2 border-b border-[#D6D0C4] pb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-[#B45309]" />
                    <h3 className="font-serif-editorial text-sm font-bold uppercase tracking-wider text-[#1C1917]">
                      Tính năng mở rộng (Sắp tới)
                    </h3>
                  </div>
                  <span className="border border-[#D6D0C4] bg-[#FAF7F0] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#57534E]">
                    Phiên bản v2
                  </span>
                </div>

                <div className="mt-3 space-y-2">
                  <p className="font-serif-editorial text-base font-semibold text-[#1C1917]">
                    Máy quét thị trường gợi ý coin nên mua
                  </p>
                  <p className="text-xs leading-relaxed text-[#57534E]">
                    Không gian cấu hình mở rộng (<span className="font-mono-tabular text-[#1C1917]">settings.extensions</span>) đã được thiết kế sẵn và bảo lưu tự động khi xuất/nhập JSON. Khi nâng cấp lên v2, bộ lọc quét toàn thị trường Binance Spot sẽ tự động gắn vào ngăn này mà không ảnh hưởng tới các chế độ bạn đang dùng.
                  </p>
                  <div className="font-mono-tabular border border-[#D6D0C4] bg-[#FAF7F0] px-3 py-2 text-[11px] text-[#57534E]">
                    Trạng thái không gian mở rộng: {extensionKeys.length} khóa đã lưu
                    {extensionKeys.length > 0 ? ` (${extensionKeys.join(', ')})` : ' (chưa kích hoạt mô-đun)'}
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

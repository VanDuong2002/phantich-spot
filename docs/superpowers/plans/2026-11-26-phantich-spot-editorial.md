# PhanTich — Bản tin Phân tích Kỹ thuật Crypto Spot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng ứng dụng web tĩnh (SPA) phân tích kỹ thuật Crypto Spot đa khung (1H/4H/1D/1W) kết nối trực tiếp Binance Public API, có kiểm chứng quá khứ (backtest nhanh), hệ thống Cài đặt chế độ mở rộng được, và giao diện phong cách tờ báo tài chính (Mẫu P) sẵn sàng deploy lên Vercel.

**Architecture:** Ứng dụng React + TypeScript (Vite) phân tách thành 4 lớp độc lập: `services/binance.ts` (lấy dữ liệu nến & ticker công khai kèm cache và fallback), `engine/` (thuần TypeScript, không phụ thuộc UI: chỉ báo, chấm điểm đa khung, kế hoạch lệnh, sinh văn bản tiếng Việt, backtest nhanh — tái sử dụng nguyên vẹn cho máy quét thị trường v2), `settings/` (lưu trữ cấu hình có đánh số phiên bản kèm ngăn `extensions` cho tính năng tương lai), và `ui/` (giao diện nhật báo tài chính dùng `lightweight-charts`).

**Tech Stack:** Vite, React 19, TypeScript, Tailwind CSS v4, `lightweight-charts` (TradingView), `lucide-react`, Vitest + `@testing-library/react` + `jsdom`.

**Spec:** `docs/superpowers/specs/2026-11-26-phantich-spot-editorial-design.md`

## Global Constraints

- Triển khai dạng static SPA trên Vercel miễn phí, không có backend hay Vercel Serverless Function.
- Gọi Binance Public API trực tiếp từ trình duyệt: nguồn chính `https://data-api.binance.vision`, dự phòng `https://api.binance.com`; không yêu cầu API key.
- Chỉ hỗ trợ Spot với đúng 4 trạng thái: `MUA`, `GIỮ`, `BÁN`, `ĐỨNG NGOÀI` (không Short, không đòn bẩy).
- Toàn bộ giao diện bằng tiếng Việt, dùng bộ font hỗ trợ đầy đủ dấu tiếng Việt (`Lora`, `Be Vietnam Pro`, `JetBrains Mono`).
- Bảng màu nhật báo tài chính cố định theo spec: nền giấy `#FAF7F0`, nền khối phụ `#F3EFE6`, mực chính `#1C1917`, mực phụ `#57534E`, viền `#D6D0C4`, xanh `#15803D`, đỏ `#B91C1C`, hổ phách `#B45309`, xám đá `#475569`.
- Bộ phân tích trong `src/engine/` phải thuần TypeScript (không import React/DOM/localStorage) để v2 Market Scanner dùng lại trực tiếp.
- Toàn bộ phân tích và lời giải thích sinh từ quy tắc định lượng (không gọi AI/LLM bên ngoài).

## Review Focus

1. **Coin mới niêm yết có ít hơn 200 nến tuần (1W):** `calcEMA(..., 200)` trả về `null` thay vì `NaN`; bộ chấm điểm rơi về EMA50 và ghi chú "chưa đủ dữ liệu EMA200" (pinned in Task 4 & Task 5).
2. **Coin giá siêu nhỏ (như `PEPEUSDT` ~ `0.00001234`):** `formatPrice` giữ đủ chữ số có nghĩa thay vì làm tròn thành `0.00` (pinned in Task 1).
3. **Nguồn Binance chính bị chặn hoặc lỗi mạng (451 / 5xx / fetch reject):** tự động chuyển sang `https://api.binance.com` và chỉ báo lỗi khi cả hai nguồn thất bại (pinned in Task 3).
4. **Dữ liệu `localStorage` hỏng hoặc file JSON nhập vào sai định dạng:** không làm trắng trang; `loadSettings()` phục hồi về mặc định và `importSettingsJson()` trả lỗi rõ ràng bằng tiếng Việt (pinned in Task 2).
5. **Thiên lệch nhìn trước (lookahead bias) trong Backtest nhanh:** tại mỗi nến 4H lịch sử, lọc xu hướng 1D chỉ được dùng các nến 1D đã đóng cửa (`closeTime <= candle4h.closeTime`) (pinned in Task 6).

---

## File Structure

- `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `vercel.json`, `.gitignore`: cấu hình dự án Vite + React + Tailwind v4 + Vitest + Vercel SPA.
- `src/types/market.ts`: toàn bộ kiểu dữ liệu dùng chung cho thị trường, chế độ phân tích, kết quả chấm điểm, kế hoạch lệnh và backtest.
- `src/utils/format.ts`: định dạng giá (cả coin lớn lẫn meme coin siêu nhỏ), phần trăm, ngày giờ tiếng Việt.
- `src/settings/presets.ts`: 3 chế độ mặc định (*An toàn*, *Cân bằng*, *Năng động*) và watchlist mặc định (`BTCUSDT`, `ETHUSDT`, `BNBUSDT`, `SOLUSDT`).
- `src/settings/storage.ts`: đọc/ghi `localStorage` theo schema version 1, xuất/nhập JSON, bảo toàn vùng `extensions`.
- `src/services/binance.ts`: gọi Binance Public API (danh sách cặp USDT, klines 4 khung, ticker 24h), cache TTL theo khung, fallback endpoint.
- `src/engine/indicators.ts`: tính EMA, RSI (Wilder), MACD, ATR, Volume Ratio, và Swing High/Low (hỗ trợ/kháng cự).
- `src/engine/scorer.ts`: chấm điểm từng khung (`-100..+100`), tổng hợp `0..100`, áp bộ lọc xu hướng khung lớn và ranh giới 4 trạng thái Spot.
- `src/engine/tradePlan.ts`: tính Vùng mua, SL, TP1, TP2, R:R (khi `MUA`) và các mốc Hỗ trợ/Kháng cự tham chiếu (mọi trạng thái).
- `src/engine/narrative.ts`: sinh tiêu đề báo chí, đoạn nhận định, danh sách lý do và cảnh báo rủi ro bằng tiếng Việt.
- `src/engine/analyze.ts`: hàm điều phối chính `analyzeCoin(data, mode)` kết hợp `indicators`, `scorer`, `tradePlan`, `narrative`.
- `src/engine/backtest.ts`: chạy kiểm chứng quá khứ trên ~400 nến 4H (lọc 1D không lookahead), chốt 50% TP1 (dời SL hòa vốn) + 50% TP2.
- `src/index.css`: biến màu tờ báo tài chính, font chữ (`Lora`, `Be Vietnam Pro`, `JetBrains Mono`) và style kẻ đôi.
- `src/ui/Masthead.tsx`: đầu trang báo, ngày giờ, chọn nhanh chế độ, làm mới, mở Cài đặt.
- `src/ui/CoinSelectorBar.tsx`: tìm kiếm mọi cặp `/USDT` và dải Watchlist ghim nhanh.
- `src/ui/EditorialLead.tsx`: trang nhất 2 cột — bài nhận định bên trái, hộp Kế hoạch lệnh / Mốc tham chiếu bên phải.
- `src/ui/PriceChart.tsx`: biểu đồ nến `lightweight-charts` phối màu giấy báo, bật/tắt EMA và vẽ đường giá Vùng mua/SL/TP hoặc Hỗ trợ/Kháng cự.
- `src/ui/IndicatorMatrix.tsx`: bảng đối chiếu chỉ báo 4 khung (`1H`, `4H`, `1D`, `1W`).
- `src/ui/BacktestCard.tsx`: hộp Kiểm chứng quá khứ kèm chú thích quy tắc.
- `src/ui/SettingsDrawer.tsx`: ngăn Cài đặt quản lý Chế độ, thông số chỉ báo, Xuất/Nhập JSON và khung sẵn cho tính năng mở rộng.
- `src/App.tsx`, `src/main.tsx`: ghép toàn bộ luồng dữ liệu, loading skeleton và xử lý lỗi.

---

### Task 1: Project Scaffold, Core Types & Price Formatting

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `vercel.json`, `.gitignore`
- Create: `src/types/market.ts`
- Create: `src/utils/format.ts`
- Test: `src/utils/format.test.ts`

**Interfaces:**
- Consumes: none
- Produces:
  - Types in `src/types/market.ts`: `Timeframe` (`'1h' | '4h' | '1d' | '1w'`), `Verdict` (`'MUA' | 'GIU' | 'BAN' | 'DUNG_NGOAI'`), `Candle`, `SymbolInfo`, `Ticker24h`, `MultiTimeframeData`, `IndicatorParams`, `AnalysisMode`, `SettingsSchema`, `IndicatorSnapshot`, `TimeframeAnalysis`, `TradePlan`, `ReferenceLevels`, `AnalysisReport`, `BacktestResult`
  - Functions in `src/utils/format.ts`: `formatPrice(value: number): string`, `formatPercent(value: number, signed?: boolean): string`, `formatDateTimeVi(timestampMs: number): string`

- [ ] **Step 1: Khởi tạo Git và scaffold dự án Vite + React + TypeScript + Tailwind v4 + Vitest**
  - Khởi tạo git (`git init`), tạo `.gitignore` (gồm `node_modules/`, `dist/`, `.superpowers/`, `.env*`).
  - Tạo `package.json` với React 19, TypeScript, Vite, `@tailwindcss/vite`, `tailwindcss`, `lightweight-charts`, `lucide-react`, `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`.
  - Tạo `vite.config.ts` (bật plugin React, Tailwind, cấu hình `test: { environment: 'jsdom', globals: true }`), `tsconfig.json`, `vercel.json` (rewrite `/(.*)` → `/index.html`), và `index.html` (nhúng Google Fonts `Lora`, `Be Vietnam Pro`, `JetBrains Mono`, `lang="vi"`).
  - Chạy `npm install` và xác nhận thoát mã `0`.

- [ ] **Step 2: Định nghĩa toàn bộ kiểu dữ liệu trong `src/types/market.ts`**
  - Định nghĩa đầy đủ các interface nêu ở mục Produces.
  - `AnalysisMode` gồm: `id`, `name`, `description`, `isBuiltIn`, `timeframeWeights: Record<Timeframe, number>`, `indicatorWeights: { ema: number; rsi: number; macd: number; volume: number }`, `params: IndicatorParams` (EMA 21/50/200, RSI 14 với quá bán 30 / quá mua 70, MACD 12/26/9, ATR 14, Volume SMA 20), `buyThreshold`, `sellThreshold`, `minRiskReward`, `requireHigherTfNotBearish: boolean`.
  - `SettingsSchema` gồm: `version: 1`, `activeModeId: string`, `modes: AnalysisMode[]`, `watchlist: string[]`, `extensions: Record<string, unknown>`.

- [ ] **Step 3: Viết failing test trong `src/utils/format.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { formatPrice, formatPercent } from './format';

describe('formatPrice', () => {
  it('formats large coins with 2 decimals and thousands separators', () => {
    expect(formatPrice(97250.5)).toBe('97,250.50');
  });
  it('formats mid-price coins with up to 4 decimals', () => {
    expect(formatPrice(1.23456)).toBe('1.2346');
  });
  it('preserves significant digits for micro-cap coins like PEPE', () => {
    expect(formatPrice(0.00001234)).toBe('0.00001234');
  });
  it('handles zero and non-finite inputs safely', () => {
    expect(formatPrice(0)).toBe('0');
    expect(formatPrice(Number.NaN)).toBe('—');
  });
});

describe('formatPercent', () => {
  it('formats signed and unsigned percentages', () => {
    expect(formatPercent(2.14, true)).toBe('+2.14%');
    expect(formatPercent(-3.4, true)).toBe('-3.40%');
    expect(formatPercent(64.5, false)).toBe('64.50%');
  });
});
```

- [ ] **Step 4: Chạy test xác nhận fail**
  - Run: `npx vitest run src/utils/format.test.ts`
  - Expected: FAIL vì chưa có `src/utils/format.ts`.

- [ ] **Step 5: Triển khai `src/utils/format.ts`**
  - `formatPrice`: nếu `!Number.isFinite(v)` trả `'—'`; nếu `v === 0` trả `'0'`; nếu `>= 1000` dùng 2 chữ số thập phân + dấu phẩy ngăn nghìn; `>= 1` dùng 2–4 chữ số; `>= 0.01` dùng 4 chữ số; `< 0.01` dùng đến 8 chữ số có nghĩa (không cắt thành `0.00`).
  - `formatPercent` và `formatDateTimeVi` (định dạng `HH:mm · dd/MM/yyyy` theo múi giờ máy người dùng).

- [ ] **Step 6: Chạy test xác nhận pass & Commit**
  - Run: `npx vitest run src/utils/format.test.ts` → Expected: PASS.
  - Commit: `git add -A && git commit -m "chore: scaffold project, core market types, and formatting utilities"`

---

### Task 2: Extensible Settings Store & Default Modes

**Files:**
- Create: `src/settings/presets.ts`
- Create: `src/settings/storage.ts`
- Test: `src/settings/storage.test.ts`

**Interfaces:**
- Consumes: `AnalysisMode`, `SettingsSchema` from `src/types/market.ts`
- Produces:
  - `DEFAULT_WATCHLIST: string[]` (`['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT']`)
  - `BUILT_IN_MODES: AnalysisMode[]` (`conservative`, `balanced`, `aggressive`)
  - `createDefaultSettings(): SettingsSchema`
  - `loadSettings(): SettingsSchema`
  - `saveSettings(settings: SettingsSchema): void`
  - `exportSettingsJson(settings: SettingsSchema): string`
  - `importSettingsJson(raw: string): { ok: true; settings: SettingsSchema } | { ok: false; error: string }`

- [ ] **Step 1: Tạo `src/settings/presets.ts` với đúng 3 chế độ trong spec**
  - **An toàn (`conservative`):** trọng số `1w: 25, 1d: 35, 4h: 30, 1h: 10`; `buyThreshold: 70`, `sellThreshold: 38`, `minRiskReward: 2.0`, `requireHigherTfNotBearish: true`.
  - **Cân bằng (`balanced` — mặc định):** trọng số `1w: 20, 1d: 30, 4h: 35, 1h: 15`; `buyThreshold: 65`, `sellThreshold: 35`, `minRiskReward: 1.5`, `requireHigherTfNotBearish: true`.
  - **Năng động (`aggressive`):** trọng số `1w: 10, 1d: 25, 4h: 40, 1h: 25`; `buyThreshold: 60`, `sellThreshold: 32`, `minRiskReward: 1.3`, `requireHigherTfNotBearish: false`.
  - Thông số chỉ báo mặc định chung: EMA `21/50/200`, RSI `14` (30/70), MACD `12/26/9`, ATR `14`, Volume SMA `20`; trọng số chỉ báo `ema: 35, rsi: 25, macd: 25, volume: 15`.

- [ ] **Step 2: Viết failing test trong `src/settings/storage.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadSettings,
  saveSettings,
  exportSettingsJson,
  importSettingsJson,
} from './storage';

describe('settings storage', () => {
  beforeEach(() => localStorage.clear());

  it('returns default balanced settings when storage is empty', () => {
    const s = loadSettings();
    expect(s.version).toBe(1);
    expect(s.activeModeId).toBe('balanced');
    expect(s.modes).toHaveLength(3);
    expect(s.watchlist).toEqual(['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT']);
  });

  it('recovers gracefully when localStorage contains corrupted JSON', () => {
    localStorage.setItem('phantich_settings_v1', '{broken json');
    const s = loadSettings();
    expect(s.activeModeId).toBe('balanced');
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

  it('rejects invalid JSON or wrong schema version with Vietnamese error', () => {
    const bad = importSettingsJson('{"version": 999}');
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.length).toBeGreaterThan(5);
  });
});
```

- [ ] **Step 3: Chạy test xác nhận fail**
  - Run: `npx vitest run src/settings/storage.test.ts` → Expected: FAIL.

- [ ] **Step 4: Triển khai `src/settings/storage.ts`**
  - Key `localStorage`: `'phantich_settings_v1'`.
  - Xác thực `version === 1`, `modes` là mảng không rỗng hợp lệ, `activeModeId` tồn tại trong `modes`, `watchlist` là mảng chuỗi, `extensions` là object (mặc định `{}`).

- [ ] **Step 5: Chạy test xác nhận pass & Commit**
  - Run: `npx vitest run src/settings/storage.test.ts` → Expected: PASS.
  - Commit: `git add src/settings && git commit -m "feat: add extensible settings store and built-in analysis modes"`

---

### Task 3: Binance Public Data Client

**Files:**
- Create: `src/services/binance.ts`
- Test: `src/services/binance.test.ts`

**Interfaces:**
- Consumes: `Timeframe`, `Candle`, `SymbolInfo`, `Ticker24h`, `MultiTimeframeData` from `src/types/market.ts`
- Produces:
  - `fetchUsdtSymbols(forceRefresh?: boolean): Promise<SymbolInfo[]>`
  - `fetchKlines(symbol: string, timeframe: Timeframe, limit?: number, forceRefresh?: boolean): Promise<Candle[]>`
  - `fetchTicker24h(symbol: string, forceRefresh?: boolean): Promise<Ticker24h>`
  - `fetchMultiTimeframeData(symbol: string, forceRefresh?: boolean): Promise<MultiTimeframeData>`
  - `clearBinanceCache(): void`

- [ ] **Step 1: Viết failing test trong `src/services/binance.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchKlines, clearBinanceCache } from './binance';

const sampleKline = [
  1700000000000, '95000', '96000', '94000', '95500', '123.4', 1700003599999,
];

describe('binance public client', () => {
  beforeEach(() => {
    clearBinanceCache();
    vi.restoreAllMocks();
  });

  it('fetches from data-api.binance.vision and caches subsequent calls', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [sampleKline],
    });
    vi.stubGlobal('fetch', fetchMock);

    const first = await fetchKlines('BTCUSDT', '4h', 250);
    const second = await fetchKlines('BTCUSDT', '4h', 250);
    expect(first).toHaveLength(1);
    expect(first[0].close).toBe(95500);
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('data-api.binance.vision');
  });

  it('falls back to api.binance.com when primary endpoint returns 451 or network error', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 451 })
      .mockResolvedValueOnce({ ok: true, json: async () => [sampleKline] });
    vi.stubGlobal('fetch', fetchMock);

    const candles = await fetchKlines('BTCUSDT', '1d', 250);
    expect(candles).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toContain('api.binance.com');
  });

  it('bypasses cache when forceRefresh is true', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [sampleKline],
    });
    vi.stubGlobal('fetch', fetchMock);

    await fetchKlines('BTCUSDT', '1h', 250);
    await fetchKlines('BTCUSDT', '1h', 250, true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Chạy test xác nhận fail**
  - Run: `npx vitest run src/services/binance.test.ts` → Expected: FAIL.

- [ ] **Step 3: Triển khai `src/services/binance.ts`**
  - Endpoints: `['https://data-api.binance.vision', 'https://api.binance.com']`.
  - TTL cache: `1h`/`4h` = 60s, `1d`/`1w` = 300s, `ticker24h` = 30s, `exchangeInfo` = 24h.
  - `fetchUsdtSymbols`: lọc `status === 'TRADING' && quoteAsset === 'USDT' && isSpotTradingAllowed !== false`.
  - `fetchMultiTimeframeData`: gọi song song `Promise.all` lấy ticker 24h + nến `1h` (250), `4h` (450 — đủ cho cả chỉ báo và backtest ~400 nến), `1d` (300), `1w` (250).

- [ ] **Step 4: Chạy test xác nhận pass & Commit**
  - Run: `npx vitest run src/services/binance.test.ts` → Expected: PASS.
  - Commit: `git add src/services && git commit -m "feat: add Binance public data client with caching and endpoint fallback"`

---

### Task 4: Technical Indicators Engine

**Files:**
- Create: `src/engine/indicators.ts`
- Test: `src/engine/indicators.test.ts`

**Interfaces:**
- Consumes: `Candle`, `IndicatorParams`, `IndicatorSnapshot` from `src/types/market.ts`
- Produces:
  - `calcEMASeries(values: number[], period: number): (number | null)[]`
  - `calcRSISeries(values: number[], period: number): (number | null)[]`
  - `calcMACDSeries(values: number[], fast: number, slow: number, signal: number): { macd: (number | null)[]; signal: (number | null)[]; histogram: (number | null)[] }`
  - `calcATRSeries(candles: Candle[], period: number): (number | null)[]`
  - `calcVolumeRatio(candles: Candle[], period: number): number | null`
  - `findSwingLevels(candles: Candle[], lookback?: number): { supports: number[]; resistances: number[] }`
  - `computeIndicatorSnapshot(candles: Candle[], params: IndicatorParams): IndicatorSnapshot`

- [ ] **Step 1: Viết failing test trong `src/engine/indicators.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import {
  calcEMASeries,
  calcRSISeries,
  calcMACDSeries,
  calcATRSeries,
  findSwingLevels,
} from './indicators';
import type { Candle } from '../types/market';

const makeCandles = (closes: number[]): Candle[] =>
  closes.map((c, i) => ({
    openTime: i * 3600_000,
    closeTime: (i + 1) * 3600_000 - 1,
    open: c - 1,
    high: c + 2,
    low: c - 2,
    close: c,
    volume: 100 + i,
  }));

describe('technical indicators', () => {
  it('returns null for EMA200 when candle history is shorter than 200 (newly listed coin)', () => {
    const closes = Array.from({ length: 60 }, (_, i) => 100 + i);
    const ema200 = calcEMASeries(closes, 200);
    expect(ema200.at(-1)).toBeNull();
    expect(calcEMASeries(closes, 50).at(-1)).toBeGreaterThan(100);
  });

  it('computes RSI close to 100 on monotonic uptrend and close to 0 on downtrend', () => {
    const up = Array.from({ length: 30 }, (_, i) => 100 + i * 2);
    const down = Array.from({ length: 30 }, (_, i) => 200 - i * 2);
    expect(calcRSISeries(up, 14).at(-1)!).toBeGreaterThan(95);
    expect(calcRSISeries(down, 14).at(-1)!).toBeLessThan(5);
  });

  it('computes positive MACD histogram in sustained uptrend', () => {
    const closes = Array.from({ length: 50 }, (_, i) => 100 + i * i * 0.1);
    const macd = calcMACDSeries(closes, 12, 26, 9);
    expect(macd.macd.at(-1)!).toBeGreaterThan(0);
    expect(macd.histogram.at(-1)!).toBeGreaterThan(0);
  });

  it('computes ATR and identifies swing support/resistance levels', () => {
    const wave = [100, 105, 110, 106, 102, 98, 103, 108, 115, 111, 107, 104, 109, 112, 110, 108, 105, 103, 106, 109];
    const candles = makeCandles(wave);
    expect(calcATRSeries(candles, 14).at(-1)!).toBeGreaterThan(0);
    const levels = findSwingLevels(candles, 2);
    expect(levels.supports.length).toBeGreaterThan(0);
    expect(levels.resistances.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Chạy test xác nhận fail**
  - Run: `npx vitest run src/engine/indicators.test.ts` → Expected: FAIL.

- [ ] **Step 3: Triển khai `src/engine/indicators.ts`**
  - EMA khởi tạo bằng SMA của `period` giá trị đầu tiên, hệ số `k = 2 / (period + 1)`.
  - RSI dùng Wilder's smoothing chuẩn; nếu `avgLoss === 0 && avgGain === 0` trả `50`; `avgLoss === 0` trả `100`.
  - MACD: `EMA(fast) - EMA(slow)`, `signal = EMA(macdValid, signalPeriod)`, `histogram = macd - signal`.
  - ATR: Wilder's smoothing của True Range.
  - `findSwingLevels`: tìm pivot high/low trong cửa sổ `lookback` (mặc định 3 nến trái/phải), lọc các mức gần giá hiện tại và sắp xếp tăng/giảm dần.

- [ ] **Step 4: Chạy test xác nhận pass & Commit**
  - Run: `npx vitest run src/engine/indicators.test.ts` → Expected: PASS.
  - Commit: `git add src/engine/indicators.ts src/engine/indicators.test.ts && git commit -m "feat: add pure technical indicators engine"`

---

### Task 5: Multi-Timeframe Scorer, Trade Plan & Vietnamese Narrative

**Files:**
- Create: `src/engine/scorer.ts`
- Create: `src/engine/tradePlan.ts`
- Create: `src/engine/narrative.ts`
- Create: `src/engine/analyze.ts`
- Test: `src/engine/analyze.test.ts`

**Interfaces:**
- Consumes: `computeIndicatorSnapshot`, `findSwingLevels` from `src/engine/indicators.ts`; types from `src/types/market.ts`; `formatPrice` from `src/utils/format.ts`
- Produces:
  - `scoreTimeframe(candles: Candle[], timeframe: Timeframe, mode: AnalysisMode): TimeframeAnalysis`
  - `buildTradePlanAndLevels(candles4h: Candle[], candles1d: Candle[], currentPrice: number, mode: AnalysisMode): { tradePlan: TradePlan; referenceLevels: ReferenceLevels }`
  - `generateNarrative(report: Omit<AnalysisReport, 'headline' | 'summary' | 'reasons' | 'warnings'>): { headline: string; summary: string; reasons: string[]; warnings: string[] }`
  - `analyzeCoin(data: MultiTimeframeData, mode: AnalysisMode): AnalysisReport`

- [ ] **Step 1: Viết failing test trong `src/engine/analyze.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { analyzeCoin } from './analyze';
import { BUILT_IN_MODES } from '../settings/presets';
import type { Candle, MultiTimeframeData } from '../types/market';

const balanced = BUILT_IN_MODES.find((m) => m.id === 'balanced')!;

const trendCandles = (start: number, step: number, count: number): Candle[] =>
  Array.from({ length: count }, (_, i) => {
    const close = Math.max(1, start + i * step);
    return {
      openTime: i * 3600_000,
      closeTime: (i + 1) * 3600_000 - 1,
      open: close - step * 0.5,
      high: close * 1.015,
      low: close * 0.985,
      close,
      volume: i === count - 1 ? 300 : 120,
    };
  });

const makeData = (
  c1w: Candle[],
  c1d: Candle[],
  c4h: Candle[],
  c1h: Candle[]
): MultiTimeframeData => ({
  symbol: 'BTCUSDT',
  ticker: {
    symbol: 'BTCUSDT',
    lastPrice: c1h.at(-1)!.close,
    priceChangePercent: 2.1,
    highPrice: c1h.at(-1)!.high,
    lowPrice: c1h.at(-1)!.low,
    quoteVolume: 1_000_000_000,
  },
  candles: { '1w': c1w, '1d': c1d, '4h': c4h, '1h': c1h },
  fetchedAt: Date.now(),
});

describe('analyzeCoin', () => {
  it('returns MUA with valid tradePlan when all 4 timeframes align bullish', () => {
    const data = makeData(
      trendCandles(20000, 300, 220),
      trendCandles(50000, 200, 240),
      trendCandles(80000, 80, 240),
      trendCandles(94000, 25, 240)
    );
    const report = analyzeCoin(data, balanced);
    expect(report.verdict).toBe('MUA');
    expect(report.score).toBeGreaterThanOrEqual(balanced.buyThreshold);
    expect(report.tradePlan).not.toBeNull();
    expect(report.tradePlan!.stopLoss).toBeLessThan(report.tradePlan!.entryLow);
    expect(report.tradePlan!.tp1).toBeGreaterThan(report.tradePlan!.entryHigh);
    expect(report.tradePlan!.tp2).toBeGreaterThan(report.tradePlan!.tp1);
    expect(report.headline.length).toBeGreaterThan(10);
  });

  it('downgrades MUA to DUNG_NGOAI with warning when 1D is bearish (anti-false-signal)', () => {
    const data = makeData(
      trendCandles(120000, -250, 220),
      trendCandles(120000, -250, 240),
      trendCandles(50000, 100, 240),
      trendCandles(65000, 40, 240)
    );
    const report = analyzeCoin(data, balanced);
    expect(report.verdict).not.toBe('MUA');
    expect(report.tradePlan).toBeNull();
    expect(report.referenceLevels.nearestSupport).toBeGreaterThan(0);
  });

  it('returns BAN with null tradePlan when all timeframes are strongly bearish', () => {
    const data = makeData(
      trendCandles(120000, -300, 220),
      trendCandles(110000, -250, 240),
      trendCandles(90000, -150, 240),
      trendCandles(60000, -50, 240)
    );
    const report = analyzeCoin(data, balanced);
    expect(report.verdict).toBe('BAN');
    expect(report.tradePlan).toBeNull();
  });

  it('handles newly listed coin with short 1W history without NaN and adds note', () => {
    const data = makeData(
      trendCandles(1, 0.05, 40),
      trendCandles(1, 0.01, 220),
      trendCandles(2, 0.005, 220),
      trendCandles(3, 0.002, 220)
    );
    const report = analyzeCoin(data, balanced);
    expect(Number.isFinite(report.score)).toBe(true);
    expect(report.timeframes['1w'].snapshot.ema200).toBeNull();
    expect(report.warnings.some((w) => w.includes('EMA200'))).toBe(true);
  });
});
```

- [ ] **Step 2: Chạy test xác nhận fail**
  - Run: `npx vitest run src/engine/analyze.test.ts` → Expected: FAIL.

- [ ] **Step 3: Triển khai `scorer.ts`, `tradePlan.ts`, `narrative.ts`, và `analyze.ts`**
  - `scorer.ts`: mỗi chỉ báo chấm điểm trong `[-100, +100]` (EMA dùng cấu trúc giá so với EMA21/50/200, nếu `ema200 === null` rơi về EMA21/50; RSI chấm cao ở vùng hồi phục 35–60 và trừ điểm khi quá mua >75; MACD chấm theo vị trí so với đường signal & histogram tăng/giảm; Volume xác nhận hướng nến gần nhất). Điểm tổng hợp quy về `[0, 100]`.
  - Áp dụng đúng ranh giới trong spec:
    - `MUA`: `score >= mode.buyThreshold` AND (nếu `requireHigherTfNotBearish` thì điểm 1D không âm mạnh `>= -15`) AND `rr >= mode.minRiskReward`.
    - `BÁN`: `score <= mode.sellThreshold`.
    - `GIỮ`: `score >= 50` và `score1D >= -15`.
    - `ĐỨNG NGOÀI`: các trường hợp còn lại (kèm lý do hạ cấp nếu vốn đủ điểm MUA).
  - `tradePlan.ts`: Vùng mua quanh `[min(price, ema21), price]` có giới hạn theo ATR; SL dưới swing low gần nhất trừ `0.5 * ATR` (tối thiểu `1.5 * ATR` dưới điểm vào); TP1 = max(kháng cự gần nhất, entry + 1.5 * risk); TP2 = max(kháng cự kế tiếp, entry + 2.5 * risk). Trên trạng thái không phải `MUA`, `analyzeCoin` gán `tradePlan: null` và luôn giữ `referenceLevels`.
  - `narrative.ts`: sinh tiêu đề phong cách báo tài chính tiếng Việt, tóm tắt 3–4 câu, danh sách lý do và cảnh báo rủi ro (ngược khung, R:R thấp, thiếu EMA200 1W).

- [ ] **Step 4: Chạy test xác nhận pass & Commit**
  - Run: `npx vitest run src/engine/analyze.test.ts` → Expected: PASS.
  - Commit: `git add src/engine && git commit -m "feat: add multi-timeframe scorer, trade plan calculator, and Vietnamese narrative engine"`

---

### Task 6: Quick Historical Backtest Engine

**Files:**
- Create: `src/engine/backtest.ts`
- Test: `src/engine/backtest.test.ts`

**Interfaces:**
- Consumes: `scoreTimeframe`, `buildTradePlanAndLevels` from Task 5; `Candle`, `AnalysisMode`, `BacktestResult` from `src/types/market.ts`
- Produces:
  - `runQuickBacktest(candles4h: Candle[], candles1d: Candle[], mode: AnalysisMode): BacktestResult`

- [ ] **Step 1: Viết failing test trong `src/engine/backtest.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { runQuickBacktest } from './backtest';
import { BUILT_IN_MODES } from '../settings/presets';
import type { Candle } from '../types/market';

const balanced = BUILT_IN_MODES.find((m) => m.id === 'balanced')!;

const makeSeries = (closes: number[], intervalMs: number): Candle[] =>
  closes.map((c, i) => ({
    openTime: i * intervalMs,
    closeTime: (i + 1) * intervalMs - 1,
    open: c * 0.995,
    high: c * 1.02,
    low: c * 0.98,
    close: c,
    volume: 150,
  }));

describe('runQuickBacktest', () => {
  it('returns valid zero-trade summary when history is too short', () => {
    const res = runQuickBacktest(makeSeries([100, 101, 102], 4 * 3600_000), makeSeries([100], 86400_000), balanced);
    expect(res.totalTrades).toBe(0);
    expect(res.winRate).toBe(0);
    expect(res.ruleSummaryVi).toContain('50%');
  });

  it('produces finite metrics without lookahead bias on 350 4H candles', () => {
    // Oscillating upward trend so signals trigger and hit TP/SL
    const closes4h = Array.from({ length: 360 }, (_, i) => 100 + i * 0.3 + Math.sin(i / 8) * 6);
    const closes1d = Array.from({ length: 120 }, (_, i) => 100 + i * 1.0 + Math.sin(i / 4) * 4);
    const res = runQuickBacktest(
      makeSeries(closes4h, 4 * 3600_000),
      makeSeries(closes1d, 86400_000),
      balanced
    );
    expect(Number.isFinite(res.winRate)).toBe(true);
    expect(Number.isFinite(res.netReturnPct)).toBe(true);
    expect(res.candlesTested).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Chạy test xác nhận fail**
  - Run: `npx vitest run src/engine/backtest.test.ts` → Expected: FAIL.

- [ ] **Step 3: Triển khai `src/engine/backtest.ts`**
  - Bắt đầu vòng lặp từ nến 4H thứ `210` (đủ lịch sử tính EMA200 4H) đến nến kế cuối.
  - **Chống lookahead:** tại mỗi nến `i`, lọc mảng `candles1d` chỉ lấy các nến có `closeTime <= candles4h[i].closeTime`.
  - Khi chưa có vị thế và tín hiệu 4H+1D thỏa điều kiện `MUA` của `mode`: mở vị thế tại `entry = candles4h[i].close`, lưu `sl`, `tp1`, `tp2`, `remaining = 1.0`, `tp1Hit = false`.
  - Ở các nến kế tiếp:
    - Nếu `!tp1Hit` và `low <= sl`: thoát 100% tại `sl` (lệnh thua).
    - Nếu `!tp1Hit` và `high >= tp1`: chốt 50% tại `tp1`, đặt `tp1Hit = true`, dời `sl = entry` (hòa vốn).
    - Nếu `tp1Hit` và `high >= tp2`: chốt 50% còn lại tại `tp2`.
    - Nếu `tp1Hit` và `low <= sl`: thoát 50% còn lại tại `entry`.
    - Nếu xuất hiện tín hiệu `BÁN`: đóng phần còn lại ở giá `close`.
  - Tính `totalTrades`, `winRate`, `avgRiskReward`, `netReturnPct`, `candlesTested`, và `ruleSummaryVi` (`"Vào ở giá đóng cửa nến 4H báo MUA · Chốt 50% tại TP1 (dời SL về hòa vốn), 50% tại TP2"`).

- [ ] **Step 4: Chạy test xác nhận pass & Commit**
  - Run: `npx vitest run src/engine/backtest.test.ts` → Expected: PASS.
  - Commit: `git add src/engine/backtest.ts src/engine/backtest.test.ts && git commit -m "feat: add no-lookahead quick historical backtest engine"`

---

### Task 7: Editorial Financial Newspaper UI — Core Page, Watchlist, Chart & Matrix

**Files:**
- Create: `src/index.css`
- Create: `src/ui/Masthead.tsx`
- Create: `src/ui/CoinSelectorBar.tsx`
- Create: `src/ui/EditorialLead.tsx`
- Create: `src/ui/PriceChart.tsx`
- Create: `src/ui/IndicatorMatrix.tsx`
- Create: `src/ui/BacktestCard.tsx`
- Create: `src/App.tsx`, `src/main.tsx`
- Test: `src/ui/EditorialLead.test.tsx`

**Interfaces:**
- Consumes: `fetchUsdtSymbols`, `fetchMultiTimeframeData` from `src/services/binance.ts`; `analyzeCoin` from `src/engine/analyze.ts`; `runQuickBacktest` from `src/engine/backtest.ts`; `loadSettings`, `saveSettings` from `src/settings/storage.ts`; `formatPrice`, `formatPercent`, `formatDateTimeVi` from `src/utils/format.ts`
- Produces: Màn hình chính hoàn chỉnh phong cách nhật báo tài chính (Mẫu P), responsive cho cả desktop và mobile.

- [ ] **Step 1: Tạo `src/index.css` với bảng màu và font tờ báo tài chính**
  - Nền `#FAF7F0`, khối phụ `#F3EFE6`, mực `#1C1917`, mực phụ `#57534E`, viền `#D6D0C4`.
  - Class tiện ích cho font serif (`Lora`), sans (`Be Vietnam Pro`), mono (`JetBrains Mono` với `font-variant-numeric: tabular-nums`), và đường kẻ đôi `border-double` đặc trưng của nhật báo.

- [ ] **Step 2: Triển khai các thành phần UI cốt lõi**
  - `Masthead.tsx`: đường kẻ đôi đầu trang, tiêu đề **BẢN TIN NHẬN ĐỊNH**, ngày giờ tiếng Việt, dropdown chọn nhanh Chế độ, nút Làm mới (forceRefresh), nút mở Cài đặt.
  - `CoinSelectorBar.tsx`: ô tìm kiếm cặp `/USDT` trên Binance có dropdown gợi ý nhanh + nút ghim/bỏ ghim Watchlist + dải thẻ Watchlist hiện giá & % 24h.
  - `EditorialLead.tsx`: bố cục 2 cột trên desktop (`lg:grid-cols-12`, 7/5 phân tách bằng đường kẻ dọc mảnh):
    - Trái: nhãn khuyến nghị màu chuẩn (`MUA` xanh rừng, `GIỮ` hổ phách, `BÁN` đỏ thẫm, `ĐỨNG NGOÀI` xám đá), tiêu đề lớn serif, đoạn nhận định, danh sách lý do và hộp cảnh báo rủi ro (nếu có).
    - Phải: nếu `report.tradePlan !== null` → hiển thị **Kế hoạch lệnh Spot** (Điểm `/100`, Vùng mua, Cắt lỗ + %, TP1 + %, TP2 + %, R:R); nếu `null` → hiển thị **Các mốc kỹ thuật tham chiếu** (Hỗ trợ gần nhất, Kháng cự gần nhất, Mốc cảnh báo thủng hỗ trợ) và lưới tóm tắt 4 khung `1W · 1D · 4H · 1H`.
  - `PriceChart.tsx`: tích hợp `lightweight-charts` nền `#FAF7F0`, nến xanh `#15803D` / đỏ `#B91C1C`, tab chuyển `1H / 4H / 1D / 1W`, checkbox bật/tắt EMA 21/50/200, và `createPriceLine` vẽ Vùng mua / SL / TP1 / TP2 (khi `MUA`) hoặc Hỗ trợ / Kháng cự (khi không `MUA`). Tự điều chỉnh kích thước bằng `ResizeObserver` và dọn dẹp (`chart.remove()`) khi unmount.
  - `IndicatorMatrix.tsx`: bảng 4 khung × EMA / RSI / MACD / Volume / Điểm khung, màu chữ/nền nhã nhặn đúng tông báo chí.
  - `BacktestCard.tsx`: hiển thị số lệnh mẫu, Tỷ lệ thắng, R:R trung bình, Hiệu suất ước tính %, chú thích 1 dòng quy tắc mô phỏng và dòng miễn trừ trách nhiệm.

- [ ] **Step 3: Viết test cho `EditorialLead.tsx` trong `src/ui/EditorialLead.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EditorialLead } from './EditorialLead';
import type { AnalysisReport } from '../types/market';

const baseReport: AnalysisReport = {
  symbol: 'BTCUSDT',
  currentPrice: 97250,
  priceChangePercent24h: 2.1,
  fetchedAt: Date.now(),
  modeName: 'Cân bằng',
  score: 72,
  verdict: 'MUA',
  headline: 'Bitcoin: Xu hướng tăng đa khung được xác nhận',
  summary: 'Ba trên bốn khung đồng thuận tăng.',
  reasons: ['Giá nằm trên EMA200 1D'],
  warnings: [],
  timeframes: {
    '1w': { timeframe: '1w', score: 60, trend: 'UP', snapshot: { price: 97250, ema21: 90000, ema50: 85000, ema200: 70000, rsi: 61, macd: 10, macdSignal: 8, macdHistogram: 2, atr: 3000, volumeRatio: 1.2 } },
    '1d': { timeframe: '1d', score: 55, trend: 'UP', snapshot: { price: 97250, ema21: 94000, ema50: 91000, ema200: 82000, rsi: 58, macd: 5, macdSignal: 3, macdHistogram: 2, atr: 1800, volumeRatio: 1.1 } },
    '4h': { timeframe: '4h', score: 50, trend: 'UP', snapshot: { price: 97250, ema21: 96000, ema50: 95000, ema200: 92000, rsi: 48, macd: 2, macdSignal: 1, macdHistogram: 1, atr: 900, volumeRatio: 1.3 } },
    '1h': { timeframe: '1h', score: 10, trend: 'NEUTRAL', snapshot: { price: 97250, ema21: 97000, ema50: 96800, ema200: 95500, rsi: 52, macd: 0, macdSignal: 0, macdHistogram: 0, atr: 400, volumeRatio: 0.9 } },
  },
  tradePlan: { entryLow: 95800, entryHigh: 96500, stopLoss: 93900, stopLossPct: -3.4, tp1: 100200, tp1Pct: 4.1, tp2: 104000, tp2Pct: 8.1, riskReward: 2.3 },
  referenceLevels: { nearestSupport: 95000, nearestResistance: 100200, invalidationLevel: 93900 },
};

describe('EditorialLead', () => {
  it('renders Spot Trade Plan on MUA verdict', () => {
    render(<EditorialLead report={baseReport} />);
    expect(screen.getByText('Kế hoạch lệnh Spot')).toBeTruthy();
    expect(screen.getByText(/93,900/)).toBeTruthy();
  });

  it('renders Reference Levels instead of Trade Plan on DUNG_NGOAI verdict', () => {
    render(<EditorialLead report={{ ...baseReport, verdict: 'DUNG_NGOAI', tradePlan: null }} />);
    expect(screen.getByText('Mốc kỹ thuật tham chiếu')).toBeTruthy();
    expect(screen.queryByText('Kế hoạch lệnh Spot')).toBeNull();
  });
});
```

- [ ] **Step 4: Ghép `src/App.tsx` và `src/main.tsx`, chạy test & xác nhận pass**
  - Run: `npx vitest run src/ui/EditorialLead.test.tsx` → Expected: PASS.
  - Commit: `git add src/index.css src/ui src/App.tsx src/main.tsx && git commit -m "feat: build editorial financial newspaper UI, chart, matrix, and backtest card"`

---

### Task 8: Extensible Settings Drawer & Final Verification

**Files:**
- Create: `src/ui/SettingsDrawer.tsx`
- Modify: `src/App.tsx` (gắn `SettingsDrawer` vào nút Cài đặt)
- Test: `src/ui/SettingsDrawer.test.tsx`

**Interfaces:**
- Consumes: `SettingsSchema`, `AnalysisMode` from `src/types/market.ts`; `createDefaultSettings` from `src/settings/presets.ts`; `exportSettingsJson`, `importSettingsJson` from `src/settings/storage.ts`
- Produces: Ngăn Cài đặt hoàn chỉnh (quản lý Chế độ, tùy chỉnh thông số/trọng số, Xuất/Nhập JSON, khung sẵn cho tính năng mở rộng).

- [ ] **Step 1: Triển khai `src/ui/SettingsDrawer.tsx`**
  - Drawer trượt từ phải, giữ đúng phong cách nhật báo (`#FAF7F0`, viền `#D6D0C4`).
  - **Tab 1 — Chế độ phân tích:** chọn chế độ đang dùng, nút "Nhân bản thành chế độ mới", đổi tên, chỉnh trọng số 4 khung, trọng số 4 chỉ báo, chu kỳ EMA/RSI/MACD, ngưỡng điểm MUA/BÁN, R:R tối thiểu, công tắc "Chặn MUA ngược khung lớn", xóa chế độ tự tạo.
  - **Tab 2 — Dữ liệu & Mở rộng:** nút "Xuất cấu hình (JSON)" tải file `.json`, nút "Nhập cấu hình (JSON)" đọc file và báo lỗi tiếng Việt nếu sai, nút "Khôi phục mặc định", và mục **Tính năng mở rộng (Sắp tới)** mô tả sẵn chỗ gắn *Máy quét thị trường gợi ý coin nên mua (v2)*.

- [ ] **Step 2: Viết test trong `src/ui/SettingsDrawer.test.tsx`**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsDrawer } from './SettingsDrawer';
import { createDefaultSettings } from '../settings/presets';

describe('SettingsDrawer', () => {
  it('switches active mode when user selects another preset', () => {
    const onChange = vi.fn();
    render(
      <SettingsDrawer
        open={true}
        settings={createDefaultSettings()}
        onChange={onChange}
        onClose={() => {}}
      />
    );
    fireEvent.click(screen.getByText('An toàn'));
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls[0][0].activeModeId).toBe('conservative');
  });
});
```

- [ ] **Step 3: Kết nối `SettingsDrawer` trong `src/App.tsx`, chạy toàn bộ test & build**
  - Run: `npx vitest run && npm run build`
  - Expected: toàn bộ test PASS và Vite build ra `dist/` không có lỗi TypeScript hay bundle.

- [ ] **Step 4: Commit cuối**
  - Commit: `git add src/ui/SettingsDrawer.tsx src/ui/SettingsDrawer.test.tsx src/App.tsx && git commit -m "feat: add extensible settings drawer with mode editor and JSON import/export"`

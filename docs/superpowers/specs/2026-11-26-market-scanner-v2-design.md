# Thiết kế ngắn: Máy quét thị trường — Quét coin nên mua (v2)

**Ngày:** 2026-11-26  
**Trạng thái:** Đã duyệt  

## Hướng tiếp cận
Chạy máy quét trực tiếp từ trình duyệt bằng Binance Public API (`data-api.binance.vision`, dự phòng `api.binance.com`), tái sử dụng nguyên vẹn bộ phân tích đa khung `analyzeCoin` trong `src/engine/` và lưu tùy chọn vào `settings.extensions.scanner`. Không dùng server trung gian để giữ static SPA miễn phí trên Vercel và tránh lỗi 451 IP Mỹ.

## Thiết kế chi tiết
1. **Thanh chuyển tab trong `Masthead`:** `Phân tích chi tiết` | `Quét coin nên mua` theo phong cách tờ báo tài chính (Mẫu P).
2. **Dữ liệu & Lọc coin (`src/services/binance.ts`, `src/engine/scanner.ts`):**
   - Lấy danh sách các cặp `/USDT` Spot đang `TRADING`, ghép với `/api/v3/ticker/24hr`, tự loại các cặp stablecoin (`USDC`, `FDUSD`, `TUSD`, `USDE`, `DAI`, `BUSD`, `EUR`, `EURI`, `USDP`, `USD1`, `RLUSD`, `BFUSD`, `AEUR`), sắp giảm dần theo `quoteVolume` (khối lượng USDT 24h).
   - Phạm vi quét: Top `20` / `30` (mặc định) / `50`, lưu vào `settings.extensions.scanner`.
   - Quét song song theo lô 5 coin/lượt bằng `fetchMultiTimeframeData` + `analyzeCoin(data, activeMode)` (tận dụng cache TTL sẵn có), hỗ trợ dừng giữa chừng (`AbortController`) và bỏ qua lỗi cục bộ từng coin.
3. **Giao diện `MarketScanner` (`src/ui/MarketScanner.tsx`):**
   - Bộ lọc nhanh: `Tất cả` | `Chỉ MUA` | `MUA & GIỮ`.
   - Thanh tiến độ realtime (`Đang quét X/N coin...`) + nút **Quét ngay / Dừng**.
   - Bảng xếp hạng (ưu tiên `MUA` lên đầu, sau đó theo điểm giảm dần): Coin, Giá & % 24h, Khuyến nghị, Điểm `/100`, Đồng thuận 4 khung (`1W · 1D · 4H · 1H`), Vùng mua & R:R (khi `MUA`), nút **Xem chi tiết** (chuyển sang tab `Phân tích chi tiết` của coin đó).
4. **3 tinh chỉnh hiển thị nhỏ đi kèm:**
   - `formatPrice`: giữ tối đa 4 chữ số có nghĩa cho coin `< 0.01` (vẫn giữ nguyên `0.00001234`, làm gọn `0.0000032712394` thành `0.000003271`).
   - `CoinSelectorBar`: tránh cắt mép trái thẻ đầu tiên trong Watchlist ở `1280px`.
   - `EditorialLead`: không kéo giãn tạo khoảng trắng lớn giữa các mốc và đồng thuận 4 khung ở cột phải.

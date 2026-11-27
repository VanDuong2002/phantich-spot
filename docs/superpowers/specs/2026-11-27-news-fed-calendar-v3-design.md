# Thiết kế ngắn: Tin tức tác động thị trường & Lịch tin đỏ FED (v3)

**Ngày:** 2026-11-27  
**Trạng thái:** Đã duyệt (Hướng A)  

## Hướng tiếp cận
- Giữ nguyên Binance Public API gọi trực tiếp từ trình duyệt (tránh lỗi 451 IP Mỹ).
- Thêm 2 Vercel Serverless Functions siêu gọn (`api/news.ts` và `api/calendar.ts`, kèm middleware tương ứng trong `vite.config.ts` để chạy local `npm run dev` đồng nhất 100% với Vercel):
  - `/api/news`: gộp tin trực tiếp từ `cryptocurrency.cv/api/news`, RSS CoinTelegraph (`cointelegraph.com/rss`), và RSS Decrypt (`decrypt.co/feed`), cache `s-maxage=180` (3 phút), khử trùng lặp tiêu đề.
  - `/api/calendar`: lấy lịch kinh tế tuần từ `nfs.faireconomy.media/ff_calendar_thisweek.json` (lọc sự kiện `USD`, ưu tiên tin đỏ `High` và cam `Medium`), ghép thêm lịch họp FOMC của FED sắp tới (nếu tuần hiện tại không có họp FOMC để người dùng luôn thấy mốc FOMC kế tiếp).
- Chỉ số **Fear & Greed** lấy từ `api.alternative.me/fng/?limit=2` (CORS mở).

## Bộ lọc & Phân tích tăng/giảm (`src/engine/newsAnalyzer.ts` — thuần TypeScript)
- **Lọc tin có tác động thị trường:** chỉ giữ tin khớp các nhóm tác động lớn (`FED / Vĩ mô`, `ETF / Tổ chức`, `Pháp lý / SEC`, `Bảo mật / Hack`, `Niêm yết / Sàn lớn`, `Nâng cấp / Hệ sinh thái`, `Biến động giá / Cá voi`); loại bỏ tin rác/quảng cáo/hướng dẫn cơ bản.
- **Nhận diện coin liên quan:** gắn thẻ tự động các đồng coin được nhắc đến (BTC, ETH, SOL, BNB, XRP, ADA, DOGE, LINK, AVAX, SUI, PEPE, TON, TRX, DOT, NEAR, UNI, ARB, OP, HYPE, v.v.) theo cả mã lẫn tên đầy đủ (`Bitcoin` → `BTC`, `Ethereum` → `ETH`...) để lọc chuẩn theo coin đang chọn.
- **Chấm điểm tác động (`BULLISH` / `BEARISH` / `NEUTRAL`):** chấm theo từ khóa tích cực (cắt giảm lãi suất, dòng tiền ETF vào ròng, phê duyệt, nâng cấp, tổ chức gom mua, niêm yết...) vs tiêu cực (tăng lãi suất, diều hâu, kiện tụng SEC, hack/rút trộm, phá sản, dòng tiền ETF rút ròng, lạm phát nóng...), quy ra điểm `-100..+100` và tổng hợp thành **Kết luận xu hướng tin tức chung** (`Nghiêng TĂNG` / `Nghiêng GIẢM` / `Trung tính`) bằng tiếng Việt.

## Giao diện (Phong cách Tờ báo tài chính — Mẫu P)
1. **Tab thứ 3 trên `Masthead`:** `Phân tích chi tiết` | `Quét coin nên mua` | `Tin tức & Lịch FED` (có chấm xanh/đỏ nhỏ nếu có tin đỏ USD sắp ra trong 24h tới).
2. **Trong tab `Tin tức & Lịch FED` (`src/ui/NewsFeed.tsx`):**
   - Tự động cập nhật mỗi 3 phút (có đồng hồ đếm / thời gian cập nhật gần nhất + nút Làm mới ngay).
   - **Khối Tổng hợp nhận định tin tức:** kết luận chung `Có khả năng TĂNG / GIẢM / TRUNG TÍNH`, tỷ lệ tin Tích cực vs Tiêu cực, điểm Fear & Greed, và đoạn tóm tắt tiếng Việt các chủ đề nóng nhất đang chi phối thị trường.
   - **Bộ lọc tin:** `Tất cả thị trường` | `Liên quan <Coin đang chọn>` | `Tin FED & Vĩ mô` | `Tác động Tăng` | `Tác động Giảm` + ô tìm kiếm nhanh theo coin/từ khóa.
   - **Cột phải — Lịch tin đỏ FED & Vĩ mô sắp tới:** nổi bật các sự kiện đỏ (`High` — FOMC, CPI, PPI, Non-Farm, GDP, PCE, Thất nghiệp) kèm giờ địa phương VN, Dự báo (Forecast) vs Kỳ trước (Previous), và giải thích ngắn tác động tới Crypto.
3. **Khung nhỏ trong tab `Phân tích chi tiết` (`src/ui/CoinNewsStrip.tsx`):** hiển thị nhanh tối đa 4 tin tác động gần nhất liên quan tới coin đang xem kèm nhận định tăng/giảm và nút mở toàn bộ tab `Tin tức & Lịch FED`.

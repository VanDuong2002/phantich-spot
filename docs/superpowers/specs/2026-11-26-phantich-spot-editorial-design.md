# Thiết kế hệ thống: PhanTich — Bản tin Phân tích Kỹ thuật Crypto Spot

**Ngày:** 2026-11-26  
**Trạng thái:** Bản nháp chờ kiểm tra & phê duyệt  
**Phạm vi:** Phiên bản 1 (v1)

---

## 1. Mục đích & Lý do (Intent & Why)

Xây dựng một công cụ web cá nhân giúp người dùng phân tích kỹ thuật các đồng coin trên sàn Binance (chỉ giao dịch **Spot**, khung **1H / 4H / 1D / 1W**) dựa trên các chỉ báo phổ biến (EMA, RSI, MACD, Volume, ATR, hỗ trợ/kháng cự).

Thay vì phải tự mở nhiều biểu đồ, đọc rời rạc từng chỉ báo rồi tự đoán, công cụ sẽ:
1. Tổng hợp đa khung thời gian thành một **khuyến nghị rõ ràng** (`MUA`, `GIỮ`, `BÁN`, `ĐỨNG NGOÀI`) kèm **điểm số 0–100**.
2. Đưa ra **kế hoạch lệnh cụ thể**: vùng mua, điểm cắt lỗ (SL), các mốc chốt lời (TP1, TP2) và tỷ lệ R:R.
3. **Giải thích lý do bằng tiếng Việt dễ hiểu** (vì sao mua, vì sao nên đứng ngoài, có rủi ro gì) và kèm **kiểm chứng nhanh trên dữ liệu quá khứ (Backtest)** để người dùng tự đánh giá độ tin cậy của bộ quy tắc thay vì tin mù quáng.
4. Có hệ thống **Cài đặt theo Chế độ (Modes/Presets)** được tách kiến trúc sẵn để dễ dàng bổ sung các tính năng ở giai đoạn sau (như máy quét toàn thị trường gợi ý coin nên mua).

---

## 2. Mục tiêu, Ngoài phạm vi & Phản mục tiêu

### Mục tiêu (Goals — v1)
- Kết nối trực tiếp Binance Public API (không cần API key), hỗ trợ tìm và phân tích mọi cặp `/USDT` Spot đang giao dịch trên Binance.
- Phân tích đa khung **1H, 4H, 1D, 1W** đồng thời cho coin đang chọn.
- Cung cấp khuyến nghị Spot rõ ràng + vùng mua + cắt lỗ + TP1/TP2 + tỷ lệ R:R + giải thích chi tiết.
- Hiển thị biểu đồ nến tương tác có vẽ sẵn EMA và các đường mức giá (Vùng mua, SL, TP1, TP2).
- Có bảng đối chiếu chỉ báo theo từng khung thời gian và mục **Kiểm chứng quá khứ (Backtest nhanh)** trên chính coin & chế độ đang chọn.
- Danh sách theo dõi (Watchlist) cá nhân để chuyển nhanh giữa các coin quen thuộc.
- Trang/ngăn **Cài đặt (Settings)** hỗ trợ chuyển đổi, tùy chỉnh và lưu các **Chế độ phân tích** (ví dụ: *An toàn*, *Cân bằng*, *Năng động*), kèm xuất/nhập cấu hình JSON.
- Giao diện phong cách **Tờ báo tài chính (Editorial — Mẫu P)**: đẹp, dễ đọc, sang trọng, dùng tốt trên cả máy tính và điện thoại.
- Deploy miễn phí lên **Vercel** dạng ứng dụng web tĩnh (SPA).

### Ngoài phạm vi ở v1 (Non-Goals — để sang bước sau)
- **Máy quét thị trường gợi ý coin nên mua** (quét top 30–100 coin USDT và xếp hạng) — *đã thiết kế kiến trúc sẵn để gắn vào v2 không phải viết lại bộ phân tích*.
- Giao dịch Futures / lệnh Short / tính đòn bẩy.
- Kết nối API key cá nhân để xem số dư hoặc tự động đặt lệnh trên Binance.
- Chạy nền 24/7 và gửi cảnh báo tự động (Telegram/Email).
- Đăng nhập tài khoản / đồng bộ dữ liệu đám mây giữa nhiều thiết bị (v1 dùng `localStorage` + xuất/nhập file JSON).
- Dùng AI/LLM để dự đoán giá (toàn bộ phân tích và lời giải thích đều sinh từ quy tắc định lượng minh bạch, không tốn phí API AI).

### Phản mục tiêu (Anti-Goals — điều tuyệt đối tránh)
- **Hô mua ngược xu hướng lớn mà không cảnh báo rõ:** nếu khung 1D/1W đang giảm mạnh mà 1H nảy lên, tuyệt đối không báo `MUA` mạnh.
- **Hộp đen (Black box):** đưa ra chữ "MUA" nhưng không cho thấy chỉ báo nào đồng thuận, điểm số tính ra sao, và quy tắc đó từng đúng bao nhiêu phần trăm trong quá khứ.
- **Giao diện rối rắm:** nhồi nhét quá nhiều số liệu nhảy liên tục gây mỏi mắt, phá vỡ cảm giác điềm tĩnh của phong cách tờ báo tài chính.
- **Phụ thuộc vào server đặt tại Mỹ:** gọi Binance từ Vercel Serverless Function sẽ bị lỗi `451 Restricted Location`.

---

## 3. Ràng buộc (Constraints)

- **Triển khai trên Vercel (gói miễn phí):** ứng dụng phải build ra static SPA (Vite + React + TypeScript), không cần backend.
- **Lấy dữ liệu trực tiếp từ trình duyệt (Client-side fetch):**
  - Dùng `https://data-api.binance.vision` làm nguồn chính (đã kiểm chứng trả `200 OK` với `Access-Control-Allow-Origin: *`), tự động dự phòng sang `https://api.binance.com` nếu nguồn chính lỗi.
  - Không yêu cầu người dùng nhập Binance API key.
- **Ngôn ngữ & Font chữ:** Giao diện hoàn toàn bằng **tiếng Việt**, dùng bộ font hỗ trợ đầy đủ dấu tiếng Việt (không bị lỗi chữ có chân khi hiển thị tiêu đề).
- **Tôn trọng giới hạn tốc độ của Binance:** lưu đệm (cache) dữ liệu nến ngắn hạn trong phiên (ví dụ 60 giây cho 1H/4H, 5 phút cho 1D/1W) và danh sách cặp coin (`/api/v3/exchangeInfo`) trong 24 giờ để tránh gọi thừa.

---

## 4. Các hướng tiếp cận đã cân nhắc (Approaches)

| Hướng | Mô tả | Đánh đổi | Trạng thái |
|---|---|---|---|
| **A. Static SPA (React + TypeScript) trên Vercel** | Trình duyệt gọi thẳng Binance Public API, tự tính chỉ báo, lưu cài đặt trong `localStorage` (có xuất/nhập JSON). | Cài đặt lưu riêng theo từng trình duyệt/thiết bị; sau này nếu làm máy quét top 100 coin sẽ quét từ trình duyệt (~10–30 giây). Đổi lại: miễn phí 100%, không bị lỗi IP Mỹ 451 của Vercel, tốc độ phản hồi nhanh, dễ mở rộng. | **Đã chọn** |
| **B. Next.js có API Route làm trung gian** | Server Vercel gọi Binance rồi trả về frontend. | Phức tạp hơn, dễ vướng lỗi 451 từ IP Mỹ và giới hạn timeout của gói miễn phí, chưa cần thiết khi chưa có API key hay đồng bộ đám mây. | Không chọn |
| **C. Python (Streamlit)** | Dùng thư viện phân tích kỹ thuật Python. | Không deploy được lên Vercel, khó làm giao diện tinh tế theo phong cách tờ báo tài chính. | Loại |

**Lý do chọn A:** Khớp hoàn toàn với nhu cầu "mở lên xem khi cần", miễn phí trên Vercel, tránh hoàn toàn lỗi chặn IP vùng của Binance, và vẫn giữ được đường nâng cấp sạch sẽ sang backend sau này nếu cần.

---

## 5. Thiết kế chi tiết

### 5.1. Kiến trúc phân tách (Decoupled Engine for Future Expansion)

Hệ thống được chia thành 4 lớp độc lập để v2 (Máy quét thị trường) và các tính năng mở rộng trong Settings có thể tái sử dụng nguyên vẹn bộ phân tích:

1. **`services/binance.ts` (Data Layer):**
   - Lấy danh sách cặp `USDT` đang `TRADING` trên Spot.
   - Lấy nến lịch sử (`klines`) cho các khung `1h`, `4h`, `1d`, `1w` (mỗi khung lấy tối thiểu 250–300 nến để EMA200 ổn định; với coin mới niêm yết ít hơn 200 nến tuần thì tự xử lý mềm bằng EMA50 và ghi chú "chưa đủ dữ liệu EMA200").
   - Lấy giá hiện tại và biến động 24h (`ticker/24hr`).
   - Có cache trong bộ nhớ + retry nhẹ + fallback endpoint.

2. **`engine/` (Pure Analysis & Backtest Engine — không phụ thuộc React/DOM):**
   - `indicators.ts`: tính toán chuẩn xác EMA (21, 50, 200), RSI (14, Wilder's smoothing), MACD (12, 26, 9), Volume SMA (20) & tỷ lệ khối lượng, ATR (14), và phát hiện đỉnh/đáy cục bộ (Swing High/Low) để xác định hỗ trợ/kháng cự.
   - `scorer.ts`: nhận dữ liệu 4 khung + đối tượng cấu hình `AnalysisMode` → chấm điểm từng khung (`-100` đến `+100`), quy đổi tổng hợp thành điểm `0–100`, đưa ra khuyến nghị Spot (`MUA` / `GIỮ` / `BÁN` / `ĐỨNG NGOÀI`) và mức độ đồng thuận đa khung. **Ranh giới 4 trạng thái (đề xuất của mình):**
     - `MUA`: điểm ≥ ngưỡng MUA của chế độ **và** vượt qua bộ lọc xu hướng khung lớn **và** R:R ≥ mức tối thiểu.
     - `BÁN`: điểm ≤ ngưỡng BÁN của chế độ (mặc định `35`), báo hiệu suy yếu rõ ràng để chốt lời hoặc thoát hàng nếu đang nắm giữ.
     - `GIỮ`: nằm giữa ngưỡng BÁN và MUA, điểm ≥ `50` và xu hướng 1D không giảm (nếu đang có hàng thì giữ tiếp, chưa phải điểm mua mới tối ưu).
     - `ĐỨNG NGOÀI`: điểm < `50` (nhưng chưa chạm ngưỡng BÁN), **hoặc** tín hiệu vốn đủ điểm MUA nhưng bị hạ cấp do ngược xu hướng khung lớn hoặc tỷ lệ R:R không đạt.
   - `tradePlan.ts`:
     - Khi kết luận là `MUA`: tính đầy đủ **Vùng mua** (quanh hỗ trợ/EMA21 gần nhất hoặc vùng giá hiện tại nếu đang ở điểm đẹp), **Cắt lỗ (SL)** (dưới đáy gần nhất trừ đệm ATR), **TP1** (kháng cự gần nhất hoặc R:R ≥ 1:1.5), **TP2** (kháng cự tiếp theo hoặc R:R 1:2.5–1:3), và **tỷ lệ R:R**. Nếu R:R < ngưỡng tối thiểu trong Settings, hệ thống hạ khuyến nghị xuống `ĐỨNG NGOÀI` và nêu rõ lý do.
     - Khi kết luận là `GIỮ`, `ĐỨNG NGOÀI`, hoặc `BÁN` **(đề xuất của mình)**: **không** vẽ kế hoạch mua giả để tránh hiểu nhầm. Thay vào đó, hộp cột phải và biểu đồ hiển thị **Các mốc kỹ thuật tham chiếu** (Hỗ trợ gần nhất, Kháng cự gần nhất, và mốc cảnh báo thủng hỗ trợ nếu đang giữ hàng).
   - `narrative.ts`: sinh tiêu đề kiểu báo chí và đoạn phân tích mạch lạc bằng tiếng Việt từ kết quả định lượng (nêu điểm mạnh, điểm yếu, cảnh báo ngược khung nếu có).
   - `backtest.ts`: **Kiểm chứng quá khứ nhanh** — chạy lại đúng quy tắc của chế độ đang bật trên lịch sử nến khung 4H (khoảng 300–500 nến gần nhất, kết hợp lọc xu hướng 1D). **Quy tắc mô phỏng (đề xuất của mình):** vào lệnh tại giá đóng cửa của nến xuất hiện tín hiệu `MUA` (tránh thiên lệch nhìn trước); chốt **50% tại TP1** (đồng thời dời SL phần còn lại về hòa vốn) và chốt **50% tại TP2**, hoặc thoát phần còn lại khi chạm SL / xuất hiện tín hiệu `BÁN`. Trả về: số lệnh mẫu, tỷ lệ thắng (Win rate %), R:R thực tế trung bình, và tổng lãi/lỗ ước tính %, kèm dòng chú thích quy tắc ngay dưới hộp kết quả.

3. **`settings/` (Extensible Modes & Config Store):**
   - Cấu trúc `SettingsSchema` có đánh số phiên bản (`version: 1`) lưu trong `localStorage`, kèm hàm xuất/nhập JSON.
   - Chứa danh sách `modes: AnalysisMode[]`, `activeModeId`, `watchlist: string[]`, và vùng `extensions: Record<string, unknown>` dành sẵn cho các tính năng bổ sung trong tương lai (như cấu hình bộ lọc của Máy quét thị trường ở v2).
   - **3 Chế độ mặc định cài sẵn** (người dùng có thể nhân bản, sửa, hoặc tạo chế độ mới):
     - **An toàn (Conservative):** yêu cầu 1W và 1D không được giảm; trọng số khung lớn cao (1W 25%, 1D 35%, 4H 30%, 1H 10%); ngưỡng `MUA` ≥ 70 điểm; R:R tối thiểu 1:2.0.
     - **Cân bằng (Balanced — mặc định):** trọng số 1W 20%, 1D 30%, 4H 35%, 1H 15%; ngưỡng `MUA` ≥ 65 điểm; R:R tối thiểu 1:1.5.
     - **Năng động (Aggressive):** ưu tiên điểm vào sớm ở 4H/1H (1W 10%, 1D 25%, 4H 40%, 1H 25%); ngưỡng `MUA` ≥ 60 điểm; R:R tối thiểu 1:1.3.

4. **`ui/` (Giao diện Tờ báo tài chính — Phong cách P):**
   - **Bảng màu (Đề xuất của mình):**
     - Nền giấy báo: `#FAF7F0`, nền khối phụ: `#F3EFE6`, đường kẻ mảnh & kẻ đôi: `#D6D0C4` / `#1C1917`.
     - Chữ chính: `#1C1917`, chữ phụ: `#57534E`.
     - Màu tín hiệu tiết chế, sang trọng: Xanh rừng `#15803D` (MUA / Tăng), Đỏ thẫm `#B91C1C` (BÁN / Cắt lỗ / Giảm), Vàng hổ phách `#B45309` (GIỮ / Thận trọng), Xám đá `#475569` (ĐỨNG NGOÀI).
   - **Typography (Đề xuất của mình):**
     - Tiêu đề báo & nhãn lớn: `Lora` hoặc `Newsreader` (serif hỗ trợ tiếng Việt mượt).
     - Văn bản nội dung & UI: `Be Vietnam Pro` hoặc `Inter`.
     - Con số giá, RSI, điểm số: `JetBrains Mono` (tabular-nums để các cột số thẳng hàng).
   - **Bố cục trang chính:**
     1. **Đầu trang báo (Masthead):** Đường kẻ đôi kiểu nhật báo tài chính; tên **BẢN TIN NHẬN ĐỊNH**; ngày giờ cập nhật gần nhất; nút chuyển nhanh Chế độ đang dùng; nút Làm mới; nút mở **Cài đặt**.
     2. **Thanh chọn Coin & Danh sách theo dõi (Watchlist Strip):** Ô tìm kiếm mọi cặp `/USDT` trên Binance (gõ `BTC`, `SOL`, `PEPE`...); dải các coin đã ghim (mặc định có sẵn BTC, ETH, BNB, SOL) hiển thị giá và % 24h, bấm để chuyển ngay.
     3. **Trang nhất — Bài nhận định chính (2 cột trên máy tính, xếp dọc trên điện thoại):**
        - *Cột trái (~62%):* Nhãn khuyến nghị nổi bật (`MUA` / `GIỮ` / `BÁN` / `ĐỨNG NGOÀI`) + **Tiêu đề bài báo** (ví dụ: *"Bitcoin: Xu hướng tăng đa khung được xác nhận, khuyến nghị MUA quanh vùng 95,800"*) + đoạn phân tích 3–5 câu giải thích rõ lý do từng khung + hộp lưu ý rủi ro (nếu có).
        - *Cột phải (~38%, phân tách bằng đường kẻ dọc mảnh):* **Hộp Kế hoạch lệnh Spot** — Điểm tổng hợp (`72 / 100`), Vùng mua, Cắt lỗ (% khoảng cách), TP1 & TP2 (% lợi nhuận), Tỷ lệ R:R, và tóm tắt trạng thái 4 khung `1W · 1D · 4H · 1H`.
     4. **Biểu đồ kỹ thuật (Chart Section):** Dùng `lightweight-charts` (TradingView), phối màu sáng ấm đồng bộ nền giấy báo. Chuyển đổi khung `1H / 4H / 1D / 1W`, bật/tắt EMA 21/50/200, và vẽ trực tiếp các đường ngang nét đứt cho **Vùng mua**, **Cắt lỗ (SL)**, **TP1**, **TP2**.
     5. **Bảng đối chiếu đa khung (Indicator Matrix):** Bảng 4 cột (`1H`, `4H`, `1D`, `1W`) × các hàng (`Xu hướng EMA`, `RSI (14)`, `MACD`, `Khối lượng`, `Điểm khung`) giúp người dùng tự kiểm tra nguồn gốc của điểm số.
     6. **Hộp Kiểm chứng quá khứ (Quick Backtest):** Tóm tắt kết quả chạy thử bộ quy tắc hiện tại trên dữ liệu cũ của coin đang xem (số tín hiệu, tỷ lệ thắng, R:R trung bình, tổng hiệu suất ước tính) kèm ghi chú rõ đây là mô phỏng quá khứ, không đảm bảo tương lai.
     7. **Ngăn Cài đặt (Settings Drawer/Modal):**
        - Tab **Chế độ phân tích:** chọn chế độ, nhân bản/tạo mới, chỉnh thông số chỉ báo (chu kỳ EMA, RSI quá mua/quá bán, MACD), trọng số 4 khung, trọng số từng chỉ báo, ngưỡng điểm MUA/BÁN, R:R tối thiểu.
        - Tab **Dữ liệu & Mở rộng:** Xuất/Nhập file JSON cấu hình; khôi phục mặc định; khu vực "Tính năng sắp tới" (ghi chú chỗ cho Máy quét thị trường ở v2).

---

## 6. Các quyết định do mình đề xuất (Agent's Calls)

Những điểm dưới đây bạn chưa chỉ định cụ thể nên mình đề xuất để chốt luôn; bạn có thể sửa bất kỳ điểm nào trước khi bắt đầu làm:
1. **Bộ chỉ báo v1:** EMA (21, 50, 200), RSI (14), MACD (12, 26, 9), Volume (so với trung bình 20 nến), ATR (14) + Đỉnh/đáy gần nhất (hỗ trợ/kháng cự).
2. **Thư viện biểu đồ:** `lightweight-charts` của TradingView (nhẹ, mượt, miễn phí, vẽ được đường SL/TP/EMA rất sắc nét).
3. **3 Chế độ cài sẵn:** *An toàn*, *Cân bằng* (mặc định), *Năng động*.
4. **Kiểm chứng quá khứ (Backtest nhanh):** mô phỏng trên lịch sử ~400 nến khung 4H gần nhất (kết hợp lọc xu hướng 1D) của chính coin đang xem.
5. **Danh sách theo dõi mặc định lần đầu mở app:** BTC, ETH, BNB, SOL (người dùng tự thêm/xóa tùy ý).
6. **Không gọi AI bên ngoài:** toàn bộ phân tích và đoạn văn giải thích được sinh từ quy tắc định lượng để chạy tức thì, miễn phí và nhất quán.
7. **Ranh giới `GIỮ` vs `ĐỨNG NGOÀI` và hiển thị khi không `MUA`:** `GIỮ` áp dụng khi điểm ≥ 50 và khung 1D không giảm; `ĐỨNG NGOÀI` khi điểm < 50 hoặc bị hạ cấp do ngược xu hướng / R:R thấp. Ở các trạng thái không phải `MUA`, giao diện hiển thị **mốc Hỗ trợ / Kháng cự tham chiếu** thay vì vẽ kế hoạch mua giả.
8. **Quy tắc mô phỏng Backtest nhanh:** vào lệnh ở giá đóng cửa nến báo `MUA`, chốt 50% tại TP1 (dời SL về hòa vốn) và 50% tại TP2 (hoặc thoát khi chạm SL / báo `BÁN`).

---

## 7. Phần để lại cho người triển khai (Left to the Builder)

- Chi tiết công thức chuẩn hóa điểm từng chỉ báo về thang `-100..+100` và xử lý biên (ví dụ coin mới list có ít nến 1W, cặp coin giá rất nhỏ như `PEPEUSDT` cần định dạng nhiều chữ số thập phân).
- Cách tổ chức thư mục mã nguồn Vite + React + TypeScript + Tailwind CSS và cấu hình `vercel.json` (nếu cần SPA fallback).
- Kiểm thử đơn vị (unit test) cho các hàm tính chỉ báo (EMA, RSI, MACD, ATR), chấm điểm đa khung, tính SL/TP và backtest.
- Xử lý trạng thái tải (loading skeleton theo phong cách báo chí), lỗi mạng / mất kết nối Binance, và responsive cho màn hình điện thoại.

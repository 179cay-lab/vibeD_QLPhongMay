# QLPhongMay

Phần mềm quản lý phòng máy trên Windows (React + TypeScript + Tauri/Rust + SQLite).

## MVP 1 (chế độ Demo)
- Quản lý máy và dãy máy, lưu SQLite.
- Nhập/xuất CSV (`so_may,ten_may,ip,day,vi_tri`, có BOM cho Excel).
- Nhật ký thao tác.
- **Đăng ký số máy**: máy học sinh bấm "Tôi là máy số N", máy chủ ghi IP LAN gửi tới làm IP của máy N.
  Demo giả lập thao tác này; agent thật làm ở Phase 2.
- Chính sách trùng: số máy / tên máy → chặn; IP → cảnh báo và hỏi xác nhận.

## Chạy
Cần Node.js 20+, Rust, WebView2 (Windows 10/11 thường có sẵn).

```
npm install
npm run tauri dev      # chạy app desktop (SQLite)
npm run dev            # chỉ giao diện trên trình duyệt (localStorage)
npm test               # kiểm thử logic
npm run tauri build    # tạo bộ cài .exe (NSIS)
```

Hoặc vào tab **Actions → Build Windows → Run workflow** trên GitHub, tải file `.exe` ở mục Artifacts.

## Lộ trình
Phase 2: agent trên máy học sinh + máy chủ nhận đăng ký thật, đóng gói cho người dùng cuối.
Phase 4: tích hợp Veyon (chưa làm).

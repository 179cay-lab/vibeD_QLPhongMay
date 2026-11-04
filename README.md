# QLPhongMay

Phần mềm quản lý phòng máy trên Windows (React + TypeScript + Tauri/Rust + SQLite).

## MVP 1 (chế độ Demo)
- Quản lý máy và dãy máy, lưu SQLite.
- Nhập/xuất CSV (`so_may,ten_may,ip,day,vi_tri`, có BOM cho Excel).
- Nhật ký thao tác.
- **Đăng ký số máy**: máy học sinh bấm "Tôi là máy số N", máy chủ ghi IP LAN gửi tới làm IP của máy N.
  Demo giả lập thao tác này; agent thật làm ở Phase 2.
- Chính sách trùng: số máy / tên máy → chặn; IP → cảnh báo và hỏi xác nhận.

## Phase 2: giám sát màn hình + đăng ký số máy thật
- `crates/core`: máy chủ (chạy ngầm trong app, cổng 7878) — nhận agent, phát ảnh màn hình cho giao diện, trang `/enroll` cho học sinh.
- `crates/agent` (`qlpm-agent.exe`): chạy trên máy học sinh, gửi ảnh thu nhỏ màn hình mỗi giây, nhận lệnh tắt máy / khởi động lại / mở trang đăng ký.
  `qlpm-agent.exe --server IP_GIAO_VIEN:7878 --token MÃ` (mã hiện trên trang Giám sát).
- Nhận diện máy bằng IP LAN nguồn của kết nối, nên cắm dây lộn xộn cũng đúng số máy sau khi đăng ký.
- Thử không cần máy thật: `cargo run -p qlpm-core --bin server` và `cargo run -p qlpm-agent -- --server 127.0.0.1:7878 --token MÃ --fake PC-A`.
- Chưa có: khoá/mở khoá màn hình, gửi thông báo, agent tự chạy cùng Windows, mã hoá đường truyền (chỉ nên dùng trong mạng LAN phòng máy).

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

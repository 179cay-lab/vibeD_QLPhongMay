//! Chạy máy chủ độc lập (không cần giao diện) — dùng để kiểm thử.
#[tokio::main]
async fn main() {
    let port = std::env::args().nth(1).and_then(|p| p.parse().ok()).unwrap_or(qlpm_core::DEFAULT_PORT);
    let dir = std::env::args().nth(2).map(std::path::PathBuf::from);
    eprintln!("qlpm-server nghe cổng {port}");
    if let Err(e) = qlpm_core::run(qlpm_core::Config { port, data_dir: dir }).await {
        eprintln!("lỗi: {e}");
        std::process::exit(1);
    }
}

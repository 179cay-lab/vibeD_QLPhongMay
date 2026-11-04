//! Agent chạy trên máy học sinh: gửi ảnh thu nhỏ màn hình lên máy giáo viên và nhận lệnh.
mod capture;

use futures_util::{SinkExt, StreamExt};
use std::time::Duration;
use tokio_tungstenite::{connect_async, tungstenite::Message};

struct Args {
    server: String,
    token: String,
    fake: Option<String>,
    interval_ms: u64,
    /// Chỉ để kiểm thử nhiều máy trên một máy thật: gắn nguồn kết nối vào IP này (vd 127.0.0.2).
    bind: Option<std::net::Ipv4Addr>,
}

fn parse_args() -> Result<Args, String> {
    let mut a = Args { server: String::new(), token: String::new(), fake: None, interval_ms: 1000, bind: None };
    let mut it = std::env::args().skip(1);
    while let Some(k) = it.next() {
        match k.as_str() {
            "--server" => a.server = it.next().ok_or("thiếu giá trị --server")?,
            "--token" => a.token = it.next().ok_or("thiếu giá trị --token")?,
            "--fake" => a.fake = Some(it.next().ok_or("thiếu nhãn cho --fake")?),
            "--bind" => a.bind = Some(it.next().and_then(|v| v.parse().ok()).ok_or("--bind sai")?),
            "--interval-ms" => a.interval_ms = it.next().and_then(|v| v.parse().ok()).ok_or("--interval-ms sai")?,
            other => return Err(format!("tham số lạ: {other}")),
        }
    }
    if a.server.is_empty() || a.token.is_empty() {
        return Err("cách dùng: qlpm-agent --server IP:7878 --token MÃ [--fake NHÃN]".into());
    }
    Ok(a)
}

fn hostname() -> String {
    std::env::var("COMPUTERNAME").or_else(|_| std::env::var("HOSTNAME")).unwrap_or_else(|_| "unknown".into())
}

#[tokio::main]
async fn main() {
    let args = match parse_args() {
        Ok(a) => a,
        Err(e) => {
            eprintln!("{e}");
            std::process::exit(2);
        }
    };
    loop {
        if let Err(e) = session(&args).await {
            eprintln!("mất kết nối: {e}; thử lại sau 3 giây");
        }
        tokio::time::sleep(Duration::from_secs(3)).await;
    }
}

async fn session(args: &Args) -> Result<(), String> {
    let url = format!("ws://{}/ws/agent", args.server);
    let ws = if let Some(ip) = args.bind {
        let sock = tokio::net::TcpSocket::new_v4().map_err(|e| e.to_string())?;
        sock.bind((ip, 0).into()).map_err(|e| e.to_string())?;
        let addr = tokio::net::lookup_host(&args.server).await.map_err(|e| e.to_string())?.next().ok_or("không phân giải được server")?;
        let tcp = sock.connect(addr).await.map_err(|e| e.to_string())?;
        tokio_tungstenite::client_async(&url, tokio_tungstenite::MaybeTlsStream::Plain(tcp)).await.map_err(|e| e.to_string())?.0
    } else {
        connect_async(&url).await.map_err(|e| e.to_string())?.0
    };
    let (mut sink, mut stream) = ws.split();
    let name = args.fake.clone().unwrap_or_else(hostname);
    let hello = serde_json::json!({ "type": "hello", "token": args.token, "hostname": name });
    sink.send(Message::Text(hello.to_string())).await.map_err(|e| e.to_string())?;
    eprintln!("đã kết nối {url}");

    let (frame_tx, mut frame_rx) = tokio::sync::mpsc::channel::<Vec<u8>>(1);
    let fake = args.fake.clone();
    let interval = Duration::from_millis(args.interval_ms);
    let capturer = tokio::spawn(async move {
        let mut seq = 0u32;
        loop {
            let f = fake.clone();
            let label = f.clone().unwrap_or_default();
            let r = tokio::task::spawn_blocking(move || capture::capture_jpeg(f.is_some(), seq, &label)).await;
            seq = seq.wrapping_add(1);
            match r {
                Ok(Ok(jpeg)) => {
                    if frame_tx.send(jpeg).await.is_err() {
                        break;
                    }
                }
                Ok(Err(e)) => eprintln!("lỗi chụp màn hình: {e}"),
                Err(_) => break,
            }
            tokio::time::sleep(interval).await;
        }
    });

    let result = loop {
        tokio::select! {
            Some(jpeg) = frame_rx.recv() => {
                if let Err(e) = sink.send(Message::Binary(jpeg)).await { break Err(e.to_string()); }
            }
            msg = stream.next() => match msg {
                Some(Ok(Message::Text(t))) => handle_cmd(&t, &args.server, args.fake.is_some()).await,
                Some(Ok(Message::Close(_))) | None => break Ok(()),
                Some(Err(e)) => break Err(e.to_string()),
                _ => {}
            }
        }
    };
    capturer.abort();
    result
}

async fn handle_cmd(text: &str, server: &str, fake: bool) {
    let Ok(v) = serde_json::from_str::<serde_json::Value>(text) else { return };
    if v["type"] != "cmd" {
        return;
    }
    let cmd = v["cmd"].as_str().unwrap_or("");
    eprintln!("nhận lệnh: {cmd}");
    // Ở chế độ --fake chỉ in ra, không tắt máy thật.
    if fake {
        return;
    }
    run_cmd(cmd, server).await;
}

#[cfg(windows)]
async fn run_cmd(cmd: &str, server: &str) {
    use tokio::process::Command;
    match cmd {
        "shutdown" => { let _ = Command::new("shutdown").args(["/s", "/t", "10", "/c", "Giáo viên tắt máy"]).spawn(); }
        "restart" => { let _ = Command::new("shutdown").args(["/r", "/t", "10", "/c", "Giáo viên khởi động lại máy"]).spawn(); }
        "open_enroll" => {
            let host = server.split(':').next().unwrap_or(server);
            let port = server.split(':').nth(1).unwrap_or("7878");
            let _ = Command::new("cmd").args(["/c", "start", "", &format!("http://{host}:{port}/enroll")]).spawn();
        }
        _ => {}
    }
}

#[cfg(not(windows))]
async fn run_cmd(cmd: &str, _server: &str) {
    eprintln!("(không phải Windows) bỏ qua lệnh {cmd}");
}

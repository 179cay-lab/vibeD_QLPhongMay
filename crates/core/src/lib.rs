//! Máy chủ QLPhongMay: nhận kết nối từ agent (ảnh màn hình), trang đăng ký số máy
//! cho học sinh, và kênh WebSocket cho giao diện quản trị.
//!
//! Giao thức:
//!  * Agent  -> `/ws/agent`: text `{"type":"hello","token","hostname"}`, sau đó binary = ảnh JPEG.
//!    Server -> agent: text `{"type":"cmd","cmd":"shutdown|restart|open_enroll"}`.
//!  * UI     -> `/ws/ui` (chỉ loopback): xem `UiIn`. Server -> UI: text JSON (`UiOut`) hoặc binary
//!    `[độ dài ip: u8][ip][jpeg]`.
//!  * Học sinh mở `/enroll` (trình duyệt) và gửi số máy; IP nguồn của request chính là IP máy đó.

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        ConnectInfo, State,
    },
    http::{header, HeaderMap, StatusCode},
    response::{Html, IntoResponse},
    routing::get,
    Json, Router,
};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::{
    collections::HashMap,
    net::SocketAddr,
    path::PathBuf,
    sync::{Arc, Mutex},
    time::Duration,
};
use tokio::sync::{broadcast, mpsc, oneshot};

pub const DEFAULT_PORT: u16 = 7878;
const ENROLL_PAGE: &str = include_str!("enroll.html");

#[derive(Clone)]
pub struct Config {
    pub port: u16,
    /// Thư mục lưu token (file `token.txt`). `None` = token ngẫu nhiên mỗi lần chạy.
    pub data_dir: Option<PathBuf>,
}

struct AgentConn {
    hostname: String,
    tx: mpsc::UnboundedSender<String>,
    conn_id: u64,
}

#[derive(Default)]
struct Inner {
    agents: HashMap<String, AgentConn>,
    frames: HashMap<String, Vec<u8>>,
    enroll_on: bool,
    pending: HashMap<u64, oneshot::Sender<(bool, String)>>,
    next_id: u64,
}

struct Shared {
    token: String,
    port: u16,
    inner: Mutex<Inner>,
    ui_tx: broadcast::Sender<Message>,
}
type App = Arc<Shared>;

#[derive(Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum UiIn {
    EnrollMode { on: bool },
    EnrollReply { id: u64, ok: bool, message: String },
    Command { ips: Vec<String>, cmd: String },
}

#[derive(Serialize)]
struct AgentInfo {
    ip: String,
    hostname: String,
}

fn load_token(dir: &Option<PathBuf>) -> String {
    if let Some(d) = dir {
        let f = d.join("token.txt");
        if let Ok(t) = std::fs::read_to_string(&f) {
            let t = t.trim().to_string();
            if !t.is_empty() {
                return t;
            }
        }
        let t = random_token();
        let _ = std::fs::create_dir_all(d);
        let _ = std::fs::write(&f, &t);
        return t;
    }
    random_token()
}

/// IP LAN của máy này (dò bằng UDP socket, không gửi gói nào ra ngoài).
fn lan_ip() -> Option<String> {
    let sock = std::net::UdpSocket::bind("0.0.0.0:0").ok()?;
    sock.connect("8.8.8.8:80").ok()?;
    Some(sock.local_addr().ok()?.ip().to_string())
}

fn random_token() -> String {
    use rand::Rng;
    const A: &[u8] = b"abcdefghjkmnpqrstuvwxyz23456789";
    let mut r = rand::thread_rng();
    (0..8).map(|_| A[r.gen_range(0..A.len())] as char).collect()
}

fn text(v: serde_json::Value) -> Message {
    Message::Text(v.to_string())
}

fn agents_msg(inner: &Inner) -> Message {
    let list: Vec<AgentInfo> = inner
        .agents
        .iter()
        .map(|(ip, a)| AgentInfo { ip: ip.clone(), hostname: a.hostname.clone() })
        .collect();
    text(json!({ "type": "agents", "list": list }))
}

/// Chạy máy chủ cho tới khi lỗi (thường là không bind được cổng).
pub async fn run(cfg: Config) -> std::io::Result<()> {
    let (ui_tx, _) = broadcast::channel(512);
    let app: App = Arc::new(Shared {
        token: load_token(&cfg.data_dir),
        port: cfg.port,
        inner: Mutex::new(Inner::default()),
        ui_tx,
    });
    let router = Router::new()
        .route("/enroll", get(enroll_page).post(enroll_post))
        .route("/ws/agent", get(ws_agent))
        .route("/ws/ui", get(ws_ui))
        .with_state(app);
    let listener = tokio::net::TcpListener::bind(("0.0.0.0", cfg.port)).await?;
    axum::serve(listener, router.into_make_service_with_connect_info::<SocketAddr>()).await
}

async fn enroll_page() -> Html<&'static str> {
    Html(ENROLL_PAGE)
}

#[derive(Deserialize)]
struct EnrollBody {
    number: u32,
}

async fn enroll_post(
    State(app): State<App>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    Json(body): Json<EnrollBody>,
) -> impl IntoResponse {
    let fail = |code: StatusCode, m: &str| (code, Json(json!({ "ok": false, "message": m })));
    let (id, rx) = {
        let mut g = app.inner.lock().unwrap();
        if !g.enroll_on {
            return fail(StatusCode::FORBIDDEN, "Giáo viên chưa mở đăng ký số máy.");
        }
        if app.ui_tx.receiver_count() == 0 {
            return fail(StatusCode::SERVICE_UNAVAILABLE, "Máy giáo viên chưa sẵn sàng.");
        }
        g.next_id += 1;
        let id = g.next_id;
        let (tx, rx) = oneshot::channel();
        g.pending.insert(id, tx);
        (id, rx)
    };
    let _ = app.ui_tx.send(text(json!({
        "type": "enroll_request", "id": id, "number": body.number, "ip": peer.ip().to_string()
    })));
    match tokio::time::timeout(Duration::from_secs(15), rx).await {
        Ok(Ok((ok, message))) => (StatusCode::OK, Json(json!({ "ok": ok, "message": message }))),
        _ => {
            app.inner.lock().unwrap().pending.remove(&id);
            fail(StatusCode::GATEWAY_TIMEOUT, "Máy giáo viên không phản hồi, thử lại.")
        }
    }
}

// ---------- agent ----------

async fn ws_agent(
    ws: WebSocketUpgrade,
    State(app): State<App>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
) -> impl IntoResponse {
    ws.max_message_size(4 << 20).on_upgrade(move |s| agent_conn(s, app, peer.ip().to_string()))
}

async fn agent_conn(socket: WebSocket, app: App, ip: String) {
    let (mut sink, mut stream) = socket.split();
    // Tin đầu tiên phải là hello hợp lệ.
    let hostname = match tokio::time::timeout(Duration::from_secs(5), stream.next()).await {
        Ok(Some(Ok(Message::Text(t)))) => match serde_json::from_str::<serde_json::Value>(&t) {
            Ok(v) if v["type"] == "hello" && v["token"] == app.token.as_str() => {
                v["hostname"].as_str().unwrap_or("?").chars().take(64).collect::<String>()
            }
            _ => return,
        },
        _ => return,
    };

    let (tx, mut rx) = mpsc::unbounded_channel::<String>();
    let conn_id = {
        let mut g = app.inner.lock().unwrap();
        g.next_id += 1;
        let cid = g.next_id;
        g.agents.insert(ip.clone(), AgentConn { hostname, tx, conn_id: cid });
        let m = agents_msg(&g);
        let _ = app.ui_tx.send(m);
        cid
    };

    let writer = tokio::spawn(async move {
        while let Some(m) = rx.recv().await {
            if sink.send(Message::Text(m)).await.is_err() {
                break;
            }
        }
    });

    while let Some(Ok(msg)) = stream.next().await {
        if let Message::Binary(jpeg) = msg {
            let mut g = app.inner.lock().unwrap();
            // bỏ qua nếu đã có kết nối mới hơn từ cùng IP
            if g.agents.get(&ip).map(|a| a.conn_id) != Some(conn_id) {
                break;
            }
            if app.ui_tx.receiver_count() > 0 {
                let mut out = Vec::with_capacity(jpeg.len() + ip.len() + 1);
                out.push(ip.len() as u8);
                out.extend_from_slice(ip.as_bytes());
                out.extend_from_slice(&jpeg);
                let _ = app.ui_tx.send(Message::Binary(out));
            }
            g.frames.insert(ip.clone(), jpeg);
        }
    }

    writer.abort();
    let mut g = app.inner.lock().unwrap();
    if g.agents.get(&ip).map(|a| a.conn_id) == Some(conn_id) {
        g.agents.remove(&ip);
        g.frames.remove(&ip);
        let m = agents_msg(&g);
        let _ = app.ui_tx.send(m);
    }
}

// ---------- giao diện quản trị ----------

fn origin_ok(h: &HeaderMap) -> bool {
    let Some(o) = h.get(header::ORIGIN).and_then(|v| v.to_str().ok()) else { return true };
    let host = o.split("://").nth(1).unwrap_or("").split(':').next().unwrap_or("");
    matches!(host, "localhost" | "127.0.0.1" | "tauri.localhost")
}

async fn ws_ui(
    ws: WebSocketUpgrade,
    State(app): State<App>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
) -> impl IntoResponse {
    if !peer.ip().is_loopback() || !origin_ok(&headers) {
        return StatusCode::FORBIDDEN.into_response();
    }
    ws.on_upgrade(move |s| ui_conn(s, app)).into_response()
}

async fn ui_conn(socket: WebSocket, app: App) {
    let (mut sink, mut stream) = socket.split();
    let mut sub = app.ui_tx.subscribe();

    let initial: Vec<Message> = {
        let g = app.inner.lock().unwrap();
        let mut v = vec![
            text(json!({ "type": "info", "token": app.token, "port": app.port, "lan_ip": lan_ip() })),
            text(json!({ "type": "enroll_mode", "on": g.enroll_on })),
            agents_msg(&g),
        ];
        for (ip, jpeg) in &g.frames {
            let mut out = vec![ip.len() as u8];
            out.extend_from_slice(ip.as_bytes());
            out.extend_from_slice(jpeg);
            v.push(Message::Binary(out));
        }
        v
    };
    for m in initial {
        if sink.send(m).await.is_err() {
            return;
        }
    }

    let forward = tokio::spawn(async move {
        loop {
            match sub.recv().await {
                Ok(m) => {
                    if sink.send(m).await.is_err() {
                        break;
                    }
                }
                Err(broadcast::error::RecvError::Lagged(_)) => continue,
                Err(_) => break,
            }
        }
    });

    while let Some(Ok(msg)) = stream.next().await {
        let Message::Text(t) = msg else { continue };
        let Ok(cmd) = serde_json::from_str::<UiIn>(&t) else { continue };
        let mut g = app.inner.lock().unwrap();
        match cmd {
            UiIn::EnrollMode { on } => {
                g.enroll_on = on;
                let _ = app.ui_tx.send(text(json!({ "type": "enroll_mode", "on": on })));
            }
            UiIn::EnrollReply { id, ok, message } => {
                if let Some(tx) = g.pending.remove(&id) {
                    let _ = tx.send((ok, message));
                }
            }
            UiIn::Command { ips, cmd } => {
                if !matches!(cmd.as_str(), "shutdown" | "restart" | "open_enroll") {
                    continue;
                }
                let payload = json!({ "type": "cmd", "cmd": cmd }).to_string();
                for ip in ips {
                    if let Some(a) = g.agents.get(&ip) {
                        let _ = a.tx.send(payload.clone());
                    }
                }
            }
        }
    }
    forward.abort();
    // UI đóng: tắt chế độ đăng ký để học sinh không gửi vào hư không
    let mut g = app.inner.lock().unwrap();
    if app.ui_tx.receiver_count() <= 1 {
        g.enroll_on = false;
    }
}

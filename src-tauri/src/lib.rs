mod db;

use db::{LogEntry, Machine, Row, Snapshot};
use rusqlite::Connection;
use std::sync::Mutex;
use tauri::{Manager, State};

struct Db(Mutex<Connection>);

fn err<E: ToString>(e: E) -> String {
    e.to_string()
}

#[tauri::command]
fn db_load(state: State<Db>) -> Result<Snapshot, String> {
    let conn = state.0.lock().map_err(err)?;
    db::load(&conn).map_err(err)
}

#[tauri::command]
fn db_save_snapshot(state: State<Db>, rows: Vec<Row>, machines: Vec<Machine>) -> Result<(), String> {
    let mut conn = state.0.lock().map_err(err)?;
    db::save_snapshot(&mut conn, &rows, &machines).map_err(err)
}

#[tauri::command]
fn db_add_log(state: State<Db>, entry: LogEntry) -> Result<(), String> {
    let conn = state.0.lock().map_err(err)?;
    db::add_log(&conn, &entry).map_err(err)
}

#[tauri::command]
fn db_clear_logs(state: State<Db>) -> Result<(), String> {
    let conn = state.0.lock().map_err(err)?;
    db::clear_logs(&conn).map_err(err)
}

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&dir)?;
            let conn = Connection::open(dir.join("qlphongmay.db"))?;
            db::init(&conn)?;
            app.manage(Db(Mutex::new(conn)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            db_load,
            db_save_snapshot,
            db_add_log,
            db_clear_logs
        ])
        .run(tauri::generate_context!())
        .expect("lỗi khi chạy ứng dụng QLPhongMay");
}

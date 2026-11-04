//! Lưu trữ SQLite. Tách riêng khỏi Tauri để dễ kiểm thử.
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct Row {
    pub id: String,
    pub name: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Machine {
    pub id: String,
    pub number: i64,
    pub name: String,
    pub ip: String,
    pub row_id: Option<String>,
    pub seat: Option<i64>,
    pub enrolled: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct LogEntry {
    pub id: String,
    pub ts: String,
    pub action: String,
    pub detail: String,
}

#[derive(Serialize, Deserialize, Default, Debug)]
pub struct Snapshot {
    pub rows: Vec<Row>,
    pub machines: Vec<Machine>,
    pub logs: Vec<LogEntry>,
}

pub fn init(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS rows (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            sort INTEGER NOT NULL DEFAULT 0
         );
         CREATE TABLE IF NOT EXISTS machines (
            id TEXT PRIMARY KEY,
            number INTEGER NOT NULL UNIQUE,
            name TEXT NOT NULL UNIQUE COLLATE NOCASE,
            ip TEXT NOT NULL DEFAULT '',
            row_id TEXT,
            seat INTEGER,
            enrolled INTEGER NOT NULL DEFAULT 0
         );
         CREATE TABLE IF NOT EXISTS logs (
            id TEXT PRIMARY KEY,
            ts TEXT NOT NULL,
            action TEXT NOT NULL,
            detail TEXT NOT NULL
         );",
    )
}

pub fn load(conn: &Connection) -> rusqlite::Result<Snapshot> {
    let rows = conn
        .prepare("SELECT id, name FROM rows ORDER BY sort")?
        .query_map([], |r| Ok(Row { id: r.get(0)?, name: r.get(1)? }))?
        .collect::<Result<Vec<_>, _>>()?;
    let machines = conn
        .prepare("SELECT id, number, name, ip, row_id, seat, enrolled FROM machines ORDER BY number")?
        .query_map([], |r| {
            Ok(Machine {
                id: r.get(0)?,
                number: r.get(1)?,
                name: r.get(2)?,
                ip: r.get(3)?,
                row_id: r.get(4)?,
                seat: r.get(5)?,
                enrolled: r.get::<_, i64>(6)? != 0,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    let logs = conn
        .prepare("SELECT id, ts, action, detail FROM logs ORDER BY ts DESC, rowid DESC LIMIT 1000")?
        .query_map([], |r| {
            Ok(LogEntry { id: r.get(0)?, ts: r.get(1)?, action: r.get(2)?, detail: r.get(3)? })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(Snapshot { rows, machines, logs })
}

/// Ghi đè toàn bộ dãy + máy trong một giao dịch (dữ liệu nhỏ, ~vài chục máy).
pub fn save_snapshot(conn: &mut Connection, rows: &[Row], machines: &[Machine]) -> rusqlite::Result<()> {
    let tx = conn.transaction()?;
    tx.execute("DELETE FROM machines", [])?;
    tx.execute("DELETE FROM rows", [])?;
    for (i, r) in rows.iter().enumerate() {
        tx.execute(
            "INSERT INTO rows (id, name, sort) VALUES (?1, ?2, ?3)",
            params![r.id, r.name, i as i64],
        )?;
    }
    for m in machines {
        tx.execute(
            "INSERT INTO machines (id, number, name, ip, row_id, seat, enrolled)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![m.id, m.number, m.name, m.ip, m.row_id, m.seat, m.enrolled as i64],
        )?;
    }
    tx.commit()
}

pub fn add_log(conn: &Connection, e: &LogEntry) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO logs (id, ts, action, detail) VALUES (?1, ?2, ?3, ?4)",
        params![e.id, e.ts, e.action, e.detail],
    )?;
    Ok(())
}

pub fn clear_logs(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute("DELETE FROM logs", [])?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn machine(id: &str, number: i64, name: &str) -> Machine {
        Machine {
            id: id.into(),
            number,
            name: name.into(),
            ip: format!("192.168.1.{}", 100 + number),
            row_id: Some("r1".into()),
            seat: Some(number),
            enrolled: number % 2 == 0,
        }
    }

    #[test]
    fn roundtrip() {
        let mut conn = Connection::open_in_memory().unwrap();
        init(&conn).unwrap();
        let rows = vec![Row { id: "r1".into(), name: "Dãy 1".into() }];
        let machines = vec![machine("a", 1, "PC-01"), machine("b", 2, "PC-02")];
        save_snapshot(&mut conn, &rows, &machines).unwrap();
        add_log(&conn, &LogEntry { id: "l1".into(), ts: "2026-01-01T00:00:00Z".into(), action: "x".into(), detail: "y".into() }).unwrap();
        let s = load(&conn).unwrap();
        assert_eq!(s.rows, rows);
        assert_eq!(s.machines, machines);
        assert_eq!(s.logs.len(), 1);
        clear_logs(&conn).unwrap();
        assert!(load(&conn).unwrap().logs.is_empty());
    }

    #[test]
    fn duplicate_name_rolls_back() {
        let mut conn = Connection::open_in_memory().unwrap();
        init(&conn).unwrap();
        let ok = vec![machine("a", 1, "PC-01")];
        save_snapshot(&mut conn, &[], &ok).unwrap();
        let bad = vec![machine("a", 1, "PC-01"), machine("b", 2, "pc-01")];
        assert!(save_snapshot(&mut conn, &[], &bad).is_err());
        assert_eq!(load(&conn).unwrap().machines, ok);
    }
}

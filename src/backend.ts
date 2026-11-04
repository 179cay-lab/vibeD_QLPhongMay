import { invoke } from '@tauri-apps/api/core'
import type { LogEntry, Machine, Row, Snapshot } from './types'

/** true khi chạy trong cửa sổ Tauri (có SQLite); false khi chạy trên trình duyệt (dùng localStorage). */
export const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

const KEY = 'qlphongmay.v1'

function readLocal(): Snapshot {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as Snapshot
  } catch { /* bỏ qua */ }
  return { rows: [], machines: [], logs: [] }
}
function writeLocal(s: Snapshot) {
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* bỏ qua */ }
}

export const backend = {
  async load(): Promise<Snapshot> {
    return isTauri ? invoke<Snapshot>('db_load') : readLocal()
  },
  async saveSnapshot(rows: Row[], machines: Machine[]): Promise<void> {
    if (isTauri) return invoke('db_save_snapshot', { rows, machines })
    writeLocal({ ...readLocal(), rows, machines })
  },
  async addLog(entry: LogEntry): Promise<void> {
    if (isTauri) return invoke('db_add_log', { entry })
    const s = readLocal()
    writeLocal({ ...s, logs: [entry, ...s.logs].slice(0, 1000) })
  },
  async clearLogs(): Promise<void> {
    if (isTauri) return invoke('db_clear_logs')
    writeLocal({ ...readLocal(), logs: [] })
  },
}

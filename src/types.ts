export interface Row {
  id: string
  name: string
}

export interface Machine {
  id: string
  number: number
  name: string
  ip: string
  rowId: string | null
  seat: number | null
  /** Đã được xác định số máy qua tính năng "Đăng ký số máy" */
  enrolled: boolean
}

export interface LogEntry {
  id: string
  ts: string
  action: string
  detail: string
}

export interface Snapshot {
  rows: Row[]
  machines: Machine[]
  logs: LogEntry[]
}

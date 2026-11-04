import type { Machine, Row } from './types'

export const CSV_HEADER = ['so_may', 'ten_may', 'ip', 'day', 'vi_tri']

function esc(v: string | number): string {
  const s = String(v)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function machinesToCsv(machines: Machine[], rows: Row[]): string {
  const rowName = new Map(rows.map((r) => [r.id, r.name]))
  const lines = [CSV_HEADER.join(',')]
  for (const m of machines) {
    lines.push(
      [m.number, m.name, m.ip, m.rowId ? rowName.get(m.rowId) ?? '' : '', m.seat ?? '']
        .map(esc)
        .join(','),
    )
  }
  // BOM để Excel đọc đúng tiếng Việt
  return '﻿' + lines.join('\r\n') + '\r\n'
}

export function parseCsv(text: string): string[][] {
  const out: string[][] = []
  let row: string[] = []
  let cur = ''
  let quoted = false
  const src = text.replace(/^﻿/, '')
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { cur += '"'; i++ }
      else if (c === '"') quoted = false
      else cur += c
    } else if (c === '"') quoted = true
    else if (c === ',') { row.push(cur); cur = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(cur); cur = ''
      if (row.some((x) => x.trim() !== '')) out.push(row)
      row = []
    } else cur += c
  }
  row.push(cur)
  if (row.some((x) => x.trim() !== '')) out.push(row)
  return out
}

export interface ImportResult {
  machines: Machine[]
  rows: Row[]
  errors: string[]
}

let idCounter = 0
export const newId = () => `${Date.now().toString(36)}${(idCounter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`

/** Đọc CSV -> danh sách máy. Dãy chưa có sẽ được tạo mới. Kiểm tra trùng số/tên trong file. */
export function importMachines(text: string, existingRows: Row[]): ImportResult {
  const table = parseCsv(text)
  const errors: string[] = []
  const rows = [...existingRows]
  const machines: Machine[] = []
  if (table.length === 0) return { machines, rows, errors: ['File CSV trống.'] }

  const start = table[0][0]?.trim().toLowerCase() === CSV_HEADER[0] ? 1 : 0
  const nums = new Set<number>()
  const names = new Set<string>()
  for (let i = start; i < table.length; i++) {
    const [n, name = '', ip = '', day = '', seat = ''] = table[i].map((x) => x.trim())
    const line = i + 1
    const number = Number(n)
    if (!Number.isInteger(number) || number < 1) { errors.push(`Dòng ${line}: số máy "${n}" không hợp lệ.`); continue }
    if (!name) { errors.push(`Dòng ${line}: thiếu tên máy.`); continue }
    if (nums.has(number)) { errors.push(`Dòng ${line}: số máy ${number} bị trùng trong file.`); continue }
    if (names.has(name.toLowerCase())) { errors.push(`Dòng ${line}: tên "${name}" bị trùng trong file.`); continue }
    nums.add(number); names.add(name.toLowerCase())

    let rowId: string | null = null
    if (day) {
      let r = rows.find((x) => x.name.toLowerCase() === day.toLowerCase())
      if (!r) { r = { id: newId(), name: day }; rows.push(r) }
      rowId = r.id
    }
    const seatNum = seat === '' ? null : Number(seat)
    machines.push({
      id: newId(), number, name, ip, rowId,
      seat: seatNum !== null && Number.isInteger(seatNum) ? seatNum : null,
      enrolled: false,
    })
  }
  return { machines, rows, errors }
}

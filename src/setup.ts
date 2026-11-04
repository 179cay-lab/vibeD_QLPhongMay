import { newId } from './csv'
import type { Machine, Row } from './types'

export interface RoomSpec {
  rows: number
  perRow: number
  prefix: string
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Sinh sẵn các dãy và máy theo số lượng nhập vào (máy đánh số liên tục qua các dãy). */
export function generateRoom(spec: RoomSpec): { rows: Row[]; machines: Machine[] } {
  const rows: Row[] = []
  const machines: Machine[] = []
  let n = 0
  for (let r = 1; r <= spec.rows; r++) {
    const row = { id: newId(), name: `Dãy ${r}` }
    rows.push(row)
    for (let s = 1; s <= spec.perRow; s++) {
      n++
      machines.push({ id: newId(), number: n, name: `${spec.prefix}${pad(n)}`, ip: '', rowId: row.id, seat: s, enrolled: false })
    }
  }
  return { rows, machines }
}

export function validateSpec(s: RoomSpec): string | null {
  if (!Number.isInteger(s.rows) || s.rows < 1 || s.rows > 20) return 'Số dãy phải từ 1 đến 20.'
  if (!Number.isInteger(s.perRow) || s.perRow < 1 || s.perRow > 30) return 'Số máy mỗi dãy phải từ 1 đến 30.'
  if (!s.prefix.trim()) return 'Tiền tố tên máy không được để trống.'
  return null
}

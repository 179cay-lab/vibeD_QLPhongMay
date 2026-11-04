import { newId } from './csv'
import { isValidIp } from './rules'
import type { Machine } from './types'

export interface EnrollPlan {
  error?: string
  /** Các xung đột cần người dùng xác nhận trước khi áp dụng */
  conflicts: string[]
  next: Machine[]
  created: boolean
  summary: string
}

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * Máy số `number` báo danh từ địa chỉ `ip` => ghi nhận IP đó là máy số `number`.
 * Chưa thay đổi gì; chỉ trả về kế hoạch để giao diện xác nhận rồi mới áp dụng.
 */
export function planEnroll(machines: Machine[], number: number, ip: string): EnrollPlan {
  const base: EnrollPlan = { conflicts: [], next: machines, created: false, summary: '' }
  ip = ip.trim()
  if (!Number.isInteger(number) || number < 1) return { ...base, error: 'Số máy không hợp lệ.' }
  if (!isValidIp(ip)) return { ...base, error: `IP "${ip}" không hợp lệ.` }

  const conflicts: string[] = []
  let created = false
  let target = machines.find((m) => m.number === number)
  if (!target) {
    let name = `PC-${pad(number)}`
    let k = 2
    while (machines.some((m) => m.name.toLowerCase() === name.toLowerCase())) name = `PC-${pad(number)}-${k++}`
    target = { id: newId(), number, name, ip: '', rowId: null, seat: null, enrolled: false }
    created = true
  } else if (target.enrolled && target.ip && target.ip !== ip) {
    conflicts.push(`Máy ${number} đã đăng ký với IP ${target.ip}. Ghi đè bằng IP ${ip}?`)
  }

  const holder = machines.find((m) => m.id !== target!.id && m.ip.trim() === ip)
  if (holder) {
    conflicts.push(
      `IP ${ip} đang thuộc máy ${holder.number} (${holder.name}). Chuyển sang máy ${number} và bỏ đăng ký máy ${holder.number}?`,
    )
  }

  const updated: Machine = { ...target, ip, enrolled: true }
  const next = machines
    .map((m) => (holder && m.id === holder.id ? { ...m, ip: '', enrolled: false } : m))
    .filter((m) => m.id !== updated.id)
  next.push(updated)
  next.sort((a, b) => a.number - b.number)
  return { conflicts, next, created, summary: `Máy ${number} = ${ip}${created ? ' (tạo mới)' : ''}` }
}

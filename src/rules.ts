import type { Machine } from './types'

export interface Validation {
  /** Lỗi chặn lưu */
  errors: string[]
  /** Cảnh báo, người dùng có thể chọn vẫn lưu */
  warnings: string[]
}

const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/

export function isValidIp(ip: string): boolean {
  return IPV4.test(ip)
}

/**
 * Chính sách trùng:
 *  - Số máy trùng, tên máy trùng (không phân biệt hoa thường): CHẶN.
 *  - IP trùng với máy khác: CẢNH BÁO (có thể đang đổi IP tạm).
 */
export function validateMachine(candidate: Machine, others: Machine[]): Validation {
  const errors: string[] = []
  const warnings: string[] = []
  const rest = others.filter((m) => m.id !== candidate.id)

  if (!Number.isInteger(candidate.number) || candidate.number < 1) {
    errors.push('Số máy phải là số nguyên từ 1 trở lên.')
  } else if (rest.some((m) => m.number === candidate.number)) {
    errors.push(`Số máy ${candidate.number} đã tồn tại.`)
  }

  const name = candidate.name.trim()
  if (!name) errors.push('Tên máy không được để trống.')
  else if (rest.some((m) => m.name.trim().toLowerCase() === name.toLowerCase())) {
    errors.push(`Tên máy "${name}" đã tồn tại.`)
  }

  const ip = candidate.ip.trim()
  if (ip) {
    if (!isValidIp(ip)) errors.push(`Địa chỉ IP "${ip}" không hợp lệ.`)
    else {
      const dup = rest.find((m) => m.ip.trim() === ip)
      if (dup) warnings.push(`IP ${ip} đang được gán cho máy ${dup.number} (${dup.name}).`)
    }
  }
  return { errors, warnings }
}

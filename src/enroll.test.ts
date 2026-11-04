import { describe, expect, it } from 'vitest'
import { planEnroll } from './enroll'
import { importMachines, machinesToCsv, parseCsv } from './csv'
import { validateMachine } from './rules'
import type { Machine } from './types'

const m = (number: number, ip = '', enrolled = false): Machine => ({
  id: `id${number}`, number, name: `PC-${number}`, ip, rowId: null, seat: null, enrolled,
})

describe('planEnroll', () => {
  it('gán IP cho máy có sẵn', () => {
    const p = planEnroll([m(1), m(2)], 2, '192.168.1.12')
    expect(p.conflicts).toEqual([])
    expect(p.next.find((x) => x.number === 2)).toMatchObject({ ip: '192.168.1.12', enrolled: true })
  })
  it('tạo máy mới nếu chưa có', () => {
    const p = planEnroll([], 5, '10.0.0.5')
    expect(p.created).toBe(true)
    expect(p.next[0]).toMatchObject({ number: 5, name: 'PC-05' })
  })
  it('báo xung đột khi máy đã đăng ký IP khác', () => {
    expect(planEnroll([m(1, '10.0.0.1', true)], 1, '10.0.0.9').conflicts).toHaveLength(1)
  })
  it('báo xung đột khi IP thuộc máy khác và bỏ đăng ký máy đó', () => {
    const p = planEnroll([m(1, '10.0.0.1', true), m(2)], 2, '10.0.0.1')
    expect(p.conflicts).toHaveLength(1)
    expect(p.next.find((x) => x.number === 1)).toMatchObject({ ip: '', enrolled: false })
  })
  it('từ chối IP sai', () => {
    expect(planEnroll([], 1, '999.1.1.1').error).toBeTruthy()
  })
})

describe('validateMachine', () => {
  it('chặn trùng số và tên (không phân biệt hoa thường), cảnh báo trùng IP', () => {
    const others = [{ ...m(1, '10.0.0.1'), name: 'Pc-A' }]
    const v = validateMachine({ ...m(1, '10.0.0.1'), id: 'new', name: 'pc-a' }, others)
    expect(v.errors).toHaveLength(2)
    expect(v.warnings).toHaveLength(1)
  })
  it('cho phép sửa chính máy đó', () => {
    const a = m(1, '10.0.0.1')
    expect(validateMachine(a, [a])).toEqual({ errors: [], warnings: [] })
  })
})

describe('csv', () => {
  it('xuất rồi nhập lại giữ nguyên dữ liệu, kể cả dấu phẩy và ngoặc kép', () => {
    const rows = [{ id: 'r', name: 'Dãy 1, "A"' }]
    const ms: Machine[] = [{ ...m(1, '10.0.0.1'), name: 'Máy "1", chính', rowId: 'r', seat: 3 }]
    const back = importMachines(machinesToCsv(ms, rows), [])
    expect(back.errors).toEqual([])
    expect(back.machines[0]).toMatchObject({ number: 1, name: 'Máy "1", chính', ip: '10.0.0.1', seat: 3 })
    expect(back.rows[0].name).toBe('Dãy 1, "A"')
  })
  it('báo lỗi dòng sai và trùng', () => {
    const r = importMachines('so_may,ten_may\n1,A\n1,B\nx,C\n2,\n', [])
    expect(r.machines).toHaveLength(1)
    expect(r.errors).toHaveLength(3)
  })
  it('parse CRLF', () => {
    expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([['a', 'b'], ['1', '2']])
  })
})

import { expect, it } from 'vitest'
import { generateRoom, validateSpec } from './setup'

it('sinh 4 dãy x 10 máy, đánh số liên tục', () => {
  const { rows, machines } = generateRoom({ rows: 4, perRow: 10, prefix: 'PC-' })
  expect(rows).toHaveLength(4)
  expect(machines).toHaveLength(40)
  expect(machines[39]).toMatchObject({ number: 40, name: 'PC-40', seat: 10, rowId: rows[3].id })
  expect(new Set(machines.map((m) => m.name)).size).toBe(40)
})
it('kiểm tra đầu vào', () => {
  expect(validateSpec({ rows: 0, perRow: 5, prefix: 'PC-' })).toBeTruthy()
  expect(validateSpec({ rows: 2, perRow: 5, prefix: ' ' })).toBeTruthy()
  expect(validateSpec({ rows: 2, perRow: 5, prefix: 'PC-' })).toBeNull()
})

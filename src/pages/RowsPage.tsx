import { useState } from 'react'
import { newId } from '../csv'
import { useStore } from '../store'

export default function RowsPage() {
  const { rows, machines, commit } = useStore()
  const [name, setName] = useState('')

  const add = () => {
    const n = name.trim()
    if (!n) return
    if (rows.some((r) => r.name.toLowerCase() === n.toLowerCase())) return alert(`Dãy "${n}" đã tồn tại.`)
    commit([...rows, { id: newId(), name: n }], machines, { action: 'Thêm dãy', detail: n })
    setName('')
  }
  const remove = (id: string) => {
    const r = rows.find((x) => x.id === id)!
    const count = machines.filter((m) => m.rowId === id).length
    if (!confirm(`Xoá "${r.name}"?${count ? ` ${count} máy trong dãy sẽ chuyển thành chưa xếp dãy.` : ''}`)) return
    commit(
      rows.filter((x) => x.id !== id),
      machines.map((m) => (m.rowId === id ? { ...m, rowId: null, seat: null } : m)),
      { action: 'Xoá dãy', detail: r.name },
    )
  }
  const rename = (id: string) => {
    const r = rows.find((x) => x.id === id)!
    const n = prompt('Tên dãy mới:', r.name)?.trim()
    if (!n || n === r.name) return
    if (rows.some((x) => x.id !== id && x.name.toLowerCase() === n.toLowerCase())) return alert(`Dãy "${n}" đã tồn tại.`)
    commit(rows.map((x) => (x.id === id ? { ...x, name: n } : x)), machines, { action: 'Đổi tên dãy', detail: `${r.name} → ${n}` })
  }

  return (
    <section>
      <h2>Dãy máy</h2>
      <div className="toolbar">
        <input value={name} placeholder="Tên dãy, ví dụ: Dãy 1" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <button className="primary" onClick={add}>Thêm dãy</button>
      </div>
      <table>
        <thead><tr><th>Tên dãy</th><th>Số máy</th><th /></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.name}</td>
              <td>{machines.filter((m) => m.rowId === r.id).length}</td>
              <td className="actions"><button onClick={() => rename(r.id)}>Đổi tên</button><button className="danger" onClick={() => remove(r.id)}>Xoá</button></td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={3} className="empty">Chưa có dãy nào.</td></tr>}
        </tbody>
      </table>
    </section>
  )
}

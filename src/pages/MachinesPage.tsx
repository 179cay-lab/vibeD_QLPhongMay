import { useRef, useState } from 'react'
import { importMachines, machinesToCsv, newId } from '../csv'
import { validateMachine } from '../rules'
import { useStore } from '../store'
import type { Machine } from '../types'

const blank = (machines: Machine[]): Machine => ({
  id: newId(),
  number: Math.max(0, ...machines.map((m) => m.number)) + 1,
  name: '',
  ip: '',
  rowId: null,
  seat: null,
  enrolled: false,
})

export default function MachinesPage() {
  const { rows, machines, commit } = useStore()
  const [editing, setEditing] = useState<Machine | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [msgs, setMsgs] = useState<string[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const rowName = (id: string | null) => rows.find((r) => r.id === id)?.name ?? '—'

  const openNew = () => { const m = blank(machines); m.name = `PC-${String(m.number).padStart(2, '0')}`; setEditing(m); setIsNew(true); setMsgs([]) }
  const openEdit = (m: Machine) => { setEditing({ ...m }); setIsNew(false); setMsgs([]) }

  const save = async () => {
    if (!editing) return
    const cand = { ...editing, name: editing.name.trim(), ip: editing.ip.trim() }
    const v = validateMachine(cand, machines)
    if (v.errors.length) return setMsgs(v.errors)
    if (v.warnings.length && !confirm(`${v.warnings.join('\n')}\n\nVẫn lưu?`)) return
    const next = isNew ? [...machines, cand] : machines.map((m) => (m.id === cand.id ? cand : m))
    next.sort((a, b) => a.number - b.number)
    await commit(rows, next, { action: isNew ? 'Thêm máy' : 'Sửa máy', detail: `${cand.number} ${cand.name} ${cand.ip}`.trim() })
    setEditing(null)
  }

  const remove = (m: Machine) => {
    if (confirm(`Xoá máy ${m.number} (${m.name})?`))
      commit(rows, machines.filter((x) => x.id !== m.id), { action: 'Xoá máy', detail: `${m.number} ${m.name}` })
  }

  const seed = () => {
    if (machines.length && !confirm('Thay toàn bộ danh sách hiện tại bằng 40 máy mẫu?')) return
    const rs = [1, 2, 3, 4].map((i) => ({ id: newId(), name: `Dãy ${i}` }))
    const ms: Machine[] = Array.from({ length: 40 }, (_, i) => ({
      id: newId(), number: i + 1, name: `PC-${String(i + 1).padStart(2, '0')}`, ip: '',
      rowId: rs[Math.floor(i / 10)].id, seat: (i % 10) + 1, enrolled: false,
    }))
    commit(rs, ms, { action: 'Tạo dữ liệu mẫu', detail: '4 dãy, 40 máy' })
  }

  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob([machinesToCsv(machines, rows)], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url; a.download = 'may-tinh.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const onImport = async (file: File) => {
    const res = importMachines(await file.text(), rows)
    if (res.errors.length) { setMsgs(res.errors); alert(`Không nhập được, có ${res.errors.length} lỗi (xem phía trên bảng).`); return }
    if (machines.length && !confirm(`Thay ${machines.length} máy hiện tại bằng ${res.machines.length} máy trong file?`)) return
    setMsgs([])
    await commit(res.rows, res.machines, { action: 'Nhập CSV', detail: `${res.machines.length} máy từ ${file.name}` })
  }

  return (
    <section>
      <h2>Máy tính <small>({machines.length})</small></h2>
      <div className="toolbar">
        <button className="primary" onClick={openNew}>Thêm máy</button>
        <button onClick={seed}>Tạo 40 máy mẫu</button>
        <button onClick={() => fileRef.current?.click()}>Nhập CSV</button>
        <button onClick={exportCsv} disabled={!machines.length}>Xuất CSV</button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = '' }} />
      </div>
      {!editing && msgs.length > 0 && <div className="banner error">{msgs.map((m) => <div key={m}>{m}</div>)}</div>}
      <table>
        <thead><tr><th>Số máy</th><th>Tên</th><th>IP LAN</th><th>Dãy</th><th>Vị trí</th><th>Trạng thái</th><th /></tr></thead>
        <tbody>
          {machines.map((m) => (
            <tr key={m.id}>
              <td>{m.number}</td><td>{m.name}</td><td>{m.ip || '—'}</td><td>{rowName(m.rowId)}</td><td>{m.seat ?? '—'}</td>
              <td><span className={`badge ${m.enrolled ? 'ok' : 'idle'}`}>{m.enrolled ? 'Đã đăng ký' : 'Chưa đăng ký'}</span></td>
              <td className="actions"><button onClick={() => openEdit(m)}>Sửa</button><button className="danger" onClick={() => remove(m)}>Xoá</button></td>
            </tr>
          ))}
          {machines.length === 0 && <tr><td colSpan={7} className="empty">Chưa có máy nào. Bấm "Thêm máy" hoặc "Tạo 40 máy mẫu".</td></tr>}
        </tbody>
      </table>

      {editing && (
        <div className="modal-bg" onClick={() => setEditing(null)}>
          <div className="modal" role="dialog" onClick={(e) => e.stopPropagation()}>
            <h3>{isNew ? 'Thêm máy' : 'Sửa máy'}</h3>
            {msgs.length > 0 && <div className="banner error">{msgs.map((m) => <div key={m}>{m}</div>)}</div>}
            <label>Số máy<input type="number" min={1} value={editing.number} onChange={(e) => setEditing({ ...editing, number: Number(e.target.value) })} /></label>
            <label>Tên máy<input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></label>
            <label>IP LAN<input value={editing.ip} placeholder="192.168.1.101" onChange={(e) => setEditing({ ...editing, ip: e.target.value })} /></label>
            <label>Dãy
              <select value={editing.rowId ?? ''} onChange={(e) => setEditing({ ...editing, rowId: e.target.value || null })}>
                <option value="">— chưa xếp —</option>
                {rows.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </label>
            <label>Vị trí trong dãy<input type="number" min={1} value={editing.seat ?? ''} onChange={(e) => setEditing({ ...editing, seat: e.target.value === '' ? null : Number(e.target.value) })} /></label>
            <div className="modal-actions"><button onClick={() => setEditing(null)}>Huỷ</button><button className="primary" onClick={save}>Lưu</button></div>
          </div>
        </div>
      )}
    </section>
  )
}

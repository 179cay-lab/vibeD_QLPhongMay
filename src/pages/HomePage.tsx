import { useState } from 'react'
import { generateRoom, validateSpec } from '../setup'
import { useStore } from '../store'

interface Props { go: (tab: string) => void }

export default function HomePage({ go }: Props) {
  const { rows, machines, commit } = useStore()
  const [spec, setSpec] = useState({ rows: 4, perRow: 10, prefix: 'PC-' })
  const [err, setErr] = useState('')

  const total = machines.length
  const enrolled = machines.filter((m) => m.enrolled).length
  const hasRoom = total > 0

  const create = async () => {
    const e = validateSpec(spec)
    if (e) return setErr(e)
    if (hasRoom && !confirm(`Thay ${total} máy hiện tại bằng ${spec.rows * spec.perRow} máy mới?`)) return
    setErr('')
    const g = generateRoom(spec)
    await commit(g.rows, g.machines, { action: 'Thiết lập phòng máy', detail: `${spec.rows} dãy x ${spec.perRow} máy` })
  }

  const steps = [
    { done: hasRoom, title: '1. Dựng phòng máy', text: 'Nhập số dãy và số máy mỗi dãy, app tự tạo danh sách.' },
    { done: hasRoom && enrolled === total, title: '2. Đăng ký số máy', text: `Mỗi máy báo "tôi là máy số N" để app biết IP nào là máy nào (${enrolled}/${total}).`, go: 'enroll', cta: 'Mở đăng ký' },
    { done: false, title: '3. Điều khiển máy (sắp có)', text: 'Bật/tắt, khoá màn hình, gửi thông báo tới cả phòng — cần agent ở Phase 2.' },
  ]

  return (
    <section>
      <h2>Tổng quan</h2>
      <div className="stats">
        <div className="stat"><b>{rows.length}</b><span>Dãy</span></div>
        <div className="stat"><b>{total}</b><span>Máy</span></div>
        <div className="stat ok"><b>{enrolled}</b><span>Đã đăng ký IP</span></div>
        <div className="stat warn"><b>{total - enrolled}</b><span>Chưa đăng ký</span></div>
      </div>

      <div className="steps">
        {steps.map((s) => (
          <div key={s.title} className={`step ${s.done ? 'done' : ''}`}>
            <h3>{s.done ? '✓ ' : ''}{s.title}</h3>
            <p>{s.text}</p>
            {s.go && hasRoom && <button onClick={() => go(s.go!)}>{s.cta}</button>}
          </div>
        ))}
      </div>

      <div className="panel">
        <h3>{hasRoom ? 'Dựng lại phòng máy' : 'Bước 1: dựng phòng máy'}</h3>
        <div className="toolbar">
          <label className="inline">Số dãy<input type="number" min={1} max={20} value={spec.rows} onChange={(e) => setSpec({ ...spec, rows: Number(e.target.value) })} /></label>
          <label className="inline">Máy mỗi dãy<input type="number" min={1} max={30} value={spec.perRow} onChange={(e) => setSpec({ ...spec, perRow: Number(e.target.value) })} /></label>
          <label className="inline">Tiền tố tên<input value={spec.prefix} onChange={(e) => setSpec({ ...spec, prefix: e.target.value })} /></label>
          <button className="primary" onClick={create}>Tạo {spec.rows * spec.perRow || 0} máy</button>
        </div>
        {err && <div className="banner error">{err}</div>}
      </div>

      {hasRoom && (
        <div className="panel">
          <h3>Sơ đồ phòng máy</h3>
          <p className="legend"><i className="dot ok" /> Đã đăng ký IP <i className="dot" /> Chưa đăng ký</p>
          {rows.map((r) => (
            <div key={r.id} className="maprow">
              <span className="maplabel">{r.name}</span>
              {machines.filter((m) => m.rowId === r.id).sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0)).map((m) => (
                <div key={m.id} className={`seat ${m.enrolled ? 'ok' : ''}`} title={`${m.name} — ${m.ip || 'chưa có IP'}`}>{m.number}</div>
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

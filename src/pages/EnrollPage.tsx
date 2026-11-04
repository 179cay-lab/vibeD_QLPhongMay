import { useState } from 'react'
import { planEnroll } from '../enroll'
import { useMonitor } from '../monitor'
import { useStore } from '../store'
import type { Machine } from '../types'

export default function EnrollPage() {
  const { rows, machines, commit } = useStore()
  const mon = useMonitor()
  const [localActive, setActive] = useState(false)
  const active = mon.connected ? mon.enrollOn : localActive
  const [num, setNum] = useState('')
  const [ip, setIp] = useState('')
  const [err, setErr] = useState('')

  const done = machines.filter((m) => m.enrolled).length
  const pct = machines.length ? Math.round((done / machines.length) * 100) : 0

  const toggle = async () => {
    const next = !active
    if (next && machines.length && !confirm('Bắt đầu đăng ký? Máy nào bấm sau sẽ ghi đè IP đã đăng ký (sau khi bạn xác nhận).')) return
    setActive(next)
    mon.setEnrollMode(next)
    if (next) {
      // Bắt các máy đã có agent mà chưa đăng ký tự mở trang "Bạn là máy số mấy?"
      const done = new Set(machines.filter((m) => m.enrolled).map((m) => m.ip))
      mon.command(Object.keys(mon.agents).filter((ip) => !done.has(ip)), 'open_enroll')
    }
    await commit(rows, machines, { action: next ? 'Bắt đầu đăng ký số máy' : 'Kết thúc đăng ký số máy', detail: `${done}/${machines.length} máy đã đăng ký` })
  }

  /** Giả lập: máy `n` ở IP `addr` bấm nút "Tôi là máy số N". Thật sự (Phase 2) sẽ do agent gửi tới server. */
  const simulate = async (n: number, addr: string) => {
    const plan = planEnroll(machines, n, addr)
    if (plan.error) return setErr(plan.error)
    if (plan.conflicts.length && !confirm(plan.conflicts.join('\n\n'))) return
    setErr('')
    await commit(rows, plan.next, { action: 'Đăng ký số máy', detail: plan.summary })
  }

  const resetAll = () => {
    if (!confirm('Xoá trạng thái đăng ký và IP của tất cả máy?')) return
    commit(rows, machines.map((m) => ({ ...m, ip: '', enrolled: false })), { action: 'Đặt lại đăng ký', detail: `${machines.length} máy` })
  }

  const simulateAll = async () => {
    // mỗi máy có IP 192.168.1.(100+số máy), bỏ qua xung đột: dùng để xem trước giao diện khi đủ máy
    const next = machines.map((m) => ({ ...m, ip: `192.168.1.${100 + m.number}`, enrolled: true }))
    await commit(rows, next, { action: 'Mô phỏng đăng ký tất cả', detail: `${next.length} máy` })
  }

  const groups: { title: string; list: Machine[] }[] = [
    ...rows.map((r) => ({ title: r.name, list: machines.filter((m) => m.rowId === r.id) })),
    { title: 'Chưa xếp dãy', list: machines.filter((m) => !m.rowId || !rows.some((r) => r.id === m.rowId)) },
  ].filter((g) => g.list.length)

  return (
    <section>
      <h2>Đăng ký số máy</h2>
      <p className="hint">
        Mỗi máy học sinh hiện màn hình "Bạn là máy số mấy?" và bấm nút. Máy chủ ghi lại IP LAN gửi tới và gán IP đó cho đúng số máy,
        nên cắm dây lộn xộn cũng không ảnh hưởng. Máy đã cài agent sẽ tự mở trang này khi bạn bấm "Bắt đầu đăng ký".
      </p>
      {mon.connected && mon.info?.lan_ip && (
        <p className="hint">Máy chưa có agent: mở trình duyệt vào <code>http://{mon.info.lan_ip}:{mon.info.port}/enroll</code></p>
      )}
      <div className="toolbar">
        <button className={active ? 'danger' : 'primary'} onClick={toggle}>{active ? 'Kết thúc đăng ký' : 'Bắt đầu đăng ký'}</button>
        <button onClick={resetAll} disabled={!done}>Đặt lại</button>
        <span className={`badge ${active ? 'ok' : 'idle'}`}>{active ? 'Đang lắng nghe' : 'Chưa bắt đầu'}</span>
      </div>

      <div className="progress" aria-label="Tiến độ"><div style={{ width: `${pct}%` }} /></div>
      <p><b>{done}/{machines.length}</b> máy đã đăng ký ({pct}%)</p>

      <div className="panel">
        <h3>Giả lập máy học sinh bấm nút (thử không cần máy thật)</h3>
        <div className="toolbar">
          <input type="number" min={1} placeholder="Số máy" value={num} onChange={(e) => setNum(e.target.value)} disabled={!active} />
          <input placeholder="IP LAN, ví dụ 192.168.1.105" value={ip} onChange={(e) => setIp(e.target.value)} disabled={!active} />
          <button className="primary" disabled={!active} onClick={() => simulate(Number(num), ip)}>Mô phỏng "Tôi là máy số N"</button>
          <button disabled={!active || !machines.length} onClick={simulateAll}>Mô phỏng tất cả máy</button>
        </div>
        {err && <div className="banner error">{err}</div>}
      </div>

      {groups.map((g) => (
        <div key={g.title} className="group">
          <h3>{g.title}</h3>
          <div className="tiles">
            {g.list.map((m) => (
              <div key={m.id} className={`tile ${m.enrolled ? 'ok' : ''}`} title={m.ip || 'Chưa có IP'}>
                <b>{m.number}</b>
                <small>{m.ip || 'chưa đăng ký'}</small>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}

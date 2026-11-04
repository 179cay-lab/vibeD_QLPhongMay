import { useState } from 'react'
import { useMonitor } from '../monitor'
import { useStore } from '../store'

interface Tile { key: string; ip: string; label: string; sub: string; known: boolean }

export default function MonitorPage() {
  const { machines } = useStore()
  const { connected, info, agents, frames, command } = useMonitor()
  const [size, setSize] = useState(220)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [zoom, setZoom] = useState<string | null>(null)

  const byIp = new Map(machines.filter((m) => m.ip).map((m) => [m.ip, m]))
  const tiles: Tile[] = machines.map((m) => ({
    key: m.id, ip: m.ip, known: true,
    label: `Máy ${String(m.number).padStart(2, '0')}`,
    sub: m.ip ? m.name : `${m.name} · chưa có IP`,
  }))
  for (const a of Object.values(agents)) {
    if (!byIp.has(a.ip)) tiles.push({ key: `ip-${a.ip}`, ip: a.ip, known: false, label: a.hostname, sub: `${a.ip} · chưa đăng ký` })
  }

  const online = (t: Tile) => !!t.ip && !!agents[t.ip]
  const onlineIps = tiles.filter(online).map((t) => t.ip)
  const targets = selected.size ? onlineIps.filter((ip) => selected.has(ip)) : onlineIps
  const scope = selected.size ? `${targets.length} máy đã chọn` : `tất cả ${targets.length} máy đang bật`

  const toggle = (t: Tile) => {
    if (!online(t)) return
    const n = new Set(selected)
    n.has(t.ip) ? n.delete(t.ip) : n.add(t.ip)
    setSelected(n)
  }
  const run = (cmd: 'shutdown' | 'restart', verb: string) => {
    if (!targets.length) return
    if (confirm(`${verb} ${scope}? Máy sẽ thực hiện sau 10 giây.`)) command(targets, cmd)
  }

  return (
    <section>
      <h2>Giám sát màn hình</h2>
      <div className="toolbar monitorbar">
        <span className={`badge ${connected ? 'ok' : 'idle'}`}>{connected ? `${onlineIps.length} máy trực tuyến` : 'Máy chủ chưa chạy'}</span>
        <button onClick={() => setSelected(new Set(onlineIps))} disabled={!onlineIps.length}>Chọn tất cả</button>
        <button onClick={() => setSelected(new Set())} disabled={!selected.size}>Bỏ chọn</button>
        <span className="sep" />
        <button className="danger" onClick={() => run('shutdown', 'Tắt')} disabled={!targets.length}>Tắt máy</button>
        <button onClick={() => run('restart', 'Khởi động lại')} disabled={!targets.length}>Khởi động lại</button>
        <span className="sep" />
        <label className="inline row">Kích thước<input type="range" min={140} max={420} value={size} onChange={(e) => setSize(Number(e.target.value))} /></label>
      </div>

      {connected && onlineIps.length === 0 && info && (
        <div className="panel">
          <h3>Chưa có máy học sinh nào kết nối</h3>
          <p className="hint">Trên mỗi máy học sinh, chạy <b>qlpm-agent.exe</b> với lệnh dưới đây (sau này sẽ cài tự động chạy cùng Windows):</p>
          <code className="cmd">qlpm-agent.exe --server {info.lan_ip ?? '<IP máy giáo viên>'}:{info.port} --token {info.token}</code>
        </div>
      )}
      {!connected && <div className="banner error">Không kết nối được máy chủ nội bộ (cổng 7878). Nếu đang chạy bằng trình duyệt, hãy chạy: <code>cargo run -p qlpm-core --bin server</code></div>}

      <div className="wall" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${size}px, 1fr))` }}>
        {tiles.map((t) => {
          const on = online(t)
          const src = on ? frames[t.ip] : undefined
          return (
            <figure key={t.key} className={`cam ${selected.has(t.ip) && on ? 'sel' : ''} ${on ? '' : 'off'} ${t.known ? '' : 'stray'}`}
              onClick={() => toggle(t)} onDoubleClick={() => src && setZoom(t.ip)}>
              <div className="screen">{src ? <img src={src} alt={t.label} draggable={false} /> : <span>{on ? 'Đang tải…' : 'Không kết nối'}</span>}</div>
              <figcaption><b>{t.label}</b><small>{t.sub}</small></figcaption>
            </figure>
          )
        })}
        {tiles.length === 0 && <p className="empty">Chưa có máy nào. Vào "Tổng quan" để dựng phòng máy.</p>}
      </div>

      {zoom && frames[zoom] && (
        <div className="modal-bg" onClick={() => setZoom(null)}>
          <img className="zoomimg" src={frames[zoom]} alt="Màn hình phóng to" />
        </div>
      )}
    </section>
  )
}

import { useStore } from '../store'

export default function LogsPage() {
  const { logs, clearLogs } = useStore()
  return (
    <section>
      <h2>Nhật ký</h2>
      <div className="toolbar">
        <button className="danger" disabled={!logs.length} onClick={() => confirm('Xoá toàn bộ nhật ký?') && clearLogs()}>Xoá nhật ký</button>
      </div>
      <table>
        <thead><tr><th>Thời gian</th><th>Thao tác</th><th>Chi tiết</th></tr></thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l.id}>
              <td>{new Date(l.ts).toLocaleString('vi-VN')}</td>
              <td>{l.action}</td>
              <td>{l.detail}</td>
            </tr>
          ))}
          {logs.length === 0 && <tr><td colSpan={3} className="empty">Chưa có nhật ký.</td></tr>}
        </tbody>
      </table>
    </section>
  )
}

import { useState } from 'react'
import { isTauri } from './backend'
import { useStore } from './store'
import HomePage from './pages/HomePage'
import MonitorPage from './pages/MonitorPage'
import EnrollPage from './pages/EnrollPage'
import LogsPage from './pages/LogsPage'
import MachinesPage from './pages/MachinesPage'
import RowsPage from './pages/RowsPage'

const TABS: { id: string; label: string; el: (go: (t: string) => void) => JSX.Element }[] = [
  { id: 'home', label: 'Tổng quan', el: (go) => <HomePage go={go} /> },
  { id: 'monitor', label: 'Giám sát', el: () => <MonitorPage /> },
  { id: 'machines', label: 'Máy tính', el: () => <MachinesPage /> },
  { id: 'rows', label: 'Dãy máy', el: () => <RowsPage /> },
  { id: 'enroll', label: 'Đăng ký số máy', el: () => <EnrollPage /> },
  { id: 'logs', label: 'Nhật ký', el: () => <LogsPage /> },
]

export default function App() {
  const [tab, setTab] = useState('home')
  const { ready, error } = useStore()
  return (
    <div className="app">
      <aside className="sidebar">
        <h1>QLPhongMay</h1>
        <nav>
          {TABS.map((t) => (
            <button key={t.id} className={t.id === tab ? 'active' : ''} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
        <div className="mode">
          <span className="badge demo">DEMO</span>
          <small>{isTauri ? 'Lưu SQLite' : 'Chạy trên trình duyệt (localStorage)'}</small>
        </div>
      </aside>
      <main>
        {error && <div className="banner error">{error}</div>}
        {ready ? TABS.find((t) => t.id === tab)!.el(setTab) : <p>Đang tải…</p>}
      </main>
    </div>
  )
}

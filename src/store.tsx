import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { backend } from './backend'
import { newId } from './csv'
import type { LogEntry, Machine, Row } from './types'

interface Store {
  ready: boolean
  rows: Row[]
  machines: Machine[]
  logs: LogEntry[]
  error: string | null
  /** Thay toàn bộ dãy + máy rồi lưu. */
  commit: (rows: Row[], machines: Machine[], log?: { action: string; detail: string }) => Promise<void>
  log: (action: string, detail: string) => Promise<void>
  clearLogs: () => Promise<void>
}

const Ctx = createContext<Store>(null as unknown as Store)
export const useStore = () => useContext(Ctx)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [rows, setRows] = useState<Row[]>([])
  const [machines, setMachines] = useState<Machine[]>([])
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const logsRef = useRef<LogEntry[]>([])

  useEffect(() => {
    backend
      .load()
      .then((s) => {
        setRows(s.rows); setMachines(s.machines); setLogs(s.logs); logsRef.current = s.logs
      })
      .catch((e) => setError(String(e)))
      .finally(() => setReady(true))
  }, [])

  const log = useCallback(async (action: string, detail: string) => {
    const entry: LogEntry = { id: newId(), ts: new Date().toISOString(), action, detail }
    logsRef.current = [entry, ...logsRef.current].slice(0, 1000)
    setLogs(logsRef.current)
    try { await backend.addLog(entry) } catch (e) { setError(String(e)) }
  }, [])

  const commit = useCallback<Store['commit']>(async (r, m, l) => {
    try {
      await backend.saveSnapshot(r, m)
      setRows(r); setMachines(m); setError(null)
      if (l) await log(l.action, l.detail)
    } catch (e) {
      setError(`Không lưu được: ${String(e)}`)
    }
  }, [log])

  const clearLogs = useCallback(async () => {
    try { await backend.clearLogs(); logsRef.current = []; setLogs([]) } catch (e) { setError(String(e)) }
  }, [])

  return <Ctx.Provider value={{ ready, rows, machines, logs, error, commit, log, clearLogs }}>{children}</Ctx.Provider>
}

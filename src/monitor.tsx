import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { planEnroll } from './enroll'
import { useStore } from './store'

const WS_URL = 'ws://127.0.0.1:7878/ws/ui'

export interface Info { token: string; port: number; lan_ip: string | null }
export interface Agent { ip: string; hostname: string }

interface Monitor {
  connected: boolean
  info: Info | null
  agents: Record<string, Agent>
  frames: Record<string, string>
  enrollOn: boolean
  setEnrollMode: (on: boolean) => void
  command: (ips: string[], cmd: 'shutdown' | 'restart' | 'open_enroll') => void
}

const Ctx = createContext<Monitor>(null as unknown as Monitor)
export const useMonitor = () => useContext(Ctx)

export function MonitorProvider({ children }: { children: ReactNode }) {
  const { rows, machines, commit } = useStore()
  const [connected, setConnected] = useState(false)
  const [info, setInfo] = useState<Info | null>(null)
  const [agents, setAgents] = useState<Record<string, Agent>>({})
  const [frames, setFrames] = useState<Record<string, string>>({})
  const [enrollOn, setEnrollOnState] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const framesRef = useRef<Record<string, string>>({})
  const latest = useRef({ rows, machines, commit })
  latest.current = { rows, machines, commit }
  // Xử lý lần lượt từng yêu cầu đăng ký để không ghi đè lẫn nhau.
  const queue = useRef<Promise<void>>(Promise.resolve())

  const send = useCallback((o: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify(o))
  }, [])

  useEffect(() => {
    let closed = false
    let timer: number | undefined

    const onEnrollRequest = (id: number, number: number, ip: string) => {
      queue.current = queue.current.then(async () => {
        const { rows, machines, commit } = latest.current
        const plan = planEnroll(machines, number, ip)
        if (plan.error) return send({ type: 'enroll_reply', id, ok: false, message: plan.error })
        if (plan.conflicts.length) {
          await commit(rows, machines, { action: 'Đăng ký bị từ chối', detail: `${ip} xin làm máy ${number}: ${plan.conflicts.join(' | ')}` })
          return send({
            type: 'enroll_reply', id, ok: false,
            message: `Số máy ${number} hoặc IP của bạn đã được đăng ký trước đó. Hãy báo giáo viên.`,
          })
        }
        await commit(rows, plan.next, { action: 'Đăng ký số máy', detail: plan.summary })
        latest.current.machines = plan.next // các yêu cầu kế tiếp thấy ngay kết quả
        send({ type: 'enroll_reply', id, ok: true, message: `Đã ghi nhận: bạn là máy số ${number}.` })
      })
    }

    const connect = () => {
      const ws = new WebSocket(WS_URL)
      ws.binaryType = 'arraybuffer'
      wsRef.current = ws
      ws.onopen = () => setConnected(true)
      ws.onclose = () => {
        setConnected(false); setAgents({}); setEnrollOnState(false)
        Object.values(framesRef.current).forEach(URL.revokeObjectURL)
        framesRef.current = {}; setFrames({})
        if (!closed) timer = window.setTimeout(connect, 2000)
      }
      ws.onmessage = (e) => {
        if (typeof e.data !== 'string') {
          const buf = new Uint8Array(e.data as ArrayBuffer)
          const ip = new TextDecoder().decode(buf.subarray(1, 1 + buf[0]))
          const url = URL.createObjectURL(new Blob([buf.subarray(1 + buf[0])], { type: 'image/jpeg' }))
          if (framesRef.current[ip]) URL.revokeObjectURL(framesRef.current[ip])
          framesRef.current = { ...framesRef.current, [ip]: url }
          setFrames(framesRef.current)
          return
        }
        const m = JSON.parse(e.data)
        if (m.type === 'info') setInfo({ token: m.token, port: m.port, lan_ip: m.lan_ip })
        else if (m.type === 'enroll_mode') setEnrollOnState(!!m.on)
        else if (m.type === 'agents') {
          const next: Record<string, Agent> = {}
          for (const a of m.list as Agent[]) next[a.ip] = a
          setAgents(next)
          framesRef.current = Object.fromEntries(Object.entries(framesRef.current).filter(([ip]) => next[ip]))
          setFrames(framesRef.current)
        } else if (m.type === 'enroll_request') onEnrollRequest(m.id, m.number, m.ip)
      }
    }
    connect()
    return () => { closed = true; window.clearTimeout(timer); wsRef.current?.close() }
  }, [send])

  const value: Monitor = {
    connected, info, agents, frames, enrollOn,
    setEnrollMode: (on) => send({ type: 'enroll_mode', on }),
    command: (ips, cmd) => send({ type: 'command', ips, cmd }),
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

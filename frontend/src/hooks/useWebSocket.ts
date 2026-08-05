import { useCallback, useEffect, useRef, useState } from 'react'

export type ReadyState = 'connecting' | 'open' | 'closing' | 'closed'

interface UseWebSocketResult<T> {
  lastMessage: T | null
  readyState: ReadyState
  sendMessage: (msg: string) => void
}

/**
 * Generic WebSocket hook.
 *
 * Automatically reconnects with exponential back-off (1 s → 2 s → 4 s … 30 s max).
 * Connects through Vite WS proxy /ws to ensure same-origin websocket stability.
 */
export function useWebSocket<T>(path: string): UseWebSocketResult<T> {
  const [lastMessage, setLastMessage] = useState<T | null>(null)
  const [readyState, setReadyState] = useState<ReadyState>('connecting')
  const wsRef = useRef<WebSocket | null>(null)
  const retryDelayRef = useRef<number>(1000)

  const connect = useCallback(() => {
    const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = typeof window !== 'undefined' ? window.location.host : '127.0.0.1:5173'
    const defaultWsUrl = `${protocol}//${host}/ws${path.replace(/^\/ws/, '')}`
    const apiUrl = import.meta.env.VITE_API_URL
    const wsUrl = apiUrl ? apiUrl.replace(/^http/, 'ws') + path : defaultWsUrl

    const ws = new WebSocket(wsUrl)
    wsRef.current = ws
    setReadyState('connecting')

    ws.onopen = () => {
      setReadyState('open')
      retryDelayRef.current = 1000  // Reset back-off on successful connect
    }

    ws.onmessage = (event: MessageEvent<string>) => {
      try {
        const parsed = JSON.parse(event.data) as T
        setLastMessage(parsed)
      } catch {
        // Non-JSON message — ignore
      }
    }

    ws.onclose = () => {
      setReadyState('closed')
      const delay = Math.min(retryDelayRef.current, 30_000)
      retryDelayRef.current = delay * 2
      setTimeout(connect, delay)
    }

    ws.onerror = () => {
      setReadyState('closing')
      ws.close()
    }
  }, [path])

  useEffect(() => {
    connect()
    return () => {
      wsRef.current?.close()
    }
  }, [connect])

  const sendMessage = useCallback((msg: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(msg)
    }
  }, [])

  return { lastMessage, readyState, sendMessage }
}

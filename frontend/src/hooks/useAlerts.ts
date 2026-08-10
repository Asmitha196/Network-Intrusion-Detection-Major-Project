import { useEffect, useState } from 'react'
import type { Alert, WebSocketMessage } from '../types'
import { useWebSocket } from './useWebSocket'
import apiClient from '../api/client'

const MAX_ALERTS = 200

export function useAlerts() {
  const { lastMessage, readyState } = useWebSocket<WebSocketMessage>('/ws/alerts')
  const [alerts, setAlerts] = useState<Alert[]>([])

  // 1. On mount: seed recent alerts from GET /alerts
  useEffect(() => {
    async function fetchInitialAlerts() {
      try {
        const res = await apiClient.get('/alerts?page=1&page_size=50')
        if (res.data && res.data.items) {
          setAlerts(res.data.items)
        }
      } catch (e) {
        console.warn('Failed to fetch initial alerts snapshot:', e)
      }
    }
    fetchInitialAlerts()
  }, [])

  // 2. On WebSocket message: prepend new incoming alert object
  useEffect(() => {
    if (!lastMessage) return

    // Handshake snapshot catchup
    if (
      typeof lastMessage === 'object' &&
      'type' in lastMessage &&
      lastMessage.type === 'connected' &&
      'recent_alerts' in lastMessage &&
      Array.isArray(lastMessage.recent_alerts)
    ) {
      const snapshot = lastMessage.recent_alerts as Alert[]
      if (snapshot.length > 0) {
        setAlerts((prev) => {
          const map = new Map<string, Alert>()
          snapshot.forEach((a) => map.set(a.id, a))
          prev.forEach((a) => map.set(a.id, a))
          return Array.from(map.values()).slice(0, MAX_ALERTS)
        })
      }
      return
    }

    // Direct alert object
    if (typeof lastMessage === 'object' && 'id' in lastMessage && 'stage' in lastMessage) {
      const newAlert = lastMessage as Alert
      setAlerts((prev) => {
        const exists = prev.some((a) => a.id === newAlert.id)
        if (exists) return prev
        const newList = [newAlert, ...prev]
        return newList.slice(0, MAX_ALERTS)
      })
    }
  }, [lastMessage])

  return { alerts, readyState, lastMessage }
}

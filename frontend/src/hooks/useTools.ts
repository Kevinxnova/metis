import { useState, useEffect, useCallback } from 'react'
import { api, Tool } from '../api/client'

export function useTools(statusFilter?: string) {
  const [tools, setTools] = useState<Tool[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getTools(statusFilter)
      setTools(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tools')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    refresh()
  }, [refresh])

  const updateTool = async (id: number, action: string, takeText?: string) => {
    await api.updateTool(id, action, takeText)
    await refresh()
  }

  return { tools, loading, error, refresh, updateTool }
}

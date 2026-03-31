import { useState, useEffect, useCallback } from 'react'
import { api, Tool } from '../api/client'

export interface ToolFilters {
  status?: string
  content_type?: string
  domain?: string
}

export function useTools(filters: ToolFilters) {
  const [tools, setTools] = useState<Tool[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const filterKey = JSON.stringify(filters)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getTools(filters)
      setTools(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tools')
    } finally {
      setLoading(false)
    }
  }, [filterKey])

  useEffect(() => {
    refresh()
  }, [refresh])

  const updateTool = async (id: number, action: string, takeText?: string) => {
    await api.updateTool(id, action, takeText)
    await refresh()
  }

  return { tools, loading, error, refresh, updateTool }
}

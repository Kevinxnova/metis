const API_BASE = '/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const resp = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!resp.ok) {
    const error = await resp.json().catch(() => ({ detail: resp.statusText }))
    throw new Error(error.detail || resp.statusText)
  }
  return resp.json()
}

export interface Tool {
  id: number
  url: string
  title: string
  description: string
  source: string
  source_url: string
  metrics: string
  first_seen: string
  status: string
  sources: string
  take?: string
}

export interface Issue {
  id: number
  issue_number: number
  title: string
  status: string
  tool_ids: string
  sent_at: string | null
  tools?: Tool[]
}

export interface ScrapeRun {
  source: string
  status: string
  tools_found: number
  tools_new: number
  error_message: string | null
  ran_at: string
}

export const api = {
  // Tools
  getTools: (status?: string) =>
    request<Tool[]>(`/tools${status ? `?status=${status}` : ''}`),

  updateTool: (id: number, action: string, takeText?: string) =>
    request<{ ok: boolean }>(`/tools/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: action, take_text: takeText }),
    }),

  mergeTool: (id: number, mergeIntoId: number) =>
    request<{ ok: boolean }>(`/tools/${id}/merge`, {
      method: 'POST',
      body: JSON.stringify({ merge_into_id: mergeIntoId }),
    }),

  // Issues
  getIssues: () => request<Issue[]>('/issues'),
  getIssue: (num: number) => request<Issue & { tools: Tool[] }>(`/issues/${num}`),
  createIssue: (title?: string) =>
    request<{ ok: boolean; issue_number: number }>('/issues', {
      method: 'POST',
      body: JSON.stringify({ title }),
    }),

  // Send
  sendIssue: (num: number) =>
    request<{ ok: boolean }>(`/send/${num}`, { method: 'POST' }),

  // Health
  getScrapeStatus: () =>
    request<{ scrapes: ScrapeRun[] }>('/health/scrapes'),
}

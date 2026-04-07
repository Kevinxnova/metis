const API_BASE = (import.meta.env.VITE_API_URL || '') + '/api'

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
  title_zh: string | null
  description_zh: string | null
  content_type: string
  domain: string
  source: string
  source_url: string
  metrics: string
  first_seen: string
  status: string
  sources: string
  take?: string
  take_en?: string
  discovery_category?: 'news' | 'ai_tool' | 'other' | null
  short_summary?: string | null
  short_summary_zh?: string | null
}

export interface CategoryCounts {
  by_type: Record<string, number>
  by_domain: Record<string, number>
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
  getTools: (filters?: { status?: string; content_type?: string; domain?: string }) => {
    const params = new URLSearchParams()
    if (filters?.status) params.set('status', filters.status)
    if (filters?.content_type) params.set('content_type', filters.content_type)
    if (filters?.domain) params.set('domain', filters.domain)
    const qs = params.toString()
    return request<Tool[]>(`/tools${qs ? `?${qs}` : ''}`)
  },

  getCategories: () => request<CategoryCounts>('/tools/categories'),

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

  // Translate
  translateBatch: (limit = 20) =>
    request<{ translated: number; remaining: number }>(`/translate/batch?limit=${limit}`, {
      method: 'POST',
    }),

  // Admin auth
  verifyAdmin: (password: string) =>
    request<{ ok: boolean }>('/admin/verify', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),

  // Admin actions
  setFeatured: (id: number, on: boolean) =>
    request<{ ok: boolean }>(`/tools/${id}/featured?on=${on}`, { method: 'POST' }),

  setMetisPick: (id: number, on: boolean) =>
    request<{ ok: boolean }>(`/tools/${id}/metis-pick?on=${on}`, { method: 'POST' }),

  // Discover page
  getFeatured: () => request<Tool[]>('/discover/featured'),
  getMetisPicks: () => request<Tool[]>('/discover/metis-picks'),
  getAiPicks: () => request<AiPick[]>('/discover/ai-picks'),
  generateAiPicks: () =>
    request<{ count: number; picks: AiPick[] }>('/discover/ai-picks/generate', { method: 'POST' }),
  getTodayTools: () => request<Tool[]>('/discover/today'),
  getWeekTools: () => request<Tool[]>('/discover/week'),
  getDigest: () => request<DigestItem[]>('/discover/digest'),
  getRandomTool: () => request<Tool>('/discover/random'),

  // User messages
  postMessage: (content: string, nickname?: string) =>
    request<{ ok: boolean; id: number }>('/messages', {
      method: 'POST',
      body: JSON.stringify({ content, nickname }),
    }),
  getMessages: () => request<UserMessage[]>('/messages'),

  // Daily News
  getDailyNews: (date?: string) => {
    const qs = date ? `?date=${date}` : ''
    return request<DailyNews>(`/daily-news${qs}`)
  },
  getDailyNewsList: (limit = 7, offset = 0) =>
    request<DailyNewsMeta[]>(`/daily-news/list?limit=${limit}&offset=${offset}`),
  generateDailyNews: (force = false) =>
    request<{ ok: boolean; news: DailyNews }>(`/daily-news/generate${force ? '?force=true' : ''}`, { method: 'POST' }),
}

export interface DigestItem {
  id: number
  tool_id: number | null
  digest_type: string
  summary: string
  summary_en: string
  created_date: string
}

export interface UserMessage {
  id: number
  content: string
  nickname: string
  created_at: string
}

export interface AiPick extends Tool {
  ai_reason: string
  ai_use_cases: string
  ai_reason_en: string
  ai_use_cases_en: string
  ai_score: number
}

export interface DailyNewsHeadline {
  rank: number
  title: string
  title_en: string
  summary: string
  summary_en: string
  source: string
  source_url: string
  tag: string
}

export interface DailyNewsQuickBite {
  text: string
  text_en: string
  source: string
  source_url: string
}

export interface DailyNews {
  id: number
  news_date: string
  headlines: DailyNewsHeadline[]
  quick_bites: DailyNewsQuickBite[]
  editor_take: string
  editor_take_en: string
  model: string
  created_at: string
}

export interface DailyNewsMeta {
  id: number
  news_date: string
  editor_take: string
  editor_take_en: string
  model: string
  created_at: string
}

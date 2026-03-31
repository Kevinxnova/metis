import { useState, useEffect } from 'react'
import { api, Tool } from '../api/client'
import { Lang, t, td } from '../i18n'
import HeroCarousel from '../components/discover/HeroCarousel'
import CategorySection from '../components/discover/CategorySection'
import ToolDetail from '../components/discover/ToolDetail'

const DOMAIN_ORDER = ['ai', 'web', 'devops', 'data', 'security', 'design'] as const

export default function Discover({ lang }: { lang: Lang }) {
  const [tools, setTools] = useState<Tool[]>([])
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getTools({}).then(data => {
      setTools(data)
      setLoading(false)
    })
  }, [])

  // Group tools by domain for category sections
  const byDomain = new Map<string, Tool[]>()
  for (const tool of tools) {
    const d = tool.domain || 'general'
    if (!byDomain.has(d)) byDomain.set(d, [])
    byDomain.get(d)!.push(tool)
  }

  // Top picks for hero carousel: newest tools with best metrics
  const heroTools = [...tools]
    .filter(t => t.status !== 'archived')
    .slice(0, 12)

  if (selectedTool) {
    return (
      <ToolDetail
        tool={selectedTool}
        lang={lang}
        onBack={() => setSelectedTool(null)}
      />
    )
  }

  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh', color: '#fff' }}>
      {/* Hero */}
      <header style={{
        padding: '48px 32px 0', maxWidth: 1200, margin: '0 auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 48 }}>
          <div>
            <h1 style={{
              fontSize: 36, fontWeight: 700, letterSpacing: -1.5,
              background: 'linear-gradient(135deg, #60a5fa, #a78bfa, #f472b6)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              margin: 0,
            }}>
              Metis
            </h1>
            <p style={{ color: '#666', fontSize: 14, marginTop: 4 }}>
              {lang === 'zh' ? '发现下一个改变你工作流的工具' : 'Discover the next tool that changes your workflow'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <a href="/admin" style={{
              fontSize: 12, color: '#555', textDecoration: 'none',
              padding: '4px 10px', border: '1px solid #333', borderRadius: 4,
            }}>
              {lang === 'zh' ? '管理后台' : 'Admin'}
            </a>
          </div>
        </div>

        {/* Stats bar */}
        <div style={{
          display: 'flex', gap: 32, marginBottom: 32,
          padding: '16px 0', borderTop: '1px solid #1a1a1a', borderBottom: '1px solid #1a1a1a',
        }}>
          <Stat value={tools.length} label={lang === 'zh' ? '工具收录' : 'Tools Tracked'} />
          <Stat
            value={tools.filter(t => isToday(t.first_seen)).length}
            label={lang === 'zh' ? '今日新增' : 'New Today'}
            highlight
          />
          <Stat
            value={new Set(tools.map(t => t.source)).size}
            label={lang === 'zh' ? '数据源' : 'Sources'}
          />
        </div>
      </header>

      {/* Hero Carousel */}
      {!loading && heroTools.length > 0 && (
        <section style={{ maxWidth: 1200, margin: '0 auto', padding: '0 32px' }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16, color: '#ccc' }}>
            {lang === 'zh' ? '🔥 最新发现' : '🔥 Latest Finds'}
          </h2>
          <HeroCarousel tools={heroTools} lang={lang} onSelect={setSelectedTool} />
        </section>
      )}

      {/* Category Sections */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '48px 32px' }}>
        {DOMAIN_ORDER.map(domain => {
          const domainTools = byDomain.get(domain)
          if (!domainTools || domainTools.length === 0) return null
          return (
            <CategorySection
              key={domain}
              title={td(lang, `domain_${domain}`)}
              tools={domainTools.slice(0, 6)}
              lang={lang}
              onSelect={setSelectedTool}
            />
          )
        })}
      </div>

      {/* Footer */}
      <footer style={{
        textAlign: 'center', padding: '32px', color: '#444', fontSize: 12,
        borderTop: '1px solid #1a1a1a',
      }}>
        Metis · {lang === 'zh' ? '每天发现好工具' : 'Discover great tools daily'}
      </footer>
    </div>
  )
}

function Stat({ value, label, highlight }: { value: number; label: string; highlight?: boolean }) {
  return (
    <div>
      <div style={{
        fontSize: 28, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
        color: highlight ? '#60a5fa' : '#fff',
      }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: '#666' }}>{label}</div>
    </div>
  )
}

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
}

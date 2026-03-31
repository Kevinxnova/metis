import { useState, useEffect } from 'react'
import { api, Tool, AiPick } from '../api/client'
import { Lang } from '../i18n'
import ToolRow from '../components/discover/ToolRow'
import ToolDetail from '../components/discover/ToolDetail'
import SectionCarousel from '../components/discover/SectionCarousel'

export default function Discover({ lang }: { lang: Lang }) {
  const [featured, setFeatured] = useState<Tool[]>([])
  const [metisPicks, setMetisPicks] = useState<Tool[]>([])
  const [aiPicks, setAiPicks] = useState<AiPick[]>([])
  const [todayTools, setTodayTools] = useState<Tool[]>([])
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.getFeatured(),
      api.getMetisPicks(),
      api.getAiPicks(),
      api.getTodayTools(),
    ]).then(([f, m, a, today]) => {
      setFeatured(f)
      setMetisPicks(m)
      setAiPicks(a)
      setTodayTools(today)
      setLoading(false)
    })
  }, [])

  const handleGenerateAi = async () => {
    setAiLoading(true)
    try {
      const result = await api.generateAiPicks()
      setAiPicks(result.picks)
    } catch { /* ignore */ }
    setAiLoading(false)
  }

  const isZh = lang === 'zh'

  if (selectedTool) {
    // Check if it's an AI pick with extra info
    const aiInfo = aiPicks.find(p => p.id === selectedTool.id)
    const toolToShow = aiInfo || selectedTool
    return <ToolDetail tool={toolToShow} lang={lang} onBack={() => setSelectedTool(null)} />
  }

  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh', color: '#fff' }}>
      {/* Header */}
      <header style={{ maxWidth: 960, margin: '0 auto', padding: '40px 24px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <div>
            <a href="/" style={{ textDecoration: 'none' }}>
              <h1 style={{
                fontSize: 32, fontWeight: 700, letterSpacing: -1.5, margin: 0,
                background: 'linear-gradient(135deg, #60a5fa, #a78bfa, #f472b6)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                cursor: 'pointer',
              }}>
                Metis
              </h1>
            </a>
            <p style={{ color: '#555', fontSize: 13, marginTop: 4 }}>
              {isZh ? '帮你成为更好的你' : 'Helping you become a better you'}
            </p>
          </div>
          <a href="/" style={{
            fontSize: 12, color: '#555', textDecoration: 'none',
            padding: '4px 10px', border: '1px solid #2a2a2a', borderRadius: 4,
          }}>
            {isZh ? '关于' : 'About'}
          </a>
        </div>
      </header>

      <main style={{ maxWidth: 960, margin: '0 auto', padding: '0 24px 64px' }}>
        {loading ? (
          <p style={{ color: '#555', textAlign: 'center', padding: 48 }}>
            {isZh ? '加载中...' : 'Loading...'}
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>

            {/* 1. 优选榜 — Featured */}
            <Section
              icon="⭐"
              title={isZh ? '优选榜' : "Editor's Picks"}
              subtitle={isZh ? '精选好工具，常驻推荐' : 'Handpicked essentials, always pinned'}
              gradient="linear-gradient(135deg, rgba(245,158,11,0.08), rgba(245,158,11,0.02))"
              borderColor="rgba(245,158,11,0.2)"
              empty={featured.length === 0}
              emptyText={isZh ? '暂无优选。在管理后台设置优选工具。' : 'No featured tools yet. Set them in Admin.'}
            >
              <SectionCarousel
                tools={featured}
                lang={lang}
                onSelect={setSelectedTool}
                accentColor="#f59e0b"
              />
            </Section>

            {/* 2. Metis 推荐 */}
            <Section
              icon="💎"
              title={isZh ? 'Metis 推荐' : 'Metis Picks'}
              subtitle={isZh ? '每日精选，品味即算法' : 'Daily curated picks, taste is the algorithm'}
              gradient="linear-gradient(135deg, rgba(139,92,246,0.08), rgba(139,92,246,0.02))"
              borderColor="rgba(139,92,246,0.2)"
              empty={metisPicks.length === 0}
              emptyText={isZh ? '暂无推荐。在管理后台设置 Metis 推荐。' : 'No picks yet. Set them in Admin.'}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
                {metisPicks.map(tool => (
                  <ToolRow key={tool.id} tool={tool} lang={lang} onSelect={setSelectedTool} />
                ))}
              </div>
            </Section>

            {/* 3. AI 推荐 */}
            <Section
              icon="🤖"
              title={isZh ? 'AI 推荐' : 'AI Recommended'}
              subtitle={isZh ? 'AI 分析今日工具，给出理由和场景' : 'AI analyzes today\'s tools with reasons and use cases'}
              gradient="linear-gradient(135deg, rgba(96,165,250,0.08), rgba(96,165,250,0.02))"
              borderColor="rgba(96,165,250,0.2)"
              empty={aiPicks.length === 0}
              emptyText={isZh ? '点击生成按钮让 AI 分析今日工具' : 'Click generate to let AI analyze today\'s tools'}
              action={
                aiPicks.length === 0 ? (
                  <button
                    onClick={handleGenerateAi}
                    disabled={aiLoading}
                    style={{
                      fontSize: 12, padding: '6px 14px', borderRadius: 6, cursor: 'pointer',
                      border: '1px solid rgba(96,165,250,0.3)', background: 'rgba(96,165,250,0.1)',
                      color: '#60a5fa',
                    }}
                  >
                    {aiLoading
                      ? (isZh ? '分析中...' : 'Analyzing...')
                      : (isZh ? '🤖 生成 AI 推荐' : '🤖 Generate AI Picks')}
                  </button>
                ) : undefined
              }
            >
              <SectionCarousel
                tools={aiPicks}
                lang={lang}
                onSelect={setSelectedTool}
                accentColor="#60a5fa"
                showAiInfo
                smooth
              />
            </Section>

            {/* 4. 今日发现 */}
            <Section
              icon="📡"
              title={isZh ? '今日发现' : "Today's Discoveries"}
              subtitle={isZh
                ? `今天从 GitHub、HN、Product Hunt 抓取了 ${todayTools.length} 个新工具，按热度排序`
                : `${todayTools.length} new tools found today, sorted by popularity`}
              gradient="linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))"
              borderColor="rgba(255,255,255,0.08)"
              empty={todayTools.length === 0}
              emptyText={isZh ? '今天暂无新发现。运行爬虫抓取。' : 'No new tools today. Run the scraper.'}
              action={
                todayTools.length > 0 ? (
                  <button
                    onClick={async () => {
                      try {
                        const tool = await api.getRandomTool()
                        setSelectedTool(tool)
                      } catch { /* ignore */ }
                    }}
                    style={{
                      fontSize: 12, padding: '6px 14px', borderRadius: 6, cursor: 'pointer',
                      border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)',
                      color: '#aaa', transition: 'background 0.2s, color 0.2s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#aaa' }}
                  >
                    🎲 {isZh ? '随机一个' : 'Random Pick'}
                  </button>
                ) : undefined
              }
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
                {todayTools.map(tool => (
                  <ToolRow key={tool.id} tool={tool} lang={lang} onSelect={setSelectedTool} />
                ))}
              </div>
            </Section>
          </div>
        )}
      </main>

      <footer style={{
        textAlign: 'center', padding: 24, color: '#333', fontSize: 12,
        borderTop: '1px solid #151515',
      }}>
        Metis · {isZh ? '每天发现好工具' : 'Discover great tools daily'}
      </footer>
    </div>
  )
}

function Section({ icon, title, subtitle, gradient, borderColor, children, empty, emptyText, action }: {
  icon: string; title: string; subtitle: string
  gradient: string; borderColor: string
  children: React.ReactNode
  empty: boolean; emptyText: string
  action?: React.ReactNode
}) {
  return (
    <section style={{
      background: gradient,
      border: `1px solid ${borderColor}`,
      borderRadius: 16, padding: 24,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#eee', margin: 0 }}>
            {icon} {title}
          </h2>
          <p style={{ fontSize: 12, color: '#666', margin: '4px 0 0' }}>{subtitle}</p>
        </div>
        {action}
      </div>
      {empty ? (
        <p style={{ color: '#444', fontSize: 13, textAlign: 'center', padding: 24 }}>
          {emptyText}
        </p>
      ) : children}
    </section>
  )
}

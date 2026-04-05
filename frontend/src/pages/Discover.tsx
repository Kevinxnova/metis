import { useState, useEffect } from 'react'
import { api, Tool, AiPick, DigestItem } from '../api/client'
import { Lang } from '../i18n'
import ToolRow from '../components/discover/ToolRow'
import ToolDetail from '../components/discover/ToolDetail'
import SectionCarousel from '../components/discover/SectionCarousel'

export default function Discover({ lang }: { lang: Lang }) {
  const [featured, setFeatured] = useState<Tool[]>([])
  const [metisPicks, setMetisPicks] = useState<Tool[]>([])
  const [aiPicks, setAiPicks] = useState<AiPick[]>([])
  const [weekTools, setWeekTools] = useState<Tool[]>([])
  const [_digest, setDigest] = useState<DigestItem[]>([])
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [loading, setLoading] = useState(true)

  const isZh = lang === 'zh'

  useEffect(() => {
    Promise.all([
      api.getFeatured(),
      api.getMetisPicks(),
      api.getAiPicks(),
      api.getWeekTools(),
      api.getDigest(),
    ]).then(([f, m, a, w, d]) => {
      setFeatured(f)
      setMetisPicks(m)
      setAiPicks(a)
      setWeekTools(w)
      setDigest(d)
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

  if (selectedTool) {
    const aiInfo = aiPicks.find(p => p.id === selectedTool.id)
    return <ToolDetail tool={aiInfo || selectedTool} lang={lang} onBack={() => setSelectedTool(null)} />
  }


  return (
    <div style={{ background: '#050510', minHeight: '100vh', color: '#fff' }}>
      <header style={{ maxWidth: 960, margin: '0 auto', padding: '40px 24px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <div>
            <a href="/" style={{ textDecoration: 'none' }}>
              <h1 style={{
                fontSize: 32, fontWeight: 700, letterSpacing: -1.5, margin: 0, cursor: 'pointer',
                background: 'linear-gradient(135deg, #60a5fa, #a78bfa, #f472b6)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>Metis</h1>
            </a>
            <p style={{ color: '#555', fontSize: 13, marginTop: 4 }}>
              {isZh ? '帮你成为更好的你' : 'Helping you become a better you'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <a href="/community" style={{
              fontSize: 12, color: '#a78bfa', textDecoration: 'none',
              padding: '4px 10px', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 4,
            }}>
              💬 {isZh ? '社区' : 'Community'}
            </a>
            <a href="/" style={{
              fontSize: 12, color: '#555', textDecoration: 'none',
              padding: '4px 10px', border: '1px solid #2a2a2a', borderRadius: 4,
            }}>
              {isZh ? '关于' : 'About'}
            </a>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 960, margin: '0 auto', padding: '0 24px 64px' }}>
        {loading ? (
          <p style={{ color: '#555', textAlign: 'center', padding: 48 }}>
            {isZh ? '加载中...' : 'Loading...'}
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>

            {/* 1. 优选榜 */}
            <Section
              icon="⭐" title={isZh ? '优选榜' : "Editor's Picks"}
              subtitle={isZh ? '精选好工具，常驻推荐' : 'Handpicked essentials, always pinned'}
              gradient="linear-gradient(135deg, rgba(245,158,11,0.08), rgba(245,158,11,0.02))"
              borderColor="rgba(245,158,11,0.2)"
              empty={featured.length === 0}
              emptyText={isZh ? '优选榜即将上线' : 'Coming soon'}
            >
              <SectionCarousel tools={featured} lang={lang} onSelect={setSelectedTool} accentColor="#f59e0b" />
            </Section>

            {/* 2. Metis 推荐 */}
            <Section
              icon="💎" title={isZh ? 'Metis 推荐' : 'Metis Picks'}
              subtitle={isZh ? '每日精选，品味即算法' : 'Daily curated picks, taste is the algorithm'}
              gradient="linear-gradient(135deg, rgba(139,92,246,0.08), rgba(139,92,246,0.02))"
              borderColor="rgba(139,92,246,0.2)"
              empty={metisPicks.length === 0}
              emptyText={isZh ? '今天 Metis 无更新，敬请期待' : 'No Metis picks today, stay tuned'}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
                {metisPicks.map(tool => (
                  <ToolRow key={tool.id} tool={tool} lang={lang} onSelect={setSelectedTool} />
                ))}
              </div>
            </Section>

            {/* 3. AI 推荐 */}
            <Section
              icon="🤖" title={isZh ? 'AI 推荐' : 'AI Recommended'}
              subtitle={isZh ? 'AI 分析工具，给出理由和场景' : 'AI analyzes tools with reasons and use cases'}
              gradient="linear-gradient(135deg, rgba(96,165,250,0.08), rgba(96,165,250,0.02))"
              borderColor="rgba(96,165,250,0.2)"
              empty={aiPicks.length === 0}
              emptyText={isZh ? '点击生成按钮让 AI 分析' : 'Click to generate AI picks'}
              action={aiPicks.length === 0 ? (
                <button onClick={handleGenerateAi} disabled={aiLoading} style={{
                  fontSize: 12, padding: '6px 14px', borderRadius: 6, cursor: 'pointer',
                  border: '1px solid rgba(96,165,250,0.3)', background: 'rgba(96,165,250,0.1)', color: '#60a5fa',
                }}>
                  {aiLoading ? (isZh ? '分析中...' : 'Analyzing...') : (isZh ? '🤖 生成' : '🤖 Generate')}
                </button>
              ) : undefined}
            >
              {/* Quick summary list */}
              {aiPicks.length > 0 && (
                <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {aiPicks.map(p => {
                    const name = (isZh && p.title_zh) ? p.title_zh : p.title
                    const reason = (isZh || !p.ai_reason_en) ? p.ai_reason : p.ai_reason_en
                    // Take first sentence only
                    const short = reason.split(/[.。!！]/)[0]
                    return (
                      <div key={p.id} onClick={() => setSelectedTool(p)} style={{
                        fontSize: 13, color: '#aaa', cursor: 'pointer', lineHeight: 1.5,
                        padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
                      }}>
                        <span style={{ color: '#60a5fa', fontWeight: 600 }}>{name}</span>
                        <span style={{ color: '#555' }}> — </span>
                        <span>{short}</span>
                      </div>
                    )
                  })}
                </div>
              )}
              <SectionCarousel tools={aiPicks} lang={lang} onSelect={setSelectedTool} accentColor="#60a5fa" showAiInfo smooth />
            </Section>

            {/* 4. 本周发现 — 三个模块 */}
            {(() => {
              const newsTools = weekTools.filter(t => t.discovery_category === 'news')
              const aiTools = weekTools.filter(t => t.discovery_category === 'ai_tool')
              const otherTools = weekTools.filter(t => t.discovery_category === 'other' || !t.discovery_category)

              const DiscoveryList = ({ tools, defaultCount = 6 }: { tools: Tool[], defaultCount?: number }) => {
                const [expanded, setExpanded] = useState(false)
                const shown = expanded ? tools : tools.slice(0, defaultCount)
                return (
                  <div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {shown.map(tool => {
                        const summary = isZh
                          ? (tool.short_summary_zh || tool.short_summary || tool.title_zh || tool.title)
                          : (tool.short_summary || tool.title)
                        return (
                          <div key={tool.id} onClick={() => setSelectedTool(tool)} style={{
                            fontSize: 13, color: '#aaa', cursor: 'pointer', lineHeight: 1.5,
                            padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
                            display: 'flex', alignItems: 'baseline', gap: 0,
                          }}>
                            <span style={{ color: '#ddd', fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0 }}>
                              {isZh ? (tool.title_zh || tool.title) : tool.title}
                            </span>
                            {summary && summary !== tool.title && summary !== tool.title_zh && (
                              <>
                                <span style={{ color: '#444', margin: '0 6px' }}>—</span>
                                <span style={{ color: '#666' }}>
                                  {summary.includes('—') ? summary.split('—').slice(1).join('—').trim() : summary}
                                </span>
                              </>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    {tools.length > defaultCount && (
                      <button onClick={() => setExpanded(!expanded)} style={{
                        marginTop: 10, fontSize: 12, color: '#555', background: 'none', border: 'none', cursor: 'pointer',
                      }}>
                        {expanded
                          ? (isZh ? '收起 ↑' : 'Collapse ↑')
                          : (isZh ? `展开全部 ${tools.length} 条 ↓` : `Show all ${tools.length} ↓`)}
                      </button>
                    )}
                  </div>
                )
              }

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h2 style={{ fontSize: 18, fontWeight: 600, color: '#eee', margin: 0 }}>
                        📡 {isZh ? '本周发现' : "This Week's Discoveries"}
                      </h2>
                      <p style={{ fontSize: 12, color: '#666', margin: '4px 0 0' }}>
                        {isZh
                          ? `本周共发现 ${weekTools.length} 条内容`
                          : `${weekTools.length} items discovered this week`}
                      </p>
                    </div>
                    <button onClick={async () => {
                      try { const tool = await api.getRandomTool(); setSelectedTool(tool) } catch {}
                    }} style={{
                      fontSize: 12, padding: '6px 14px', borderRadius: 6, cursor: 'pointer',
                      border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#aaa',
                    }}>
                      🎲 {isZh ? '随机一个' : 'Random'}
                    </button>
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: 12,
                  }}>
                    {/* 模块 1：AI 动态 */}
                    <div style={{
                      background: 'linear-gradient(135deg, rgba(96,165,250,0.06), rgba(96,165,250,0.02))',
                      border: '1px solid rgba(96,165,250,0.15)',
                      borderRadius: 12, padding: 16,
                    }}>
                      <h3 style={{ fontSize: 14, fontWeight: 600, color: '#60a5fa', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                        📰 {isZh ? 'AI 动态' : 'AI News'}
                        <span style={{ fontSize: 11, color: '#444', fontWeight: 400 }}>{newsTools.length}</span>
                      </h3>
                      {newsTools.length === 0
                        ? <p style={{ color: '#333', fontSize: 12, margin: 0 }}>{isZh ? '暂无动态' : 'No news yet'}</p>
                        : <DiscoveryList tools={newsTools} />}
                    </div>

                    {/* 模块 2：AI 工具 */}
                    <div style={{
                      background: 'linear-gradient(135deg, rgba(167,139,250,0.06), rgba(167,139,250,0.02))',
                      border: '1px solid rgba(167,139,250,0.15)',
                      borderRadius: 12, padding: 16,
                    }}>
                      <h3 style={{ fontSize: 14, fontWeight: 600, color: '#a78bfa', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                        🔧 {isZh ? 'AI 工具' : 'AI Tools'}
                        <span style={{ fontSize: 11, color: '#444', fontWeight: 400 }}>{aiTools.length}</span>
                      </h3>
                      {aiTools.length === 0
                        ? <p style={{ color: '#333', fontSize: 12, margin: 0 }}>{isZh ? '暂无工具' : 'No tools yet'}</p>
                        : <DiscoveryList tools={aiTools} />}
                    </div>

                    {/* 模块 3：其他 */}
                    <div style={{
                      background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 12, padding: 16,
                    }}>
                      <h3 style={{ fontSize: 14, fontWeight: 600, color: '#888', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                        🌐 {isZh ? '其他' : 'Others'}
                        <span style={{ fontSize: 11, color: '#444', fontWeight: 400 }}>{otherTools.length}</span>
                      </h3>
                      {otherTools.length === 0
                        ? <p style={{ color: '#333', fontSize: 12, margin: 0 }}>{isZh ? '暂无其他内容' : 'Nothing else yet'}</p>
                        : <DiscoveryList tools={otherTools} />}
                    </div>
                  </div>
                </div>
              )
            })()}
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
      background: gradient, border: `1px solid ${borderColor}`,
      borderRadius: 16, padding: 24,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#eee', margin: 0 }}>{icon} {title}</h2>
          <p style={{ fontSize: 12, color: '#666', margin: '4px 0 0' }}>{subtitle}</p>
        </div>
        {action}
      </div>
      {empty ? (
        <p style={{ color: '#444', fontSize: 13, textAlign: 'center', padding: 24 }}>{emptyText}</p>
      ) : children}
    </section>
  )
}

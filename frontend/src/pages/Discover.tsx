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
  const [digest, setDigest] = useState<DigestItem[]>([])
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showAllTools, setShowAllTools] = useState(false)

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

  const toolPicks = digest.filter(d => d.digest_type === 'tool_pick')
  const hotNews = digest.filter(d => d.digest_type === 'hot_news')

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

            {/* 4. 本周发现 */}
            <Section
              icon="📡" title={isZh ? '本周发现' : "This Week's Discoveries"}
              subtitle={isZh
                ? `本周共发现 ${weekTools.length} 个工具和资讯`
                : `${weekTools.length} tools and news discovered this week`}
              gradient="linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))"
              borderColor="rgba(255,255,255,0.08)"
              empty={weekTools.length === 0}
              emptyText={isZh ? '本周暂无新发现' : 'No discoveries this week'}
              action={weekTools.length > 0 ? (
                <button onClick={async () => {
                  try { const tool = await api.getRandomTool(); setSelectedTool(tool) } catch {}
                }} style={{
                  fontSize: 12, padding: '6px 14px', borderRadius: 6, cursor: 'pointer',
                  border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#aaa',
                }}>
                  🎲 {isZh ? '随机一个' : 'Random'}
                </button>
              ) : undefined}
            >
              {/* Sub 1: AI Daily Digest */}
              {(toolPicks.length > 0 || hotNews.length > 0) && (
                <div style={{ marginBottom: 20, padding: 16, background: 'rgba(96,165,250,0.04)', borderRadius: 10, border: '1px solid rgba(96,165,250,0.08)' }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: '#60a5fa', margin: '0 0 12px' }}>
                    🎯 {isZh ? '今日精选' : "Today's Highlights"}
                  </h3>
                  {toolPicks.map((d, i) => (
                    <div key={d.id} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-start' }}>
                      <span style={{ fontSize: 11, color: '#4a9', background: 'rgba(74,169,111,0.1)', padding: '2px 6px', borderRadius: 4, flexShrink: 0 }}>
                        {isZh ? '工具' : 'Tool'} {i + 1}
                      </span>
                      <p style={{ fontSize: 13, color: '#bbb', margin: 0, lineHeight: 1.5 }}>
                        {isZh ? d.summary : (d.summary_en || d.summary)}
                      </p>
                    </div>
                  ))}
                  {hotNews.map((d) => (
                    <div key={d.id} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-start' }}>
                      <span style={{ fontSize: 11, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '2px 6px', borderRadius: 4, flexShrink: 0 }}>
                        🔥 {isZh ? '热点' : 'Hot'}
                      </span>
                      <p style={{ fontSize: 13, color: '#bbb', margin: 0, lineHeight: 1.5 }}>
                        {isZh ? d.summary : (d.summary_en || d.summary)}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Sub 2: All discoveries */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: '#888', margin: 0 }}>
                  📋 {isZh ? '全部发现' : 'All Discoveries'}
                </h3>
                <button onClick={() => setShowAllTools(!showAllTools)} style={{
                  fontSize: 12, color: '#60a5fa', background: 'none', border: 'none', cursor: 'pointer',
                }}>
                  {showAllTools
                    ? (isZh ? '收起 ↑' : 'Collapse ↑')
                    : (isZh ? `展开全部 ${weekTools.length} 个 ↓` : `Show all ${weekTools.length} ↓`)}
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
                {(showAllTools ? weekTools : weekTools.slice(0, 6)).map(tool => (
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

import { useRef, useEffect, useState } from 'react'
import { Tool, AiPick } from '../../api/client'
import { Lang, td } from '../../i18n'

interface Props {
  tools: (Tool | AiPick)[]
  lang: Lang
  onSelect: (tool: Tool) => void
  accentColor: string
  showAiInfo?: boolean
}

function parseMetrics(s: string): Record<string, unknown> {
  try { return JSON.parse(s) } catch { return {} }
}

export default function SectionCarousel({ tools, lang, onSelect, accentColor, showAiInfo }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [paused, setPaused] = useState(false)
  const isZh = lang === 'zh'

  useEffect(() => {
    const el = scrollRef.current
    if (!el || paused || tools.length <= 3) return
    const interval = setInterval(() => {
      const max = el.scrollWidth - el.clientWidth
      if (el.scrollLeft >= max - 10) {
        el.scrollTo({ left: 0, behavior: 'smooth' })
      } else {
        el.scrollBy({ left: 340, behavior: 'smooth' })
      }
    }, 4000)
    return () => clearInterval(interval)
  }, [paused, tools.length])

  return (
    <div
      ref={scrollRef}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      style={{
        display: 'flex', gap: 14, overflowX: 'auto', scrollSnapType: 'x mandatory',
        paddingBottom: 8, scrollbarWidth: 'none',
      }}
    >
      {tools.map(tool => {
        const metrics = parseMetrics(tool.metrics)
        const title = (isZh && tool.title_zh) ? tool.title_zh : tool.title
        const desc = (isZh && tool.description_zh) ? tool.description_zh : tool.description
        const aiTool = tool as AiPick

        return (
          <div
            key={tool.id}
            onClick={() => onSelect(tool)}
            style={{
              flex: '0 0 320px', scrollSnapAlign: 'start',
              background: `linear-gradient(145deg, #111, ${accentColor}08)`,
              border: `1px solid ${accentColor}25`,
              borderRadius: 14, padding: 20, cursor: 'pointer',
              transition: 'transform 0.2s, border-color 0.2s',
              display: 'flex', flexDirection: 'column',
              minHeight: 200,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-4px)'
              e.currentTarget.style.borderColor = `${accentColor}50`
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.borderColor = `${accentColor}25`
            }}
          >
            {/* Top: tags + metrics */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {tool.content_type && tool.content_type !== 'other' && (
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: 'rgba(96,165,250,0.12)', color: '#60a5fa' }}>
                    {td(lang, `type_${tool.content_type}`)}
                  </span>
                )}
                {tool.domain && tool.domain !== 'general' && (
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: 'rgba(74,159,111,0.12)', color: '#4a9f6f' }}>
                    {td(lang, `domain_${tool.domain}`)}
                  </span>
                )}
                {showAiInfo && aiTool.ai_score && (
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: 'rgba(245,158,11,0.12)', color: '#f59e0b', fontWeight: 600 }}>
                    {aiTool.ai_score}/10
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, fontSize: 11, color: '#555' }}>
                {metrics.stars != null && Number(metrics.stars) > 0 && <span>⭐{String(metrics.stars).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}</span>}
                {metrics.points != null && Number(metrics.points) > 0 && <span>▲{String(metrics.points)}</span>}
              </div>
            </div>

            {/* Title */}
            <h3 style={{
              fontSize: 16, fontWeight: 600, color: '#eee', margin: '0 0 8px',
              lineHeight: 1.3,
              display: '-webkit-box', WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              {title}
            </h3>

            {/* Description / AI reason / Take */}
            <div style={{ flex: 1 }}>
              {showAiInfo && aiTool.ai_reason ? (
                <p style={{
                  fontSize: 13, color: '#9cb', lineHeight: 1.6, margin: 0,
                  display: '-webkit-box', WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>
                  {aiTool.ai_reason}
                </p>
              ) : tool.take ? (
                <p style={{
                  fontSize: 13, color: '#b9a0e8', lineHeight: 1.6, margin: 0,
                  display: '-webkit-box', WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>
                  💎 {tool.take}
                </p>
              ) : desc ? (
                <p style={{
                  fontSize: 13, color: '#777', lineHeight: 1.6, margin: 0,
                  display: '-webkit-box', WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>
                  {desc}
                </p>
              ) : null}
            </div>

            {/* Bottom: source + use cases hint */}
            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#444' }}>{tool.source}</span>
              {showAiInfo && aiTool.ai_use_cases && (
                <span style={{ fontSize: 11, color: `${accentColor}88` }}>
                  {isZh ? '查看适用场景 →' : 'See use cases →'}
                </span>
              )}
              {!showAiInfo && tool.take && (
                <span style={{ fontSize: 11, color: `${accentColor}88` }}>
                  {isZh ? '查看完整点评 →' : 'Read full review →'}
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

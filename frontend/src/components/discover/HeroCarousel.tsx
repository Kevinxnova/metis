import { useRef, useEffect, useState } from 'react'
import { Tool } from '../../api/client'
import { Lang, td } from '../../i18n'

interface Props {
  tools: Tool[]
  lang: Lang
  onSelect: (tool: Tool) => void
}

function parseMetrics(s: string): Record<string, unknown> {
  try { return JSON.parse(s) } catch { return {} }
}

export default function HeroCarousel({ tools, lang, onSelect }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [paused, setPaused] = useState(false)

  // Auto-scroll
  useEffect(() => {
    const el = scrollRef.current
    if (!el || paused) return

    const interval = setInterval(() => {
      const maxScroll = el.scrollWidth - el.clientWidth
      if (el.scrollLeft >= maxScroll - 10) {
        el.scrollTo({ left: 0, behavior: 'smooth' })
      } else {
        el.scrollBy({ left: 320, behavior: 'smooth' })
      }
    }, 3500)

    return () => clearInterval(interval)
  }, [paused])

  const isZh = lang === 'zh'

  return (
    <div
      ref={scrollRef}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      style={{
        display: 'flex', gap: 16, overflowX: 'auto', scrollSnapType: 'x mandatory',
        paddingBottom: 16, scrollbarWidth: 'none',
      }}
    >
      {tools.map(tool => {
        const metrics = parseMetrics(tool.metrics)
        const title = (isZh && tool.title_zh) ? tool.title_zh : tool.title
        const desc = (isZh && tool.description_zh) ? tool.description_zh : tool.description

        return (
          <div
            key={tool.id}
            onClick={() => onSelect(tool)}
            style={{
              flex: '0 0 300px', scrollSnapAlign: 'start',
              background: 'linear-gradient(145deg, var(--bg-card-alt), var(--bg-secondary))',
              border: '1px solid var(--border-card)',
              borderRadius: 12, padding: 20, cursor: 'pointer',
              transition: 'transform 0.2s, border-color 0.2s',
              boxShadow: 'var(--shadow-card)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-4px)'
              e.currentTarget.style.borderColor = 'var(--border-primary)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.borderColor = 'var(--border-card)'
            }}
          >
            {/* Tags */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              {tool.content_type && tool.content_type !== 'other' && (
                <span style={{
                  fontSize: 10, padding: '2px 8px', borderRadius: 10,
                  background: 'rgba(96,165,250,0.15)', color: '#60a5fa',
                }}>
                  {td(lang, `type_${tool.content_type}`)}
                </span>
              )}
              {tool.domain && tool.domain !== 'general' && (
                <span style={{
                  fontSize: 10, padding: '2px 8px', borderRadius: 10,
                  background: 'rgba(74,159,111,0.15)', color: '#4a9f6f',
                }}>
                  {td(lang, `domain_${tool.domain}`)}
                </span>
              )}
              <span style={{
                fontSize: 10, padding: '2px 8px', borderRadius: 10,
                background: 'rgba(255,255,255,0.05)', color: '#666',
              }}>
                {tool.source}
              </span>
            </div>

            {/* Title */}
            <h3 style={{
              fontSize: 16, fontWeight: 600, margin: '0 0 8px', color: 'var(--text-heading)',
              lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              {title}
            </h3>

            {/* Description */}
            <p style={{
              fontSize: 13, color: 'var(--text-body)', lineHeight: 1.5, margin: '0 0 12px',
              display: '-webkit-box', WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              {desc || (isZh ? '暂无描述' : 'No description')}
            </p>

            {/* Metrics */}
            <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-muted)' }}>
              {metrics.stars != null && Number(metrics.stars) > 0 && <span>⭐ {String(metrics.stars)}</span>}
              {metrics.points != null && Number(metrics.points) > 0 && <span>▲ {String(metrics.points)}</span>}
              {metrics.votes != null && Number(metrics.votes) > 0 && <span>▲ {String(metrics.votes)}</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

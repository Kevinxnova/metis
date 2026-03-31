import { Tool } from '../../api/client'
import { Lang, td } from '../../i18n'

interface Props {
  title: string
  tools: Tool[]
  lang: Lang
  onSelect: (tool: Tool) => void
}

function parseMetrics(s: string): Record<string, unknown> {
  try { return JSON.parse(s) } catch { return {} }
}

export default function CategorySection({ title, tools, lang, onSelect }: Props) {
  const isZh = lang === 'zh'

  return (
    <section style={{ marginBottom: 48 }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16, color: '#ccc' }}>
        {title}
        <span style={{ fontSize: 13, color: '#555', marginLeft: 8 }}>{tools.length}</span>
      </h2>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 12,
      }}>
        {tools.map(tool => {
          const metrics = parseMetrics(tool.metrics)
          const toolTitle = (isZh && tool.title_zh) ? tool.title_zh : tool.title
          const desc = (isZh && tool.description_zh) ? tool.description_zh : tool.description

          return (
            <div
              key={tool.id}
              onClick={() => onSelect(tool)}
              style={{
                background: '#111', border: '1px solid #1e1e1e', borderRadius: 8,
                padding: 16, cursor: 'pointer',
                transition: 'border-color 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#333' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#1e1e1e' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <h3 style={{
                  fontSize: 14, fontWeight: 600, color: '#ddd', margin: 0,
                  lineHeight: 1.3, flex: 1,
                  display: '-webkit-box', WebkitLineClamp: 1,
                  WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>
                  {toolTitle}
                </h3>
                {tool.content_type && tool.content_type !== 'other' && (
                  <span style={{
                    fontSize: 10, padding: '1px 6px', borderRadius: 8, flexShrink: 0, marginLeft: 8,
                    background: 'rgba(96,165,250,0.1)', color: '#4a8fd4',
                  }}>
                    {td(lang, `type_${tool.content_type}`)}
                  </span>
                )}
              </div>
              <p style={{
                fontSize: 12, color: '#666', lineHeight: 1.5, margin: '0 0 10px',
                display: '-webkit-box', WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}>
                {desc?.slice(0, 120) || (isZh ? '暂无描述' : 'No description')}
              </p>
              <div style={{ display: 'flex', gap: 10, fontSize: 11, color: '#444' }}>
                {metrics.stars != null && Number(metrics.stars) > 0 && <span>⭐ {String(metrics.stars)}</span>}
                {metrics.points != null && Number(metrics.points) > 0 && <span>▲ {String(metrics.points)}</span>}
                {metrics.votes != null && Number(metrics.votes) > 0 && <span>▲ {String(metrics.votes)}</span>}
                <span>{tool.source}</span>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

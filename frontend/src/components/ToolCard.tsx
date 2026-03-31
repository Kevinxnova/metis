import { Tool, api } from '../api/client'
import { Lang, t, td } from '../i18n'

interface Props {
  tool: Tool & { is_featured?: number; is_metis_pick?: number }
  onAction: (id: number, action: string, takeText?: string) => void
  lang: Lang
}

function parseJSON(s: string): Record<string, unknown> {
  try { return JSON.parse(s) } catch { return {} }
}

export default function ToolCard({ tool, onAction, lang }: Props) {
  const metrics = parseJSON(tool.metrics)
  const sources = JSON.parse(tool.sources || '[]') as string[]
  const isApproved = tool.status === 'approved'
  const isSkipped = tool.status === 'skipped'
  const isZh = lang === 'zh'
  const title = (isZh && tool.title_zh) ? tool.title_zh : tool.title
  const desc = (isZh && tool.description_zh) ? tool.description_zh : tool.description

  return (
    <div style={{
      background: 'white',
      border: `1px solid ${isApproved ? '#4a9' : '#e0e0e0'}`,
      borderLeft: isApproved ? '3px solid #4a9' : undefined,
      borderRadius: 6,
      padding: 16,
      opacity: isSkipped ? 0.5 : 1,
      position: 'relative',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {sources.length > 1 ? sources.join(' + ') : tool.source}
            </span>
            {tool.content_type && tool.content_type !== 'other' && (
              <span style={{
                fontSize: 10, padding: '1px 6px', borderRadius: 8,
                background: '#f0f7ff', color: '#4a7fbf', border: '1px solid #d0e3f7',
              }}>
                {td(lang, `type_${tool.content_type}`)}
              </span>
            )}
            {tool.domain && tool.domain !== 'general' && (
              <span style={{
                fontSize: 10, padding: '1px 6px', borderRadius: 8,
                background: '#f0faf4', color: '#4a9f6f', border: '1px solid #d0eadc',
              }}>
                {td(lang, `domain_${tool.domain}`)}
              </span>
            )}
          </div>
          <a href={tool.url} target="_blank" rel="noopener"
             style={{ fontSize: 15, fontWeight: 600, color: '#333', textDecoration: 'none' }}>
            {title}
          </a>
          {isZh && tool.title_zh && (
            <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{tool.title}</div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {tool.status === 'pending' && (
            <>
              <button onClick={() => onAction(tool.id, 'approve')}
                style={{ border: '1px solid #4a9', background: 'white', borderRadius: 4, padding: '4px 10px', fontSize: 12, cursor: 'pointer', color: '#4a9' }}>
                {t(lang, 'approve')}
              </button>
              <button onClick={() => onAction(tool.id, 'skip')}
                style={{ border: '1px solid #ccc', background: 'white', borderRadius: 4, padding: '4px 10px', fontSize: 12, cursor: 'pointer', color: '#aaa' }}>
                {t(lang, 'skip')}
              </button>
            </>
          )}
          {isApproved && (
            <button onClick={() => onAction(tool.id, 'unapprove')}
              style={{ border: '1px solid #4a9', background: '#4a9', borderRadius: 4, padding: '4px 10px', fontSize: 12, cursor: 'pointer', color: 'white' }}>
              {t(lang, 'approved_btn')}
            </button>
          )}
          {isSkipped && (
            <button onClick={() => onAction(tool.id, 'unapprove')}
              style={{ border: '1px solid #ccc', background: '#f5f5f5', borderRadius: 4, padding: '4px 10px', fontSize: 12, cursor: 'pointer', color: '#aaa' }}>
              {t(lang, 'skipped_btn')}
            </button>
          )}
        </div>
      </div>
      {/* Admin: featured & metis pick toggles */}
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <button
          onClick={async () => { await api.setFeatured(tool.id, !tool.is_featured); onAction(tool.id, tool.status, undefined) }}
          style={{
            fontSize: 11, padding: '2px 8px', borderRadius: 4, cursor: 'pointer',
            border: `1px solid ${tool.is_featured ? '#f59e0b' : '#e0e0e0'}`,
            background: tool.is_featured ? '#fef3c7' : 'white',
            color: tool.is_featured ? '#b45309' : '#999',
          }}
        >
          {tool.is_featured ? '⭐ 优选' : '☆ 设为优选'}
        </button>
        <button
          onClick={async () => { await api.setMetisPick(tool.id, !tool.is_metis_pick); onAction(tool.id, tool.status, undefined) }}
          style={{
            fontSize: 11, padding: '2px 8px', borderRadius: 4, cursor: 'pointer',
            border: `1px solid ${tool.is_metis_pick ? '#8b5cf6' : '#e0e0e0'}`,
            background: tool.is_metis_pick ? '#ede9fe' : 'white',
            color: tool.is_metis_pick ? '#6d28d9' : '#999',
          }}
        >
          {tool.is_metis_pick ? '💎 Metis推荐' : '◇ 设为Metis推荐'}
        </button>
      </div>
      {desc && (
        <p style={{ fontSize: 13, color: '#666', lineHeight: 1.5, margin: '8px 0' }}>
          {desc.slice(0, 300)}
        </p>
      )}
      <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#999' }}>
        {metrics.stars != null && <span>⭐ {String(metrics.stars)}</span>}
        {metrics.points != null && <span>▲ {String(metrics.points)}</span>}
        {metrics.votes != null && <span>▲ {String(metrics.votes)}</span>}
        {metrics.comments != null && <span>💬 {String(metrics.comments)}</span>}
        <span>{new Date(tool.first_seen).toLocaleDateString()}</span>
      </div>
    </div>
  )
}

import { Tool } from '../api/client'
import { Lang, t } from '../i18n'

interface Props {
  tool: Tool
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
          <div style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
            {sources.length > 1 ? sources.join(' + ') : tool.source}
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

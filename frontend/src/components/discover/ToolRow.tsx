import { Tool, AiPick } from '../../api/client'
import { Lang, td } from '../../i18n'

interface Props {
  tool: Tool | AiPick
  lang: Lang
  onSelect: (tool: Tool) => void
  showAiInfo?: boolean
}

function parseMetrics(s: string): Record<string, unknown> {
  try { return JSON.parse(s) } catch { return {} }
}

export default function ToolRow({ tool, lang, onSelect, showAiInfo }: Props) {
  const isZh = lang === 'zh'
  const metrics = parseMetrics(tool.metrics)
  const title = (isZh && tool.title_zh) ? tool.title_zh : tool.title
  const aiTool = tool as AiPick

  return (
    <div
      onClick={() => onSelect(tool)}
      style={{
        background: '#111', border: '1px solid #1e1e1e', borderRadius: 10,
        padding: 16, cursor: 'pointer', transition: 'border-color 0.2s, transform 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = '#333'; e.currentTarget.style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = '#1e1e1e'; e.currentTarget.style.transform = 'translateY(0)' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
            {tool.content_type && tool.content_type !== 'other' && (
              <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 8, background: 'rgba(96,165,250,0.12)', color: '#60a5fa' }}>
                {td(lang, `type_${tool.content_type}`)}
              </span>
            )}
            {tool.domain && tool.domain !== 'general' && (
              <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 8, background: 'rgba(74,159,111,0.12)', color: '#4a9f6f' }}>
                {td(lang, `domain_${tool.domain}`)}
              </span>
            )}
            {showAiInfo && aiTool.ai_score && (
              <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 8, background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>
                AI {aiTool.ai_score}/10
              </span>
            )}
          </div>
          <h3 style={{
            fontSize: 14, fontWeight: 600, color: '#eee', margin: '0 0 4px',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {title}
          </h3>
          {showAiInfo && aiTool.ai_reason && (
            <p style={{ fontSize: 12, color: '#8b8', lineHeight: 1.5, margin: '0 0 4px',
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {aiTool.ai_reason}
            </p>
          )}
          {!showAiInfo && tool.take && (
            <p style={{ fontSize: 12, color: '#a78bfa', lineHeight: 1.5, margin: '0 0 4px',
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              💎 {tool.take}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, fontSize: 11, color: '#555', flexShrink: 0, paddingTop: 4 }}>
          {metrics.stars != null && Number(metrics.stars) > 0 && <span>⭐{String(metrics.stars)}</span>}
          {metrics.points != null && Number(metrics.points) > 0 && <span>▲{String(metrics.points)}</span>}
        </div>
      </div>
    </div>
  )
}

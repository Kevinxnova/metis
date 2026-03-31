import { Tool, AiPick } from '../../api/client'
import { Lang, td } from '../../i18n'

interface Props {
  tool: Tool | AiPick
  lang: Lang
  onBack: () => void
}

function parseMetrics(s: string): Record<string, unknown> {
  try { return JSON.parse(s) } catch { return {} }
}

export default function ToolDetail({ tool, lang, onBack }: Props) {
  const isZh = lang === 'zh'
  const metrics = parseMetrics(tool.metrics)
  const title = (isZh && tool.title_zh) ? tool.title_zh : tool.title
  const desc = (isZh && tool.description_zh) ? tool.description_zh : tool.description
  const sources = JSON.parse(tool.sources || '[]') as string[]
  const aiTool = tool as AiPick
  const hasAi = !!(aiTool.ai_reason)
  const hasTake = !!(tool.take)

  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh', color: '#fff' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px' }}>
        {/* Back button */}
        <button onClick={onBack} style={{
          background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer',
          fontSize: 14, padding: 0, marginBottom: 32, display: 'flex', alignItems: 'center', gap: 6,
        }}>
          ← {isZh ? '返回发现' : 'Back to Discover'}
        </button>

        {/* Tags */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {tool.content_type && tool.content_type !== 'other' && (
            <span style={{
              fontSize: 12, padding: '4px 12px', borderRadius: 12,
              background: 'rgba(96,165,250,0.15)', color: '#60a5fa',
            }}>
              {td(lang, `type_${tool.content_type}`)}
            </span>
          )}
          {tool.domain && tool.domain !== 'general' && (
            <span style={{
              fontSize: 12, padding: '4px 12px', borderRadius: 12,
              background: 'rgba(74,159,111,0.15)', color: '#4a9f6f',
            }}>
              {td(lang, `domain_${tool.domain}`)}
            </span>
          )}
          {sources.map(s => (
            <span key={s} style={{
              fontSize: 12, padding: '4px 12px', borderRadius: 12,
              background: 'rgba(255,255,255,0.05)', color: '#666',
            }}>
              {s}
            </span>
          ))}
        </div>

        {/* Title */}
        <h1 style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.2, margin: '0 0 8px', letterSpacing: -0.5 }}>
          {title}
        </h1>
        {isZh && tool.title_zh && (
          <p style={{ fontSize: 14, color: '#555', margin: '0 0 24px' }}>{tool.title}</p>
        )}

        {/* Metrics bar */}
        <div style={{
          display: 'flex', gap: 24, padding: '16px 0', marginBottom: 24,
          borderTop: '1px solid #1a1a1a', borderBottom: '1px solid #1a1a1a',
        }}>
          {metrics.stars != null && Number(metrics.stars) > 0 && (
            <div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>⭐ {String(metrics.stars)}</div>
              <div style={{ fontSize: 11, color: '#555' }}>Stars</div>
            </div>
          )}
          {metrics.stars_today != null && Number(metrics.stars_today) > 0 && (
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#f59e0b' }}>+{String(metrics.stars_today)}</div>
              <div style={{ fontSize: 11, color: '#555' }}>{isZh ? '今日新增' : 'Today'}</div>
            </div>
          )}
          {metrics.points != null && Number(metrics.points) > 0 && (
            <div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>▲ {String(metrics.points)}</div>
              <div style={{ fontSize: 11, color: '#555' }}>HN Points</div>
            </div>
          )}
          {metrics.comments != null && Number(metrics.comments) > 0 && (
            <div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>💬 {String(metrics.comments)}</div>
              <div style={{ fontSize: 11, color: '#555' }}>{isZh ? '评论' : 'Comments'}</div>
            </div>
          )}
          {metrics.votes != null && Number(metrics.votes) > 0 && (
            <div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>▲ {String(metrics.votes)}</div>
              <div style={{ fontSize: 11, color: '#555' }}>PH Votes</div>
            </div>
          )}
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#60a5fa' }}>
              {new Date(tool.first_seen).toLocaleDateString()}
            </div>
            <div style={{ fontSize: 11, color: '#555' }}>{isZh ? '首次发现' : 'First Seen'}</div>
          </div>
        </div>

        {/* AI Recommendation (only if from AI picks) */}
        {hasAi && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(96,165,250,0.1), rgba(139,92,246,0.08))',
            border: '1px solid rgba(96,165,250,0.2)',
            borderRadius: 12, padding: 20, marginBottom: 16,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 12, color: '#60a5fa', fontWeight: 600 }}>
                🤖 {isZh ? 'AI 推荐理由' : 'AI Recommendation'}
              </span>
              {aiTool.ai_score && (
                <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 8, background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
                  {aiTool.ai_score}/10
                </span>
              )}
            </div>
            <p style={{ fontSize: 14, color: '#ccc', lineHeight: 1.7, margin: '0 0 12px' }}>
              {aiTool.ai_reason}
            </p>
            <div style={{ fontSize: 12, color: '#8b8', fontWeight: 600, marginBottom: 6 }}>
              {isZh ? '💡 适用场景' : '💡 Use Cases'}
            </div>
            <p style={{ fontSize: 13, color: '#aaa', lineHeight: 1.7, margin: 0 }}>
              {aiTool.ai_use_cases}
            </p>
          </div>
        )}

        {/* Admin take (only if the admin wrote one) */}
        {hasTake && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(139,92,246,0.06), rgba(167,139,250,0.04))',
            border: '1px solid rgba(139,92,246,0.12)',
            borderRadius: 12, padding: 20, marginBottom: 24,
          }}>
            <div style={{ fontSize: 12, color: '#a78bfa', fontWeight: 600, marginBottom: 8 }}>
              💎 {isZh ? 'Metis 点评' : 'Metis Review'}
            </div>
            <p style={{ fontSize: 14, color: '#bbb', lineHeight: 1.7, margin: 0 }}>
              {tool.take}
            </p>
          </div>
        )}

        {/* Description */}
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: '#999', marginBottom: 12 }}>
            {isZh ? '简介' : 'Description'}
          </h2>
          <p style={{ fontSize: 15, color: '#ccc', lineHeight: 1.8, margin: 0 }}>
            {desc || (isZh ? '暂无详细描述。' : 'No description available.')}
          </p>
        </div>

        {/* CTA */}
        <a
          href={tool.url}
          target="_blank"
          rel="noopener"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'linear-gradient(135deg, #60a5fa, #a78bfa)',
            color: '#fff', padding: '12px 24px', borderRadius: 8,
            textDecoration: 'none', fontSize: 14, fontWeight: 600,
            transition: 'opacity 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '0.85' }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
        >
          {isZh ? '访问项目 →' : 'Visit Project →'}
        </a>
        {tool.source_url && tool.source_url !== tool.url && (
          <a
            href={tool.source_url}
            target="_blank"
            rel="noopener"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              color: '#60a5fa', padding: '12px 16px',
              textDecoration: 'none', fontSize: 14, marginLeft: 8,
            }}
          >
            {isZh ? '查看来源' : 'View Source'}
          </a>
        )}
      </div>
    </div>
  )
}

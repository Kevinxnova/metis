import { Tool } from '../../api/client'
import { Lang, td } from '../../i18n'

interface Props {
  tool: Tool
  lang: Lang
  onBack: () => void
}

function parseMetrics(s: string): Record<string, unknown> {
  try { return JSON.parse(s) } catch { return {} }
}

function generateRecommendation(tool: Tool, lang: Lang): string {
  const metrics = parseMetrics(tool.metrics)
  const parts: string[] = []

  if (lang === 'zh') {
    // Source credibility
    const sources = JSON.parse(tool.sources || '[]') as string[]
    if (sources.length > 1) {
      parts.push(`在 ${sources.join('、')} 等 ${sources.length} 个平台同时被发现，说明关注度很高。`)
    }

    // Metrics
    if (metrics.stars && Number(metrics.stars) > 1000) {
      parts.push(`GitHub ${metrics.stars} 星，社区认可度高。`)
    } else if (metrics.stars && Number(metrics.stars) > 100) {
      parts.push(`GitHub ${metrics.stars} 星，处于快速增长期。`)
    }
    if (metrics.points && Number(metrics.points) > 100) {
      parts.push(`Hacker News ${metrics.points} 分，引发了热烈讨论。`)
    }
    if (metrics.votes && Number(metrics.votes) > 200) {
      parts.push(`Product Hunt ${metrics.votes} 票，受到产品社区关注。`)
    }

    // Type-specific
    if (tool.content_type === 'model') {
      parts.push('作为AI模型，可能会改变你处理特定任务的方式。')
    } else if (tool.content_type === 'tool') {
      parts.push('作为开发工具，可以直接提升你的日常工作效率。')
    } else if (tool.content_type === 'library') {
      parts.push('作为代码库，可以在你的项目中直接使用。')
    } else if (tool.content_type === 'article') {
      parts.push('这篇内容值得花时间阅读，可能会带来新的思路。')
    }

    if (parts.length === 0) parts.push('这是一个值得关注的新发现。')
  } else {
    const sources = JSON.parse(tool.sources || '[]') as string[]
    if (sources.length > 1) {
      parts.push(`Spotted on ${sources.length} platforms (${sources.join(', ')}), indicating significant attention.`)
    }
    if (metrics.stars && Number(metrics.stars) > 1000) {
      parts.push(`${metrics.stars} GitHub stars shows strong community adoption.`)
    } else if (metrics.stars && Number(metrics.stars) > 100) {
      parts.push(`${metrics.stars} GitHub stars and growing fast.`)
    }
    if (metrics.points && Number(metrics.points) > 100) {
      parts.push(`${metrics.points} points on Hacker News with active discussion.`)
    }
    if (metrics.votes && Number(metrics.votes) > 200) {
      parts.push(`${metrics.votes} votes on Product Hunt.`)
    }
    if (tool.content_type === 'model') {
      parts.push('As an AI model, this could change how you approach specific tasks.')
    } else if (tool.content_type === 'tool') {
      parts.push('A dev tool that can directly boost your daily productivity.')
    } else if (tool.content_type === 'library') {
      parts.push('A library you can integrate directly into your projects.')
    } else if (tool.content_type === 'article') {
      parts.push('Worth the read — may bring new perspectives.')
    }
    if (parts.length === 0) parts.push('A noteworthy new find.')
  }

  return parts.join(' ')
}

export default function ToolDetail({ tool, lang, onBack }: Props) {
  const isZh = lang === 'zh'
  const metrics = parseMetrics(tool.metrics)
  const title = (isZh && tool.title_zh) ? tool.title_zh : tool.title
  const desc = (isZh && tool.description_zh) ? tool.description_zh : tool.description
  const sources = JSON.parse(tool.sources || '[]') as string[]
  const recommendation = generateRecommendation(tool, lang)

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
          {metrics.stars != null && (
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
          {metrics.points != null && (
            <div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>▲ {String(metrics.points)}</div>
              <div style={{ fontSize: 11, color: '#555' }}>HN Points</div>
            </div>
          )}
          {metrics.comments != null && (
            <div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>💬 {String(metrics.comments)}</div>
              <div style={{ fontSize: 11, color: '#555' }}>{isZh ? '评论' : 'Comments'}</div>
            </div>
          )}
          {metrics.votes != null && (
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

        {/* Recommendation */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(96,165,250,0.08), rgba(167,139,250,0.08))',
          border: '1px solid rgba(96,165,250,0.15)',
          borderRadius: 12, padding: 20, marginBottom: 24,
        }}>
          <div style={{ fontSize: 12, color: '#60a5fa', fontWeight: 600, marginBottom: 8 }}>
            {isZh ? '💡 Metis 推荐理由' : '💡 Why Metis Picked This'}
          </div>
          <p style={{ fontSize: 14, color: '#bbb', lineHeight: 1.7, margin: 0 }}>
            {recommendation}
          </p>
        </div>

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

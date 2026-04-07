import { useState, useEffect } from 'react'
import { api, UserMessage } from '../api/client'
import { Lang } from '../i18n'

export default function Community({ lang }: { lang: Lang }) {
  const isZh = lang === 'zh'
  const [messages, setMessages] = useState<UserMessage[]>([])
  const [content, setContent] = useState('')
  const [nickname, setNickname] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    api.getMessages().then(setMessages).catch(() => {})
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return
    setSending(true)
    try {
      await api.postMessage(content, nickname)
      setContent('')
      setSent(true)
      setTimeout(() => setSent(false), 3000)
      const msgs = await api.getMessages()
      setMessages(msgs)
    } catch { /* ignore */ }
    setSending(false)
  }

  return (
    <div style={{ background: 'var(--bg-primary)', minHeight: '100vh', color: 'var(--text-primary)' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px' }}>

        <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 48 }}>
          <a href="/discover" style={{
            fontSize: 22, fontWeight: 700, letterSpacing: -1, textDecoration: 'none',
            background: 'linear-gradient(135deg, #60a5fa, #a78bfa)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            Metis
          </a>
          <a href="/discover" style={{ fontSize: 13, color: 'var(--accent-blue)', textDecoration: 'none' }}>
            ← {isZh ? '返回发现' : 'Back'}
          </a>
        </nav>

        <h1 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 8px', letterSpacing: -0.5 }}>
          {isZh ? '💬 社区之声' : '💬 Community Voice'}
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 32 }}>
          {isZh
            ? '分享你想了解的 AI 工具、你的发现、或任何想法'
            : 'Share what AI tools you want to find, your discoveries, or any thoughts'}
        </p>

        {/* Input form */}
        <form onSubmit={handleSubmit} style={{
          background: 'var(--bg-hover)', border: '1px solid var(--border-subtle)',
          borderRadius: 12, padding: 20, marginBottom: 40,
        }}>
          <input
            value={nickname}
            onChange={e => setNickname(e.target.value)}
            placeholder={isZh ? '你的昵称（选填）' : 'Your nickname (optional)'}
            style={{
              width: '100%', padding: 10, fontSize: 14, borderRadius: 8,
              border: '1px solid var(--border-input)', background: 'var(--bg-input)',
              color: 'var(--text-secondary)', marginBottom: 10, boxSizing: 'border-box', outline: 'none',
            }}
          />
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder={isZh
              ? '例如：想找一个能自动生成 API 文档的工具...\n或者：推荐大家试试这个新的代码审查工具...'
              : 'e.g., Looking for a tool that auto-generates API docs...\nOr: Check out this new code review tool I found...'}
            rows={4}
            style={{
              width: '100%', padding: 10, fontSize: 14, borderRadius: 8,
              border: '1px solid var(--border-input)', background: 'var(--bg-input)',
              color: 'var(--text-secondary)', marginBottom: 12, boxSizing: 'border-box', resize: 'vertical',
              fontFamily: 'inherit', outline: 'none',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: sent ? '#4a9' : 'transparent' }}>
              {isZh ? '已提交，感谢分享！' : 'Submitted, thanks for sharing!'}
            </span>
            <button type="submit" disabled={sending || !content.trim()} style={{
              padding: '8px 24px', fontSize: 14, fontWeight: 600, borderRadius: 8,
              border: 'none', cursor: 'pointer',
              background: content.trim() ? 'linear-gradient(135deg, #60a5fa, #a78bfa)' : 'var(--text-dim)',
              color: 'var(--text-primary)',
            }}>
              {sending ? (isZh ? '提交中...' : 'Submitting...') : (isZh ? '提交' : 'Submit')}
            </button>
          </div>
        </form>

        {/* Messages carousel / list */}
        <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-body)', marginBottom: 16 }}>
          {isZh ? '大家在说' : 'What people are saying'}
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {messages.length === 0 && (
            <p style={{ color: 'var(--text-dim)', textAlign: 'center', padding: 32 }}>
              {isZh ? '还没有留言，成为第一个分享的人吧！' : 'No messages yet. Be the first to share!'}
            </p>
          )}
          {messages.map(m => (
            <div key={m.id} style={{
              background: 'var(--bg-hover)', border: '1px solid var(--border-card)',
              borderRadius: 10, padding: 16,
              boxShadow: 'var(--shadow-card)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#a78bfa' }}>
                  {m.nickname || (isZh ? '匿名用户' : 'Anonymous')}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                  {new Date(m.created_at).toLocaleDateString()}
                </span>
              </div>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
                {m.content}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

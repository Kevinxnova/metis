import { useState, useEffect } from 'react'
import ScrapeHealth from '../components/ScrapeHealth'
import ToolFeed from '../components/ToolFeed'
import NewsletterPreview from '../components/NewsletterPreview'
import { Lang, t } from '../i18n'
import { ToolFilters } from '../hooks/useTools'
import { api } from '../api/client'

function AdminLogin({ onAuth, lang }: { onAuth: () => void; lang: Lang }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const isZh = lang === 'zh'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await api.verifyAdmin(password)
      sessionStorage.setItem('metis-admin-password', password)
      onAuth()
    } catch {
      setError(isZh ? '密码错误' : 'Wrong password')
    }
  }

  return (
    <div style={{
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      minHeight: '100vh', background: '#fafafa',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <form onSubmit={handleSubmit} style={{
        background: 'white', padding: 32, borderRadius: 12,
        border: '1px solid #e0e0e0', width: 320, textAlign: 'center',
      }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Metis Admin</h2>
        <p style={{ fontSize: 13, color: '#999', marginBottom: 20 }}>
          {isZh ? '请输入管理密码' : 'Enter admin password'}
        </p>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder={isZh ? '密码' : 'Password'}
          autoFocus
          style={{
            width: '100%', padding: 10, fontSize: 14, borderRadius: 6,
            border: '1px solid #ddd', marginBottom: 12, boxSizing: 'border-box',
          }}
        />
        {error && <p style={{ color: '#e55', fontSize: 13, margin: '0 0 12px' }}>{error}</p>}
        <button type="submit" style={{
          width: '100%', padding: 10, fontSize: 14, fontWeight: 600,
          background: '#333', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer',
        }}>
          {isZh ? '进入' : 'Enter'}
        </button>
      </form>
    </div>
  )
}

export default function Admin({ lang }: { lang: Lang }) {
  const [authed, setAuthed] = useState(false)
  const [checking, setChecking] = useState(true)
  const [filters, setFilters] = useState<ToolFilters>({})

  useEffect(() => {
    const password = sessionStorage.getItem('metis-admin-password')
    if (!password) {
      setChecking(false)
      return
    }
    api.verifyAdmin(password)
      .then(() => setAuthed(true))
      .catch(() => sessionStorage.removeItem('metis-admin-password'))
      .finally(() => setChecking(false))
  }, [])

  if (checking) return null

  if (!authed) {
    return <AdminLogin onAuth={() => setAuthed(true)} lang={lang} />
  }

  return (
    <div style={{
      fontFamily: 'system-ui, -apple-system, sans-serif',
      background: '#fafafa', minHeight: '100vh', padding: 24,
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid #ddd',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: -0.5, margin: 0 }}>
            {t(lang, 'title')}
          </h1>
          <span style={{
            fontSize: 10, padding: '2px 8px', borderRadius: 4,
            background: '#f0f0f0', color: '#999', textTransform: 'uppercase',
          }}>
            {lang === 'zh' ? '管理后台' : 'Admin'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => {
              sessionStorage.removeItem('metis-admin-password')
              setAuthed(false)
            }}
            style={{
              fontSize: 13, color: '#666', background: 'white', cursor: 'pointer',
              padding: '4px 12px', border: '1px solid #ddd', borderRadius: 4,
            }}
          >
            {lang === 'zh' ? '退出' : 'Sign out'}
          </button>
          <a href="/discover" style={{
            fontSize: 13, color: '#666', textDecoration: 'none',
            padding: '4px 12px', border: '1px solid #ddd', borderRadius: 4,
          }}>
            {lang === 'zh' ? '← 返回发现页' : '← Back to Discover'}
          </a>
        </div>
      </div>

      <ScrapeHealth lang={lang} />

      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24,
      }}>
        <ToolFeed lang={lang} filters={filters} onFiltersChange={setFilters} />
        <NewsletterPreview lang={lang} filters={filters} />
      </div>
    </div>
  )
}

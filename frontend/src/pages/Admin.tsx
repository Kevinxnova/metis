import { useState } from 'react'
import ScrapeHealth from '../components/ScrapeHealth'
import ToolFeed from '../components/ToolFeed'
import NewsletterPreview from '../components/NewsletterPreview'
import { Lang, t } from '../i18n'
import { ToolFilters } from '../hooks/useTools'

export default function Admin({ lang }: { lang: Lang }) {
  const [filters, setFilters] = useState<ToolFilters>({})

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
        <a href="/discover" style={{
          fontSize: 13, color: '#666', textDecoration: 'none',
          padding: '4px 12px', border: '1px solid #ddd', borderRadius: 4,
        }}>
          {lang === 'zh' ? '← 返回发现页' : '← Back to Discover'}
        </a>
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

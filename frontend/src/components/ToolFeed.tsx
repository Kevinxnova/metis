import { useState, useEffect, useRef } from 'react'
import { useTools, ToolFilters } from '../hooks/useTools'
import ToolCard from './ToolCard'
import { api, CategoryCounts } from '../api/client'
import { Lang, t, td } from '../i18n'

const TYPE_KEYS = ['tool', 'library', 'model', 'api', 'article', 'other'] as const
const DOMAIN_KEYS = ['ai', 'web', 'devops', 'data', 'security', 'design', 'general'] as const

function FilterPill({ label, active, count, onClick }: {
  label: string; active: boolean; count?: number; onClick: () => void
}) {
  return (
    <button onClick={onClick} style={{
      padding: '3px 10px', fontSize: 12, borderRadius: 12, cursor: 'pointer',
      border: `1px solid ${active ? '#333' : '#e0e0e0'}`,
      background: active ? '#333' : 'white',
      color: active ? 'white' : '#666',
      whiteSpace: 'nowrap',
    }}>
      {label}{count != null ? ` ${count}` : ''}
    </button>
  )
}

interface Props {
  lang: Lang
  filters: ToolFilters
  onFiltersChange: (filters: ToolFilters) => void
}

export default function ToolFeed({ lang, filters, onFiltersChange }: Props) {
  const [counts, setCounts] = useState<CategoryCounts | null>(null)
  const [translating, setTranslating] = useState(false)
  const translatedRef = useRef(false)

  const { tools, loading, error, updateTool, refresh } = useTools(filters)

  useEffect(() => {
    api.getCategories().then(setCounts).catch(() => {})
  }, [tools.length])

  // Auto-translate when switching to Chinese
  useEffect(() => {
    if (lang !== 'zh' || translatedRef.current || tools.length === 0) return
    const needsTranslation = tools.some(t => !t.title_zh)
    if (!needsTranslation) return

    setTranslating(true)
    translatedRef.current = true
    api.translateBatch(50).then(() => {
      refresh()
    }).finally(() => {
      setTranslating(false)
    })
  }, [lang, tools.length])

  const setFilter = (key: keyof ToolFilters, value: string | undefined) => {
    onFiltersChange({ ...filters, [key]: value })
  }

  return (
    <div>
      {/* Status filter row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
        {[
          { key: undefined, label: t(lang, 'allTools') },
          { key: 'pending', label: t(lang, 'pending') },
          { key: 'approved', label: t(lang, 'approved') },
          { key: 'skipped', label: t(lang, 'skipped') },
        ].map(f => (
          <button
            key={f.key ?? 'all'}
            onClick={() => setFilter('status', f.key)}
            style={{
              padding: '4px 12px', fontSize: 13, borderRadius: 4, cursor: 'pointer',
              border: `1px solid ${filters.status === f.key ? '#333' : '#ddd'}`,
              background: filters.status === f.key ? '#333' : 'white',
              color: filters.status === f.key ? 'white' : '#666',
            }}
          >
            {f.label}
          </button>
        ))}
        {translating && (
          <span style={{ fontSize: 12, color: '#f90' }}>{t(lang, 'translating')}</span>
        )}
      </div>

      {/* Content type filter row */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: '#999', minWidth: 36 }}>{t(lang, 'filterType')}</span>
        <FilterPill
          label={t(lang, 'type_all')}
          active={!filters.content_type}
          onClick={() => setFilter('content_type', undefined)}
        />
        {TYPE_KEYS.map(k => (
          <FilterPill
            key={k}
            label={td(lang, `type_${k}`)}
            active={filters.content_type === k}
            count={counts?.by_type[k]}
            onClick={() => setFilter('content_type', filters.content_type === k ? undefined : k)}
          />
        ))}
      </div>

      {/* Domain filter row */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: '#999', minWidth: 36 }}>{t(lang, 'filterDomain')}</span>
        <FilterPill
          label={t(lang, 'domain_all')}
          active={!filters.domain}
          onClick={() => setFilter('domain', undefined)}
        />
        {DOMAIN_KEYS.map(k => (
          <FilterPill
            key={k}
            label={td(lang, `domain_${k}`)}
            active={filters.domain === k}
            count={counts?.by_domain[k]}
            onClick={() => setFilter('domain', filters.domain === k ? undefined : k)}
          />
        ))}
      </div>

      {loading && <p style={{ color: '#999' }}>{t(lang, 'loading')}</p>}
      {error && <p style={{ color: '#e55' }}>{t(lang, 'errorPrefix')}{error}</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {tools.map(tool => (
          <ToolCard key={tool.id} tool={tool} onAction={updateTool} lang={lang} />
        ))}
        {!loading && tools.length === 0 && (
          <p style={{ color: '#999', textAlign: 'center', padding: 32 }}>
            {t(lang, 'noTools')}
          </p>
        )}
      </div>
    </div>
  )
}

import { useState } from 'react'
import { useTools } from '../hooks/useTools'
import ToolCard from './ToolCard'
import { Lang, t } from '../i18n'

export default function ToolFeed({ lang }: { lang: Lang }) {
  const [filter, setFilter] = useState<string | undefined>(undefined)
  const { tools, loading, error, updateTool } = useTools(filter)

  const counts = {
    all: tools.length,
    pending: tools.filter(t => t.status === 'pending').length,
    approved: tools.filter(t => t.status === 'approved').length,
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[
          { key: undefined, label: `${t(lang, 'allTools')} (${counts.all})` },
          { key: 'pending', label: `${t(lang, 'pending')} (${counts.pending})` },
          { key: 'approved', label: `${t(lang, 'approved')} (${counts.approved})` },
          { key: 'skipped', label: t(lang, 'skipped') },
        ].map(f => (
          <button
            key={f.key ?? 'all'}
            onClick={() => setFilter(f.key)}
            style={{
              padding: '4px 12px', fontSize: 13, borderRadius: 4, cursor: 'pointer',
              border: `1px solid ${filter === f.key ? '#333' : '#ddd'}`,
              background: filter === f.key ? '#333' : 'white',
              color: filter === f.key ? 'white' : '#666',
            }}
          >
            {f.label}
          </button>
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

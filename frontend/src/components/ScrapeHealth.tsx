import { useState, useEffect } from 'react'
import { api, ScrapeRun } from '../api/client'

export default function ScrapeHealth() {
  const [scrapes, setScrapes] = useState<ScrapeRun[]>([])

  useEffect(() => {
    api.getScrapeStatus().then(d => setScrapes(d.scrapes)).catch(() => {})
  }, [])

  if (scrapes.length === 0) return null

  return (
    <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#888', marginBottom: 16 }}>
      {scrapes.map(s => {
        const isOk = s.status === 'success'
        const time = new Date(s.ran_at).toLocaleString()
        return (
          <span key={s.source} style={{ color: isOk ? '#4a9' : '#e55' }}>
            {isOk ? '●' : '✗'} {s.source}: {s.tools_found} found ({time})
            {s.error_message && <span title={s.error_message}> ⚠</span>}
          </span>
        )
      })}
    </div>
  )
}

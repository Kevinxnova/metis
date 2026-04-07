import { useState, useEffect, useMemo } from 'react'
import { api, DailyNews as DailyNewsType, DailyNewsMeta } from '../api/client'
import { Lang, t } from '../i18n'

const TAG_COLORS: Record<string, string> = {
  '模型发布': '#f472b6',
  '融资': '#fbbf24',
  '开源': '#34d399',
  '产品': '#60a5fa',
  '政策': '#f87171',
  '研究': '#a78bfa',
  '工具': '#38bdf8',
}

function formatDate(dateStr: string, lang: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  if (lang === 'zh') {
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
  }
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

function getLocalToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const tagLabel = (tag: string, lang: string): string => {
  const map: Record<string, Record<string, string>> = {
    '模型发布': { zh: '模型发布', en: 'Model' },
    '融资': { zh: '融资', en: 'Funding' },
    '开源': { zh: '开源', en: 'Open Source' },
    '产品': { zh: '产品', en: 'Product' },
    '政策': { zh: '政策', en: 'Policy' },
    '研究': { zh: '研究', en: 'Research' },
    '工具': { zh: '工具', en: 'Tool' },
  }
  return map[tag]?.[lang] || tag
}

const MONTHS_ZH = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']
const MONTHS_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// ─── Year Overview Calendar ──────────────────────────────────────────────────

interface YearOverviewProps {
  publishedDates: Set<string>
  currentDate: string
  onSelectDate: (date: string) => void
  lang: Lang
}

function YearOverview({ publishedDates, currentDate, onSelectDate, lang }: YearOverviewProps) {
  const today = getLocalToday()
  const year = 2026
  const months = lang === 'zh' ? MONTHS_ZH : MONTHS_EN

  // Build calendar: 12 months, each with its days
  const calendar = useMemo(() => {
    const result: { month: number; label: string; days: { date: string; dayOfMonth: number }[] }[] = []
    for (let m = 0; m < 12; m++) {
      const daysInMonth = new Date(year, m + 1, 0).getDate()
      const days: { date: string; dayOfMonth: number }[] = []
      for (let d = 1; d <= daysInMonth; d++) {
        const dateObj = new Date(year, m, d)
        days.push({ date: toDateStr(dateObj), dayOfMonth: d })
      }
      result.push({ month: m, label: months[m], days })
    }
    return result
  }, [lang])

  const publishedCount = publishedDates.size

  return (
    <div style={{
      background: '#0a0a1a',
      borderRadius: 12,
      padding: '20px 20px 16px',
      border: '1px solid #1a1a2e',
      marginBottom: 32,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#e0e0e0' }}>
            {year} {lang === 'zh' ? '年度概览' : 'Overview'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
            background: '#fff',
            boxShadow: '0 0 6px 2px rgba(167,139,250,0.5), 0 0 12px 4px rgba(96,165,250,0.3)',
          }} />
          <span style={{ fontSize: 11, color: '#666' }}>
            {publishedCount} {lang === 'zh' ? '期已发布' : publishedCount === 1 ? 'issue' : 'issues'}
          </span>
        </div>
      </div>

      {/* Calendar grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(12, 1fr)',
        gap: 4,
      }}>
        {calendar.map(({ month, label, days }) => (
          <div key={month} style={{ minWidth: 0 }}>
            {/* Month label */}
            <div style={{
              fontSize: 9, textAlign: 'center',
              marginBottom: 4, letterSpacing: 0.5,
              fontWeight: month === new Date().getMonth() ? 600 : 400,
              color: month === new Date().getMonth() ? '#888' : '#444',
            }}>
              {label}
            </div>
            {/* Days grid: wrap circles in rows */}
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: 1.5,
              justifyContent: 'center',
            }}>
              {days.map(({ date }) => {
                const isPublished = publishedDates.has(date)
                const isSelected = date === currentDate
                const isToday = date === today
                const isFuture = date > today
                const isPast = date < today

                return (
                  <div
                    key={date}
                    onClick={isPublished ? () => onSelectDate(date) : undefined}
                    title={`${date}${isPublished ? (lang === 'zh' ? ' (已发布)' : ' (published)') : ''}`}
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      cursor: isPublished ? 'pointer' : 'default',
                      transition: 'all 0.2s ease',
                      position: 'relative',
                      // Base styles by state
                      ...(isPublished ? {
                        background: '#fff',
                        boxShadow: isSelected
                          ? '0 0 8px 3px rgba(167,139,250,0.7), 0 0 16px 6px rgba(96,165,250,0.4)'
                          : '0 0 4px 1px rgba(167,139,250,0.4), 0 0 8px 3px rgba(96,165,250,0.2)',
                      } : isToday ? {
                        background: 'transparent',
                        boxShadow: '0 0 0 1px rgba(167,139,250,0.5) inset',
                      } : isFuture ? {
                        background: 'rgba(255,255,255,0.03)',
                      } : isPast ? {
                        background: 'rgba(255,255,255,0.06)',
                      } : {
                        background: 'rgba(255,255,255,0.06)',
                      }),
                    }}
                  />
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function DailyNews({ lang }: { lang: Lang }) {
  const [news, setNews] = useState<DailyNewsType | null>(null)
  const [availableDates, setAvailableDates] = useState<string[]>([])
  const [dateIndex, setDateIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const isZh = lang === 'zh'

  // Load available dates on mount
  useEffect(() => {
    api.getDailyNewsList(365, 0)
      .then(list => {
        const dates = list.map((m: DailyNewsMeta) => m.news_date)
        setAvailableDates(dates)
        if (dates.length > 0) {
          setDateIndex(0)
        }
      })
      .catch(() => setAvailableDates([]))
  }, [])

  // Load news when dateIndex changes
  useEffect(() => {
    if (availableDates.length === 0) {
      setLoading(true)
      api.getDailyNews()
        .then(data => { setNews(data); setLoading(false) })
        .catch(() => { setNews(null); setError(true); setLoading(false) })
      return
    }

    const date = availableDates[dateIndex]
    if (!date) return

    setLoading(true)
    setError(false)
    api.getDailyNews(date)
      .then(data => { setNews(data); setLoading(false) })
      .catch(() => { setNews(null); setError(true); setLoading(false) })
  }, [dateIndex, availableDates])

  const goPrev = () => {
    if (dateIndex < availableDates.length - 1) setDateIndex(i => i + 1)
  }

  const goNext = () => {
    if (dateIndex > 0) setDateIndex(i => i - 1)
  }

  const handleCalendarSelect = (date: string) => {
    const idx = availableDates.indexOf(date)
    if (idx >= 0) setDateIndex(idx)
  }

  const hasPrev = dateIndex < availableDates.length - 1
  const hasNext = dateIndex > 0
  const currentDate = availableDates[dateIndex] || news?.news_date || getLocalToday()
  const publishedSet = useMemo(() => new Set(availableDates), [availableDates])

  return (
    <div style={{ background: '#050510', minHeight: '100vh', color: '#fff' }}>
      {/* Header */}
      <header style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <a href="/discover" style={{ color: '#666', textDecoration: 'none', fontSize: 13 }}>
            ← {isZh ? '返回' : 'Back'}
          </a>
          <a href="/" style={{ textDecoration: 'none' }}>
            <span style={{
              fontSize: 20, fontWeight: 700,
              background: 'linear-gradient(135deg, #60a5fa, #a78bfa, #f472b6)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>Metis</span>
          </a>
        </div>

        <h1 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 4px' }}>
          {t(lang, 'dailyNews')}
        </h1>
        <p style={{ color: '#666', fontSize: 14, margin: '0 0 20px' }}>
          {t(lang, 'dailyNewsSubtitle')}
        </p>

        {/* Year Overview Calendar */}
        <YearOverview
          publishedDates={publishedSet}
          currentDate={currentDate}
          onSelectDate={handleCalendarSelect}
          lang={lang}
        />

        {/* Date Navigation */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32,
          padding: '8px 0', borderBottom: '1px solid #1a1a2e',
        }}>
          <button
            onClick={goPrev}
            disabled={!hasPrev}
            style={{ ...navBtnStyle, opacity: hasPrev ? 1 : 0.3, cursor: hasPrev ? 'pointer' : 'default' }}
          >{'<'}</button>
          <span style={{ fontSize: 15, color: '#ccc', minWidth: 160, textAlign: 'center' }}>
            {formatDate(currentDate, lang)}
          </span>
          <button
            onClick={goNext}
            disabled={!hasNext}
            style={{ ...navBtnStyle, opacity: hasNext ? 1 : 0.3, cursor: hasNext ? 'pointer' : 'default' }}
          >{'>'}</button>
          {availableDates.length > 0 && (
            <span style={{ fontSize: 12, color: '#444' }}>
              {dateIndex + 1} / {availableDates.length}
            </span>
          )}
        </div>
      </header>

      {/* Content */}
      <main style={{ maxWidth: 720, margin: '0 auto', padding: '0 24px 64px' }}>
        {loading ? (
          <p style={{ color: '#555', textAlign: 'center', padding: 48 }}>
            {isZh ? '加载中...' : 'Loading...'}
          </p>
        ) : error || !news ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <p style={{ color: '#555', fontSize: 18, marginBottom: 8 }}>{t(lang, 'noNewsToday')}</p>
            <p style={{ color: '#333', fontSize: 13 }}>{t(lang, 'noNewsDesc')}</p>
          </div>
        ) : (
          <>
            {/* Headlines */}
            <section style={{ marginBottom: 40 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16, color: '#e0e0e0' }}>
                {t(lang, 'headlines')}
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {news.headlines.map((h, i) => (
                  <div key={i} style={cardStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{
                        fontSize: 11, padding: '2px 8px', borderRadius: 4,
                        background: (TAG_COLORS[h.tag] || '#666') + '22',
                        color: TAG_COLORS[h.tag] || '#888',
                        fontWeight: 600,
                      }}>
                        {tagLabel(h.tag, lang)}
                      </span>
                      <span style={{ color: '#555', fontSize: 12 }}>{h.source}</span>
                    </div>
                    <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 8px', lineHeight: 1.4 }}>
                      {isZh ? h.title : h.title_en}
                    </h3>
                    <p style={{ color: '#999', fontSize: 14, lineHeight: 1.6, margin: '0 0 12px' }}>
                      {isZh ? h.summary : h.summary_en}
                    </p>
                    {h.source_url && (
                      <a
                        href={h.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#60a5fa', fontSize: 12, textDecoration: 'none' }}
                      >
                        {t(lang, 'viewSource')} →
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Quick Bites */}
            {news.quick_bites.length > 0 && (
              <section style={{ marginBottom: 40 }}>
                <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16, color: '#e0e0e0' }}>
                  {t(lang, 'quickBites')}
                </h2>
                <div style={{
                  background: '#0a0a1a', borderRadius: 8, padding: 16,
                  border: '1px solid #1a1a2e',
                }}>
                  {news.quick_bites.map((qb, i) => (
                    <div key={i} style={{
                      padding: '10px 0',
                      borderBottom: i < news.quick_bites.length - 1 ? '1px solid #1a1a2e' : 'none',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12,
                    }}>
                      <span style={{ color: '#ccc', fontSize: 14, lineHeight: 1.5 }}>
                        {isZh ? qb.text : qb.text_en}
                      </span>
                      <a
                        href={qb.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#555', fontSize: 12, flexShrink: 0, textDecoration: 'none' }}
                      >
                        {qb.source}
                      </a>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Editor's Take */}
            {(news.editor_take || news.editor_take_en) && (
              <section style={{ marginBottom: 40 }}>
                <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16, color: '#e0e0e0' }}>
                  {t(lang, 'editorTake')}
                </h2>
                <div style={{
                  background: 'linear-gradient(135deg, rgba(96,165,250,0.08), rgba(167,139,250,0.08))',
                  borderRadius: 8, padding: 20,
                  borderLeft: '3px solid #a78bfa',
                }}>
                  <p style={{ color: '#bbb', fontSize: 14, lineHeight: 1.8, margin: 0 }}>
                    {isZh ? news.editor_take : news.editor_take_en}
                  </p>
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}

const navBtnStyle: React.CSSProperties = {
  background: 'none', border: '1px solid #2a2a3a', borderRadius: 6,
  color: '#999', fontSize: 16, padding: '4px 12px', cursor: 'pointer',
}

const cardStyle: React.CSSProperties = {
  background: '#0a0a1a', borderRadius: 8, padding: 20,
  border: '1px solid #1a1a2e',
}

import { useState } from 'react'
import ScrapeHealth from './components/ScrapeHealth'
import ToolFeed from './components/ToolFeed'
import NewsletterPreview from './components/NewsletterPreview'
import { Lang, t, getSavedLang, saveLang } from './i18n'

export default function App() {
  const [lang, setLang] = useState<Lang>(getSavedLang)

  const toggleLang = () => {
    const next = lang === 'zh' ? 'en' : 'zh'
    setLang(next)
    saveLang(next)
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
        <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: -0.5, margin: 0 }}>
          {t(lang, 'title')}
        </h1>
        <button onClick={toggleLang} style={{
          padding: '4px 12px', fontSize: 13, borderRadius: 4, cursor: 'pointer',
          border: '1px solid #ddd', background: 'white', color: '#666',
        }}>
          {t(lang, 'switchLang')}
        </button>
      </div>

      <ScrapeHealth lang={lang} />

      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24,
      }}>
        <ToolFeed lang={lang} />
        <NewsletterPreview lang={lang} />
      </div>
    </div>
  )
}

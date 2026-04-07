import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing'
import Discover from './pages/Discover'
import Admin from './pages/Admin'
import Community from './pages/Community'
import DailyNews from './pages/DailyNews'
import { Lang, getSavedLang, saveLang } from './i18n'
import { Theme, getSavedTheme, saveTheme, applyTheme } from './theme'

export default function App() {
  const [lang, setLang] = useState<Lang>(getSavedLang)
  const [theme, setTheme] = useState<Theme>(getSavedTheme)

  useEffect(() => { applyTheme(theme) }, [theme])

  const toggleLang = () => {
    const next = lang === 'zh' ? 'en' : 'zh'
    setLang(next)
    saveLang(next)
  }

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    saveTheme(next)
  }

  return (
    <BrowserRouter>
      {/* Global controls */}
      <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 100, display: 'flex', gap: 6 }}>
        <button onClick={toggleTheme} style={{
          padding: '6px 14px', fontSize: 13, borderRadius: 20, cursor: 'pointer',
          border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)',
          color: 'var(--text-body)', backdropFilter: 'blur(8px)',
          transition: 'all 0.3s ease',
        }}>
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
        <button onClick={toggleLang} style={{
          padding: '6px 14px', fontSize: 13, borderRadius: 20, cursor: 'pointer',
          border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)',
          color: 'var(--text-body)', backdropFilter: 'blur(8px)',
          transition: 'all 0.3s ease',
        }}>
          {lang === 'zh' ? 'EN' : '中文'}
        </button>
      </div>

      <Routes>
        <Route path="/" element={<Landing lang={lang} />} />
        <Route path="/discover" element={<Discover lang={lang} />} />
        <Route path="/community" element={<Community lang={lang} />} />
        <Route path="/daily-news" element={<DailyNews lang={lang} />} />
        <Route path="/admin" element={<Admin lang={lang} />} />
      </Routes>
    </BrowserRouter>
  )
}

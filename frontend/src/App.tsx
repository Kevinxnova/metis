import { useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Discover from './pages/Discover'
import Admin from './pages/Admin'
import { Lang, getSavedLang, saveLang } from './i18n'

export default function App() {
  const [lang, setLang] = useState<Lang>(getSavedLang)

  const toggleLang = () => {
    const next = lang === 'zh' ? 'en' : 'zh'
    setLang(next)
    saveLang(next)
  }

  return (
    <BrowserRouter>
      {/* Global language toggle */}
      <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 100 }}>
        <button onClick={toggleLang} style={{
          padding: '6px 14px', fontSize: 13, borderRadius: 20, cursor: 'pointer',
          border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.6)',
          color: '#ccc', backdropFilter: 'blur(8px)',
        }}>
          {lang === 'zh' ? 'EN' : '中文'}
        </button>
      </div>

      <Routes>
        <Route path="/" element={<Discover lang={lang} />} />
        <Route path="/admin" element={<Admin lang={lang} />} />
      </Routes>
    </BrowserRouter>
  )
}

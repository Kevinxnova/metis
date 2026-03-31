import { useState } from 'react'
import { Tool } from '../api/client'
import { Lang, t } from '../i18n'

interface Props {
  tool: Tool
  onSave: (id: number, takeText: string) => void
  lang: Lang
}

export default function TakeEditor({ tool, onSave, lang }: Props) {
  const [text, setText] = useState(tool.take || '')
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    onSave(tool.id, text)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid #f0f0f0' }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{tool.title}</div>
      <textarea
        value={text}
        onChange={e => { setText(e.target.value); setSaved(false) }}
        onBlur={handleSave}
        placeholder={t(lang, 'writeTake')}
        style={{
          width: '100%', border: '1px dashed #ccc', borderRadius: 4,
          padding: 8, fontSize: 13, color: '#555', fontStyle: text ? 'normal' : 'italic',
          resize: 'vertical', minHeight: 50, fontFamily: 'inherit',
        }}
      />
      {saved && <span style={{ fontSize: 11, color: '#4a9' }}>{t(lang, 'saved')}</span>}
    </div>
  )
}

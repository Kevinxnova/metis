import { useState, useEffect } from 'react'
import { api, Tool } from '../api/client'
import TakeEditor from './TakeEditor'
import { Lang, t } from '../i18n'

export default function NewsletterPreview({ lang }: { lang: Lang }) {
  const [approved, setApproved] = useState<Tool[]>([])
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState('')

  const refresh = async () => {
    const tools = await api.getTools('approved')
    setApproved(tools)
  }

  useEffect(() => { refresh() }, [])

  const handleSaveTake = async (id: number, takeText: string) => {
    await api.updateTool(id, 'approve', takeText)
  }

  const handleCreateAndSend = async () => {
    if (approved.length === 0) {
      setMessage(t(lang, 'noApproved'))
      return
    }

    setSending(true)
    setMessage('')
    try {
      const { issue_number } = await api.createIssue()
      await api.sendIssue(issue_number)
      setMessage(`Issue #${issue_number}${t(lang, 'issueSent')}`)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t(lang, 'sendFailed'))
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{
      background: 'white', border: '1px solid #e0e0e0', borderRadius: 6,
      padding: 20, position: 'sticky', top: 24,
    }}>
      <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>{t(lang, 'newsletterDraft')}</h2>
      <div style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>
        {approved.length} {t(lang, 'toolsApproved')}
      </div>

      {approved.map(tool => (
        <TakeEditor key={tool.id} tool={tool} onSave={handleSaveTake} lang={lang} />
      ))}

      {approved.length === 0 && (
        <p style={{ color: '#bbb', fontSize: 13, textAlign: 'center', padding: 16 }}>
          {t(lang, 'approveFirst')}
        </p>
      )}

      <button
        onClick={handleCreateAndSend}
        disabled={sending || approved.length === 0}
        style={{
          width: '100%', padding: 10, background: approved.length > 0 ? '#333' : '#ccc',
          color: 'white', border: 'none', borderRadius: 4, fontSize: 13, cursor: 'pointer',
          marginTop: 12,
        }}
      >
        {sending ? t(lang, 'sending') : t(lang, 'createAndSend')}
      </button>

      {message && (
        <p style={{
          fontSize: 12, textAlign: 'center', marginTop: 8,
          color: message.includes('sent') || message.includes('已发送') ? '#4a9' : '#e55',
        }}>
          {message}
        </p>
      )}

      <button onClick={refresh} style={{
        width: '100%', padding: 6, background: 'white', color: '#888',
        border: '1px solid #ddd', borderRadius: 4, fontSize: 12, cursor: 'pointer',
        marginTop: 8,
      }}>
        {t(lang, 'refresh')}
      </button>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { api, Tool } from '../api/client'
import TakeEditor from './TakeEditor'

export default function NewsletterPreview() {
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
      setMessage('No approved tools to send')
      return
    }

    setSending(true)
    setMessage('')
    try {
      const { issue_number } = await api.createIssue()
      await api.sendIssue(issue_number)
      setMessage(`Issue #${issue_number} sent!`)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Send failed')
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{
      background: 'white', border: '1px solid #e0e0e0', borderRadius: 6,
      padding: 20, position: 'sticky', top: 24,
    }}>
      <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Newsletter Draft</h2>
      <div style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>
        {approved.length} tools approved
      </div>

      {approved.map(tool => (
        <TakeEditor key={tool.id} tool={tool} onSave={handleSaveTake} />
      ))}

      {approved.length === 0 && (
        <p style={{ color: '#bbb', fontSize: 13, textAlign: 'center', padding: 16 }}>
          Approve tools from the feed to add them here
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
        {sending ? 'Sending...' : 'Create & Send Issue'}
      </button>

      {message && (
        <p style={{
          fontSize: 12, textAlign: 'center', marginTop: 8,
          color: message.includes('sent') ? '#4a9' : '#e55',
        }}>
          {message}
        </p>
      )}

      <button onClick={refresh} style={{
        width: '100%', padding: 6, background: 'white', color: '#888',
        border: '1px solid #ddd', borderRadius: 4, fontSize: 12, cursor: 'pointer',
        marginTop: 8,
      }}>
        ↻ Refresh
      </button>
    </div>
  )
}

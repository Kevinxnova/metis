import ScrapeHealth from './components/ScrapeHealth'
import ToolFeed from './components/ToolFeed'
import NewsletterPreview from './components/NewsletterPreview'

export default function App() {
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
          Metis — Daily Review
        </h1>
      </div>

      <ScrapeHealth />

      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24,
      }}>
        <ToolFeed />
        <NewsletterPreview />
      </div>
    </div>
  )
}

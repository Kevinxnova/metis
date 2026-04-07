import { useEffect, useRef } from 'react'
import { Lang } from '../i18n'

function StarField() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    let w = canvas.width = window.innerWidth
    let h = canvas.height = window.innerHeight

    const stars: { x: number; y: number; r: number; vx: number; vy: number; alpha: number; pulse: number }[] = []
    for (let i = 0; i < 200; i++) {
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.5 + 0.3,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
        alpha: Math.random() * 0.6 + 0.2,
        pulse: Math.random() * Math.PI * 2,
      })
    }

    // Shooting stars
    const shooters: { x: number; y: number; len: number; speed: number; alpha: number; active: boolean }[] = []
    const spawnShooter = () => {
      shooters.push({
        x: Math.random() * w, y: Math.random() * h * 0.4,
        len: Math.random() * 60 + 40, speed: Math.random() * 4 + 3,
        alpha: 1, active: true,
      })
    }

    let frame = 0
    const draw = () => {
      ctx.clearRect(0, 0, w, h)
      frame++

      // Stars
      for (const s of stars) {
        s.x += s.vx
        s.y += s.vy
        s.pulse += 0.02
        if (s.x < 0) s.x = w
        if (s.x > w) s.x = 0
        if (s.y < 0) s.y = h
        if (s.y > h) s.y = 0

        const flicker = s.alpha + Math.sin(s.pulse) * 0.15
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(180, 200, 255, ${flicker})`
        ctx.fill()
      }

      // Connections (subtle constellation lines)
      ctx.strokeStyle = 'rgba(96, 165, 250, 0.03)'
      ctx.lineWidth = 0.5
      for (let i = 0; i < stars.length; i++) {
        for (let j = i + 1; j < stars.length; j++) {
          const dx = stars[i].x - stars[j].x
          const dy = stars[i].y - stars[j].y
          const dist = dx * dx + dy * dy
          if (dist < 6000) {
            ctx.beginPath()
            ctx.moveTo(stars[i].x, stars[i].y)
            ctx.lineTo(stars[j].x, stars[j].y)
            ctx.stroke()
          }
        }
      }

      // Shooting stars
      if (frame % 180 === 0 && Math.random() > 0.3) spawnShooter()
      for (const sh of shooters) {
        if (!sh.active) continue
        sh.x += sh.speed
        sh.y += sh.speed * 0.6
        sh.alpha -= 0.012
        if (sh.alpha <= 0 || sh.x > w || sh.y > h) { sh.active = false; continue }

        const grad = ctx.createLinearGradient(sh.x, sh.y, sh.x - sh.len, sh.y - sh.len * 0.6)
        grad.addColorStop(0, `rgba(200, 220, 255, ${sh.alpha})`)
        grad.addColorStop(1, 'rgba(200, 220, 255, 0)')
        ctx.beginPath()
        ctx.moveTo(sh.x, sh.y)
        ctx.lineTo(sh.x - sh.len, sh.y - sh.len * 0.6)
        ctx.strokeStyle = grad
        ctx.lineWidth = 1.5
        ctx.stroke()
      }

      animId = requestAnimationFrame(draw)
    }

    draw()

    const onResize = () => { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight }
    window.addEventListener('resize', onResize)
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', onResize) }
  }, [])

  return <canvas ref={canvasRef} style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }} />
}

export default function Landing({ lang }: { lang: Lang }) {
  const isZh = lang === 'zh'

  return (
    <div style={{ background: 'var(--bg-primary)', minHeight: '100vh', color: 'var(--text-primary)', overflow: 'hidden' }}>
      <StarField />

      {/* Ambient nebula glows */}
      <div style={{ position: 'fixed', top: -300, left: '30%', width: 900, height: 900, borderRadius: '50%', background: 'radial-gradient(circle, rgba(96,165,250,0.06) 0%, transparent 60%)', pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', top: '40%', right: -200, width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.05) 0%, transparent 60%)', pointerEvents: 'none' }} />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 720, margin: '0 auto', padding: '0 24px' }}>

        {/* Nav */}
        <nav style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '24px 0',
        }}>
          <span style={{
            fontSize: 22, fontWeight: 700, letterSpacing: -1,
            background: 'linear-gradient(135deg, #60a5fa, #a78bfa)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            Metis
          </span>
          <a href="/discover" style={{
            fontSize: 13, color: 'var(--accent-blue)', textDecoration: 'none',
            padding: '6px 16px', border: '1px solid rgba(96,165,250,0.3)',
            borderRadius: 6, backdropFilter: 'blur(4px)', background: 'rgba(96,165,250,0.05)',
          }}>
            {isZh ? '进入 →' : 'Enter →'}
          </a>
        </nav>

        {/* Hero */}
        <section style={{ paddingTop: 100, paddingBottom: 80, textAlign: 'center' }}>
          {/* Giant Metis logo */}
          <h1 style={{
            fontSize: 120, fontWeight: 900, letterSpacing: -6, lineHeight: 1,
            margin: '0 0 16px',
            background: 'linear-gradient(135deg, #fff 0%, #60a5fa 40%, #a78bfa 70%, #f472b6 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 0 60px rgba(96,165,250,0.15))',
          }}>
            Metis
          </h1>
          <p style={{
            fontSize: 22, fontWeight: 300, color: 'var(--text-body)', letterSpacing: 4, margin: '0 0 32px',
            textTransform: 'uppercase',
          }}>
            {isZh ? '帮你成为更好的你' : 'Helping you become a better you'}
          </p>
          <p style={{
            fontSize: 16, color: 'var(--text-muted)', lineHeight: 1.9, maxWidth: 520, margin: '0 auto 48px',
          }}>
            {isZh
              ? 'AI 时代每天涌现大量工具和知识，靠社交媒体和口耳相传效率太低。Metis 持续追踪科技圈动态，帮你用最少的时间获取最有价值的信息。'
              : 'The AI era brings a flood of new tools and knowledge daily. Social media and word-of-mouth are too slow. Metis continuously tracks the tech world so you spend less time searching and more time building.'}
          </p>
          <a href="/discover" style={{
            display: 'inline-block', padding: '16px 48px', fontSize: 16, fontWeight: 600,
            background: 'linear-gradient(135deg, #60a5fa, #a78bfa)',
            color: 'var(--text-primary)', borderRadius: 12, textDecoration: 'none',
            boxShadow: '0 0 40px rgba(96,165,250,0.2), 0 0 80px rgba(139,92,246,0.1)',
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 0 50px rgba(96,165,250,0.3), 0 0 100px rgba(139,92,246,0.15)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 0 40px rgba(96,165,250,0.2), 0 0 80px rgba(139,92,246,0.1)' }}
          >
            {isZh ? '开始探索' : 'Start Exploring'}
          </a>
        </section>

        {/* Divider */}
        <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(96,165,250,0.2), transparent)', margin: '0 0 64px' }} />

        {/* Why */}
        <section style={{ marginBottom: 64 }}>
          <SectionLabel text={isZh ? '为什么做 Metis' : 'Why Metis'} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 24 }}>
            <StoryCard
              num="01"
              title={isZh ? '好工具总是靠别人告诉你' : 'Good tools always come from someone else'}
              body={isZh
                ? '我发现自己用的很多效率工具，都是朋友无意间提到的。等在社交媒体上看到时，往往已经晚了。如果有人能帮我盯着整个科技圈，只把值得关注的筛出来就好了。'
                : 'Most of the best tools I use came from casual mentions by friends. By the time something trends on social media, you\'ve already missed the window. What if something could watch the entire tech world for you and surface only what matters?'}
            />
            <StoryCard
              num="02"
              title={isZh ? '信息不缺，缺的是筛选' : 'Information isn\'t scarce, curation is'}
              body={isZh
                ? 'GitHub Trending、Hacker News、Product Hunt... 每天数百个新项目。全部看完不现实，完全不看又怕错过。Metis 从多个源头抓取，自动分类，再由人和 AI 双重筛选，帮你把信噪比拉到最高。'
                : 'GitHub Trending, Hacker News, Product Hunt... hundreds of new projects daily. Reading everything is impossible, ignoring everything means missing out. Metis scrapes multiple sources, auto-classifies, then filters through both human and AI curation for the highest signal-to-noise ratio.'}
            />
            <StoryCard
              num="03"
              title={isZh ? '让每个人都能乘风而上' : 'Ride the wave, don\'t drown in it'}
              body={isZh
                ? 'AI 时代迭代速度前所未有。掌握新工具、新知识的速度直接决定你的竞争力。Metis 不只是一个工具聚合器，它想帮你成为更好的你——用更少的时间，看到更多的可能。'
                : 'The pace of change in the AI era is unprecedented. How fast you discover and adopt new tools directly shapes your competitive edge. Metis isn\'t just an aggregator — it\'s about helping you become a better you, seeing more possibilities in less time.'}
            />
          </div>
        </section>

        {/* What you get */}
        <section style={{ marginBottom: 64 }}>
          <SectionLabel text={isZh ? '你能获得什么' : 'What You Get'} />
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 24,
          }}>
            <FeatureCard icon="⭐" title={isZh ? '优选榜' : "Editor's Picks"} desc={isZh ? '高热度、高价值的工具和知识，常驻置顶。经过严格筛选，每一个都值得你花时间了解。' : 'High-impact tools and knowledge, pinned at the top. Rigorously curated — every pick is worth your time.'} color="#f59e0b" />
            <FeatureCard icon="💎" title={isZh ? 'Metis 推荐' : 'Metis Picks'} desc={isZh ? '创作者每日精选推荐。带着对工具的理解和判断，帮你从海量信息中提炼最值得关注的。' : 'Daily picks from the creator. Curated with real understanding and judgment, distilling what\'s worth your attention.'} color="#8b5cf6" />
            <FeatureCard icon="🤖" title={isZh ? 'AI 推荐' : 'AI Picks'} desc={isZh ? 'AI 分析今日所有新发现，给出推荐理由和适用场景。人机协作，不漏掉任何亮点。' : 'AI analyzes all daily discoveries, providing reasons and use cases. Human-AI collaboration ensures nothing slips through.'} color="#60a5fa" />
            <FeatureCard icon="📡" title={isZh ? '今日发现' : "Today's Feed"} desc={isZh ? '每天从 GitHub、Hacker News、Product Hunt 等多个平台自动抓取，按类型和领域智能分类。' : 'Auto-scraped daily from GitHub, HN, Product Hunt, and more. Classified by type and domain.'} color="#4ade80" />
          </div>
        </section>

        {/* Coverage */}
        <section style={{ marginBottom: 64 }}>
          <SectionLabel text={isZh ? '覆盖范围' : 'Coverage'} />
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 24, justifyContent: 'center' }}>
            {[
              { emoji: '🤖', label: 'AI / ML' },
              { emoji: '🌐', label: isZh ? 'Web 开发' : 'Web Dev' },
              { emoji: '⚙️', label: 'DevOps' },
              { emoji: '📊', label: isZh ? '数据分析' : 'Data' },
              { emoji: '🔒', label: isZh ? '安全' : 'Security' },
              { emoji: '🎨', label: isZh ? '设计' : 'Design' },
              { emoji: '📖', label: isZh ? '技术文章' : 'Articles' },
              { emoji: '🧠', label: isZh ? 'AI 模型' : 'Models' },
            ].map(d => (
              <span key={d.label} style={{
                fontSize: 13, padding: '6px 14px', borderRadius: 8,
                background: 'var(--bg-hover)', border: '1px solid var(--border-subtle)',
                color: 'var(--text-body)', backdropFilter: 'blur(4px)',
              }}>
                {d.emoji} {d.label}
              </span>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section style={{ textAlign: 'center', paddingBottom: 80 }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(96,165,250,0.06), rgba(139,92,246,0.06))',
            border: '1px solid rgba(96,165,250,0.1)',
            borderRadius: 16, padding: '48px 24px',
            backdropFilter: 'blur(8px)',
          }}>
            <p style={{ fontSize: 24, fontWeight: 700, margin: '0 0 8px', color: 'var(--text-primary)', letterSpacing: -0.5 }}>
              {isZh ? '帮你成为更好的你' : 'Helping you become a better you'}
            </p>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: '0 0 28px' }}>
              {isZh ? '每天 5 分钟，掌握科技圈最值得关注的动态' : '5 minutes a day to stay ahead of what matters in tech'}
            </p>
            <a href="/discover" style={{
              display: 'inline-block', padding: '14px 36px', fontSize: 15, fontWeight: 600,
              background: 'linear-gradient(135deg, #60a5fa, #a78bfa)',
              color: 'var(--text-primary)', borderRadius: 10, textDecoration: 'none',
              boxShadow: '0 0 30px rgba(96,165,250,0.15)',
            }}>
              {isZh ? '立即体验 →' : 'Try Now →'}
            </a>
          </div>
        </section>

        {/* Footer */}
        <footer style={{
          textAlign: 'center', padding: '24px 0', color: 'var(--text-dim)', fontSize: 12,
          borderTop: '1px solid var(--border-subtle)',
        }}>
          Metis · {isZh ? '持续发现，持续成长' : 'Keep discovering, keep growing'}
        </footer>
      </div>
    </div>
  )
}

function SectionLabel({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 3, height: 16, background: 'linear-gradient(180deg, #60a5fa, #a78bfa)', borderRadius: 2 }} />
      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-body)', textTransform: 'uppercase', letterSpacing: 1 }}>{text}</span>
    </div>
  )
}

function StoryCard({ num, title, body }: { num: string; title: string; body: string }) {
  return (
    <div style={{
      display: 'flex', gap: 16, padding: 20,
      background: 'var(--bg-hover)', border: '1px solid var(--border-subtle)',
      borderRadius: 12, backdropFilter: 'blur(4px)',
    }}>
      <span style={{
        fontSize: 32, fontWeight: 800, lineHeight: 1, flexShrink: 0, width: 40,
        background: 'linear-gradient(180deg, #333, #1a1a2e)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
      }}>
        {num}
      </span>
      <div>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-heading)', margin: '0 0 8px' }}>{title}</h3>
        <p style={{ fontSize: 14, color: 'var(--text-body)', lineHeight: 1.8, margin: 0 }}>{body}</p>
      </div>
    </div>
  )
}

function FeatureCard({ icon, title, desc, color }: { icon: string; title: string; desc: string; color: string }) {
  return (
    <div style={{
      padding: 20, borderRadius: 12,
      background: `linear-gradient(135deg, ${color}08, ${color}03)`,
      border: `1px solid ${color}15`,
      backdropFilter: 'blur(4px)',
    }}>
      <div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-heading)', margin: '0 0 6px' }}>{title}</h3>
      <p style={{ fontSize: 13, color: 'var(--text-body)', lineHeight: 1.6, margin: 0 }}>{desc}</p>
    </div>
  )
}

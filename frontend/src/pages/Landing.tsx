import { Lang } from '../i18n'

export default function Landing({ lang }: { lang: Lang }) {
  const isZh = lang === 'zh'

  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh', color: '#fff', overflow: 'hidden' }}>
      {/* Ambient glow */}
      <div style={{
        position: 'fixed', top: -200, left: '50%', transform: 'translateX(-50%)',
        width: 800, height: 800, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(96,165,250,0.08) 0%, rgba(139,92,246,0.04) 40%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', maxWidth: 720, margin: '0 auto', padding: '0 24px' }}>

        {/* Nav */}
        <nav style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '24px 0',
        }}>
          <span style={{
            fontSize: 20, fontWeight: 700, letterSpacing: -1,
            background: 'linear-gradient(135deg, #60a5fa, #a78bfa)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            Metis
          </span>
          <a href="/discover" style={{
            fontSize: 13, color: '#60a5fa', textDecoration: 'none',
            padding: '6px 16px', border: '1px solid rgba(96,165,250,0.3)',
            borderRadius: 6, transition: 'background 0.2s',
          }}>
            {isZh ? '进入 →' : 'Enter →'}
          </a>
        </nav>

        {/* Hero */}
        <section style={{ paddingTop: 80, paddingBottom: 64, textAlign: 'center' }}>
          <h1 style={{
            fontSize: 48, fontWeight: 800, lineHeight: 1.15, letterSpacing: -2,
            margin: '0 0 20px',
            background: 'linear-gradient(135deg, #fff 0%, #60a5fa 50%, #a78bfa 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            {isZh ? '在信息洪流中\n只看重要的' : 'In the flood of information\nsee only what matters'}
          </h1>
          <p style={{
            fontSize: 17, color: '#888', lineHeight: 1.8, maxWidth: 520, margin: '0 auto 40px',
          }}>
            {isZh
              ? 'AI 时代每天涌现大量工具和知识，靠社交媒体和口耳相传效率太低。Metis 持续追踪科技圈动态，帮你用最少的时间获取最有价值的信息。'
              : 'The AI era brings a flood of new tools and knowledge daily. Social media and word-of-mouth are too slow. Metis continuously tracks the tech world so you spend less time searching and more time building.'}
          </p>
          <a href="/discover" style={{
            display: 'inline-block', padding: '14px 36px', fontSize: 15, fontWeight: 600,
            background: 'linear-gradient(135deg, #60a5fa, #a78bfa)',
            color: '#fff', borderRadius: 10, textDecoration: 'none',
            transition: 'opacity 0.2s, transform 0.2s',
          }}>
            {isZh ? '开始探索' : 'Start Exploring'}
          </a>
        </section>

        {/* Divider */}
        <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, #222, transparent)', margin: '0 0 64px' }} />

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
            <FeatureCard
              icon="⭐"
              title={isZh ? '优选榜' : "Editor's Picks"}
              desc={isZh
                ? '高热度、高价值的工具和知识，常驻置顶。经过严格筛选，每一个都值得你花时间了解。'
                : 'High-impact tools and knowledge, pinned at the top. Rigorously curated — every pick is worth your time.'}
              color="#f59e0b"
            />
            <FeatureCard
              icon="💎"
              title={isZh ? 'Metis 推荐' : 'Metis Picks'}
              desc={isZh
                ? '创作者每日精选推荐。带着对工具的理解和判断，帮你从海量信息中提炼最值得关注的。'
                : 'Daily picks from the creator. Curated with real understanding and judgment, distilling what\'s worth your attention.'}
              color="#8b5cf6"
            />
            <FeatureCard
              icon="🤖"
              title={isZh ? 'AI 推荐' : 'AI Picks'}
              desc={isZh
                ? 'AI 分析今日所有新发现，给出推荐理由和适用场景。人机协作，不漏掉任何亮点。'
                : 'AI analyzes all daily discoveries, providing reasons and use cases. Human-AI collaboration ensures nothing slips through.'}
              color="#60a5fa"
            />
            <FeatureCard
              icon="📡"
              title={isZh ? '今日发现' : "Today's Feed"}
              desc={isZh
                ? '每天从 GitHub、Hacker News、Product Hunt 等多个平台自动抓取，按类型和领域智能分类。'
                : 'Auto-scraped daily from GitHub, HN, Product Hunt, and more. Classified by type and domain.'}
              color="#4ade80"
            />
          </div>
        </section>

        {/* Coverage */}
        <section style={{ marginBottom: 64 }}>
          <SectionLabel text={isZh ? '覆盖范围' : 'Coverage'} />
          <div style={{
            display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 24, justifyContent: 'center',
          }}>
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
                background: 'rgba(255,255,255,0.04)', border: '1px solid #1e1e1e',
                color: '#888',
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
            border: '1px solid rgba(96,165,250,0.12)',
            borderRadius: 16, padding: '40px 24px',
          }}>
            <p style={{ fontSize: 20, fontWeight: 600, margin: '0 0 8px', color: '#eee' }}>
              {isZh ? '帮你成为更好的你' : 'Helping you become a better you'}
            </p>
            <p style={{ fontSize: 14, color: '#666', margin: '0 0 24px' }}>
              {isZh
                ? '每天 5 分钟，掌握科技圈最值得关注的动态'
                : '5 minutes a day to stay ahead of what matters in tech'}
            </p>
            <a href="/discover" style={{
              display: 'inline-block', padding: '12px 32px', fontSize: 14, fontWeight: 600,
              background: 'linear-gradient(135deg, #60a5fa, #a78bfa)',
              color: '#fff', borderRadius: 8, textDecoration: 'none',
            }}>
              {isZh ? '立即体验 →' : 'Try Now →'}
            </a>
          </div>
        </section>

        {/* Footer */}
        <footer style={{
          textAlign: 'center', padding: '24px 0', color: '#333', fontSize: 12,
          borderTop: '1px solid #151515',
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
      <span style={{ fontSize: 14, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: 1 }}>
        {text}
      </span>
    </div>
  )
}

function StoryCard({ num, title, body }: { num: string; title: string; body: string }) {
  return (
    <div style={{
      display: 'flex', gap: 16, padding: 20,
      background: 'rgba(255,255,255,0.02)', border: '1px solid #1a1a1a',
      borderRadius: 12,
    }}>
      <span style={{
        fontSize: 32, fontWeight: 800, color: '#1a1a2e',
        lineHeight: 1, flexShrink: 0, width: 40,
        background: 'linear-gradient(180deg, #333, #1a1a1a)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
      }}>
        {num}
      </span>
      <div>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: '#ddd', margin: '0 0 8px' }}>{title}</h3>
        <p style={{ fontSize: 14, color: '#777', lineHeight: 1.8, margin: 0 }}>{body}</p>
      </div>
    </div>
  )
}

function FeatureCard({ icon, title, desc, color }: { icon: string; title: string; desc: string; color: string }) {
  return (
    <div style={{
      padding: 20, borderRadius: 12,
      background: `linear-gradient(135deg, ${color}08, ${color}03)`,
      border: `1px solid ${color}20`,
    }}>
      <div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: '#ddd', margin: '0 0 6px' }}>{title}</h3>
      <p style={{ fontSize: 13, color: '#777', lineHeight: 1.6, margin: 0 }}>{desc}</p>
    </div>
  )
}

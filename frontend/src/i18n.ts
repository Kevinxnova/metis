export type Lang = 'zh' | 'en'

const messages = {
  zh: {
    title: 'Metis — 每日审阅',
    allTools: '全部',
    pending: '待审',
    approved: '已选',
    skipped: '已跳过',
    deferred: '已推迟',
    loading: '加载中...',
    errorPrefix: '错误：',
    noTools: '暂无工具。运行爬虫获取新工具。',
    approve: '✓ 选用',
    skip: '跳过',
    approved_btn: '✓ 已选',
    skipped_btn: '已跳过',
    newsletterDraft: '通讯草稿',
    toolsApproved: '个工具已选用',
    writeTake: '写下你的点评... 这个工具为什么重要？',
    saved: '已保存 ✓',
    approveFirst: '从左侧工具列表中选用工具',
    createAndSend: '创建并发送',
    sending: '发送中...',
    refresh: '↻ 刷新',
    noApproved: '没有已选用的工具可发送',
    issueSent: '期已发送！',
    sendFailed: '发送失败',
    found: '已发现',
    switchLang: 'EN',
    scrapeError: '⚠',
    // Categories - content type
    filterType: '类型',
    filterDomain: '领域',
    type_all: '全部类型',
    type_tool: '🔧 工具',
    type_library: '📦 代码库',
    type_model: '🧠 模型',
    type_api: '📡 API/服务',
    type_article: '📖 文章',
    type_other: '💡 其他',
    // Categories - domain
    domain_all: '全部领域',
    domain_ai: '🤖 AI/ML',
    domain_web: '🌐 Web开发',
    domain_devops: '⚙️ DevOps',
    domain_data: '📊 数据',
    domain_security: '🔒 安全',
    domain_design: '🎨 设计',
    domain_general: '💼 通用',
    translating: '正在翻译...',
    // Daily News
    dailyNews: 'AI 日报',
    dailyNewsSubtitle: '每日 AI 科技要闻',
    headlines: '头条',
    quickBites: '快讯',
    editorTake: '编辑视角',
    noNewsToday: '今日暂无日报',
    noNewsDesc: '日报将在每日爬虫完成后自动生成',
    viewSource: '查看原文',
    tag_model: '模型发布',
    tag_funding: '融资',
    tag_opensource: '开源',
    tag_product: '产品',
    tag_policy: '政策',
    tag_research: '研究',
    tag_tool: '工具',
  },
  en: {
    title: 'Metis — Daily Review',
    allTools: 'All',
    pending: 'Pending',
    approved: 'Approved',
    skipped: 'Skipped',
    deferred: 'Deferred',
    loading: 'Loading tools...',
    errorPrefix: 'Error: ',
    noTools: 'No tools found. Run the scraper to fetch new tools.',
    approve: '✓ Approve',
    skip: 'Skip',
    approved_btn: '✓ Approved',
    skipped_btn: 'Skipped',
    newsletterDraft: 'Newsletter Draft',
    toolsApproved: 'tools approved',
    writeTake: 'Write your take... Why does this matter?',
    saved: 'Saved ✓',
    approveFirst: 'Approve tools from the feed to add them here',
    createAndSend: 'Create & Send Issue',
    sending: 'Sending...',
    refresh: '↻ Refresh',
    noApproved: 'No approved tools to send',
    issueSent: ' sent!',
    sendFailed: 'Send failed',
    found: 'found',
    switchLang: '中文',
    scrapeError: '⚠',
    // Categories - content type
    filterType: 'Type',
    filterDomain: 'Domain',
    type_all: 'All Types',
    type_tool: '🔧 Tool',
    type_library: '📦 Library',
    type_model: '🧠 Model',
    type_api: '📡 API',
    type_article: '📖 Article',
    type_other: '💡 Other',
    // Categories - domain
    domain_all: 'All Domains',
    domain_ai: '🤖 AI/ML',
    domain_web: '🌐 Web',
    domain_devops: '⚙️ DevOps',
    domain_data: '📊 Data',
    domain_security: '🔒 Security',
    domain_design: '🎨 Design',
    domain_general: '💼 General',
    translating: 'Translating...',
    // Daily News
    dailyNews: 'AI Daily',
    dailyNewsSubtitle: 'Your daily AI tech briefing',
    headlines: 'Headlines',
    quickBites: 'Quick Bites',
    editorTake: "Editor's Take",
    noNewsToday: 'No briefing today',
    noNewsDesc: 'The daily briefing is generated after the scraper runs',
    viewSource: 'View source',
    tag_model: 'Model',
    tag_funding: 'Funding',
    tag_opensource: 'Open Source',
    tag_product: 'Product',
    tag_policy: 'Policy',
    tag_research: 'Research',
    tag_tool: 'Tool',
  },
} as const

type MessageKey = keyof typeof messages.en

export function t(lang: Lang, key: MessageKey): string {
  return messages[lang][key]
}

// For dynamic keys built at runtime
export function td(lang: Lang, key: string): string {
  const m = messages[lang] as Record<string, string>
  return m[key] ?? key
}

export function getSavedLang(): Lang {
  return (localStorage.getItem('metis-lang') as Lang) || 'zh'
}

export function saveLang(lang: Lang) {
  localStorage.setItem('metis-lang', lang)
}

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
  },
} as const

export function t(lang: Lang, key: keyof typeof messages.en): string {
  return messages[lang][key]
}

export function getSavedLang(): Lang {
  return (localStorage.getItem('metis-lang') as Lang) || 'zh'
}

export function saveLang(lang: Lang) {
  localStorage.setItem('metis-lang', lang)
}

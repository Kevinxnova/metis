# Changelog

All notable changes to Metis are documented here.

---

## [v0.3.0] — 2026-04-05

### 「本周发现」模块重构

#### 三模块分区展示

将原来的单一发现列表拆分为三个内容分区，按 `discovery_category` 字段区分：

| 分区 | 分类值 | 内容说明 |
|------|--------|----------|
| 📰 AI 动态 | `news` | AI 领域的新闻、公告、融资、模型发布等 |
| 🔧 AI 工具 | `ai_tool` | AI 驱动的产品、工具、库、框架 |
| 🌐 其他 | `other` | 非 AI 类技术内容、通用软件 |

分类由 MiniMax（`MiniMax-M2.7-highspeed`）完成，每次最多处理 50 条，通过 prompt 指定严格的三分类规则。

#### AI 智能摘要

每条内容自动生成 `short_summary`（英文 ≤60 字符）和 `short_summary_zh`（中文 ≤20 字符），格式为「名称 — 一句话功能描述」。由 MiniMax 分批处理（每批 20 条），仅对已完成分类的内容生成摘要。

#### 自动分类流水线

新增 Vercel Cron 任务 `/api/cron/classify`，每日 UTC 1:00 自动执行，最大运行时间 600 秒。流水线依次执行四个步骤：

| 步骤 | 方法 | 说明 |
|------|------|------|
| 1. discovery_category 分类 | MiniMax API，50 条/批 | 将内容分为 news / ai_tool / other |
| 2. short_summary 摘要 | MiniMax API，20 条/批 | 仅处理已分类的内容 |
| 3. content_type + domain 分类 | 本地规则引擎（零 API 开销） | 基于正则匹配的关键词评分 |
| 4. 中文翻译 | Google Translate（deep-translator） | 翻译标题和描述 |

每个步骤循环执行直到全部处理完毕或达到 550 秒时间限制。

#### AI 推荐自动化

AI 推荐从手动触发改为每日自动运行。新增 Vercel Cron 任务 `/api/cron/digest`，每日 UTC 1:30 执行，依次生成：
1. **Daily Digest**：从当日发现中选出 3 个工具精选 + 2 条热点新闻，附中英文一句话摘要
2. **AI 推荐 TOP 5**：MiniMax 从当日最多 50 条内容中选出 5 个最有价值的工具，附中英文推荐理由、适用场景和 1-10 评分

---

## [v0.2.0] — 2026-03

### 社区页、每周视图与 AI 精选

#### 社区页（`/community`）

用户反馈与留言入口。通过 `POST /api/messages` 提交留言（支持可选昵称），数据存入 `user_messages` 表，`GET /api/messages` 读取。

#### 本周发现

`GET /api/discover/week` 返回最近 7 天内 `first_seen` 的内容，按热度指标（stars / points / votes）降序排列。

#### 今日精选（Daily Digest）

AI 每日从当日发现中选出 3 个工具推荐 + 2 条热点新闻。调用 MiniMax（`MiniMax-M2.7-highspeed`），通过 OpenAI 兼容接口（`base_url=https://api.minimax.chat/v1`），`temperature=0.7`，返回 JSON 格式的中英文摘要。结果缓存在 `daily_digest` 表中，每日只生成一次。

#### AI 推荐

MiniMax 分析当日工具（最多取 50 条），选出 TOP 5 并输出：
- 中英文推荐理由（2-3 句）
- 中英文适用场景（2-3 个）
- 评分 1-10

结果存入 `ai_recommendations` 表，按日缓存。前端 AI 推荐卡片支持 Carousel 平滑滚动和方向箭头导航。

#### AI 推荐快速预览

推荐列表上方展示「名称 — 一行理由」速览条，便于快速浏览。

---

## [v0.1.0] — 2026-02 ～ 2026-03

### 基础功能上线

#### 数据抓取

四个数据源，每日 UTC 0:00 由 Vercel Cron 触发 `/api/cron/scrape`（最大运行时间 600 秒），依次执行：

| 数据源 | 方法 | 抓取策略 | 关键指标 |
|--------|------|----------|----------|
| **GitHub Trending** | 解析 `github.com/trending/{lang}` HTML 页面，使用 httpx + 正则提取仓库信息；再通过 GitHub REST API (`/repos/{owner}/{repo}`) 获取精确 star 数 | 遍历 6 个语言维度：Python、TypeScript、JavaScript、Rust、Go、全部语言；同一仓库跨语言去重 | `stars`（总数）、`stars_today`（当日增量） |
| **Hacker News** | 调用 Firebase API (`hacker-news.firebaseio.com/v0`)，抓取 `showstories` + `topstories` 两个端点 | 每个端点取前 50 条，逐条请求详情；过滤掉 `points < 10` 的低热度内容；Show HN 帖子自动清理标题前缀 | `points`、`comments`、`is_show_hn` |
| **Product Hunt** | 调用 GraphQL API (`api.producthunt.com/v2/api/graphql`)，需要 Bearer Token 认证 | 按投票数排序取前 30 个产品，提取 tagline、topics、votes 等 | `votes`、`comments`、`topics` |
| **RSS 新闻** | 使用 httpx 抓取 + feedparser 解析 RSS/XML，自定义 User-Agent（`MetisBot/1.0`） | 仅保留最近 48 小时内的文章；自动去除 HTML 标签和解码实体 | `rss_label`、`published` |

RSS 新闻源覆盖 8 个频道：

| 来源 | Feed URL |
|------|----------|
| The Verge AI | `theverge.com/rss/ai-artificial-intelligence/index.xml` |
| TechCrunch AI | `techcrunch.com/category/artificial-intelligence/feed/` |
| Ars Technica | `feeds.arstechnica.com/arstechnica/technology-lab` |
| MIT Technology Review | `technologyreview.com/feed/` |
| VentureBeat AI | `venturebeat.com/category/ai/feed/` |
| Wired AI | `wired.com/feed/tag/ai/latest/rss` |
| OpenAI Blog | `openai.com/blog/rss.xml` |
| Google AI Blog | `blog.google/technology/ai/rss/` |

所有爬虫继承自 `BaseScraper`，共享统一流水线：**fetch → normalize → dedup → classify → insert**。每次运行结果记录到 `scrape_runs` 表（source、status、found/new/deduped 计数、耗时、错误信息）。

#### URL 去重

基于 `dedup_key` 的两级去重策略：

| 优先级 | 条件 | 生成规则 | 示例 |
|--------|------|----------|------|
| 1 | GitHub URL | `github:{owner}/{repo}`（小写） | `github:langchain-ai/langchain` |
| 2 | 其他 URL | `url:{normalized_url}`，去除 query/fragment/www/尾部斜杠 | `url:https://example.com/tool` |

同一 `dedup_key` 的重复条目不会重复插入，但会合并 `sources` 字段记录多源发现。

#### 自动分类（规则引擎）

零 API 开销的本地分类器，基于正则关键词匹配评分，两个正交维度：

| 维度 | 可选值 | 方法 |
|------|--------|------|
| `content_type` | tool / library / model / api / article / other | 对标题+描述+URL 分别匹配 5 组关键词模式，取最高分；GitHub URL 默认偏向 tool，HN text-only 偏向 article |
| `domain` | ai / web / devops / data / security / design / general | 同上，6 组领域关键词模式独立评分 |

#### 双语支持

- **内容翻译**：使用 `deep-translator` 调用 Google Translate，将英文标题和描述翻译为中文（`title_zh`、`description_zh`）
- **Take 反向翻译**：编辑中文 take 后自动调用 `GoogleTranslator(zh-CN → en)` 生成英文版
- **前端 i18n**：React 端支持中/英文切换，通过 `localStorage` 持久化语言偏好

#### AI 每日新闻

每日 UTC 0:30 和 6:00 由 Vercel Cron 触发 `/api/cron/daily-news`（最大运行时间 300 秒）。从当日内容中筛选 AI 相关条目（`domain='ai'` 或 `source='rss_news'` 或 `discovery_category='news'` 或 `content_type IN ('model','article')`），按热度指标降序取前 80 条，发送给 MiniMax 生成结构化日报：

| 字段 | 说明 |
|------|------|
| `headlines` | 3-5 条最重要新闻，含标题/摘要（中英）、来源、链接、标签（模型发布/融资/开源/产品/政策/研究/工具） |
| `quick_bites` | 3-6 条一句话快讯（中英） |
| `editor_take` | 编辑视角的趋势分析（中英），3-5 句有观点的洞察 |

结果按日缓存在 `ai_daily_news` 表中。每日 6:00 再次运行以补充更多素材。

#### Discover 页

`/discover` 为主发现页面，包含四大板块：

| 板块 | API 端点 | 数据来源 |
|------|----------|----------|
| 优选榜 | `GET /api/discover/featured` | `is_featured=1` 的手动精选 |
| Metis 推荐 | `GET /api/discover/metis-picks` | `is_metis_pick=1` 的编辑推荐 |
| AI 推荐 | `GET /api/discover/ai-picks` | `ai_recommendations` 表，MiniMax 生成 |
| 今日发现 | `GET /api/discover/today` | 当日所有 `first_seen` 的内容 |

另有 `GET /api/discover/week`（本周发现）、`GET /api/discover/random`（随机推荐）、`GET /api/discover/digest`（每日精选）。

#### 管理后台

`/admin` 路由，通过 `ADMIN_PASSWORD` 环境变量控制访问（`POST /api/admin/verify` 校验密码）。功能：

- **审核工具**：支持 approve / skip / defer / archive / unapprove 五种状态流转，所有操作记录到 `curation_log` 表
- **设置 featured**：`POST /api/tools/{id}/featured` 标记/取消优选
- **设置 metis-pick**：`POST /api/tools/{id}/metis-pick` 标记/取消编辑推荐
- **编辑 Take**：在审核时附加编辑点评，自动翻译为英文
- **合并工具**：`POST /api/tools/{id}/merge` 将重复条目合并到目标工具

#### Newsletter 发送

- **期刊管理**：`issues` 表记录期刊（draft → sent），创建期刊时自动关联所有 approved 状态的工具
- **邮件模板**：HTML 模板，`max-width: 600px`，Apple 系统字体，展示每个工具的标题链接 + take 点评
- **发送渠道**：通过 Buttondown API（`api.buttondown.com/v1/emails`）发送，Token 认证，30 秒超时
- **防重复**：已发送的期刊不允许重复发送（HTTP 409）

#### 部署架构

| 组件 | 技术 | 说明 |
|------|------|------|
| 前端 | React + TypeScript + Vite | 部署在 Vercel，`frontend/dist` 为输出目录 |
| 后端 API | Flask（Python） | 通过 Vercel Serverless Functions 运行，`/api/*` 路由 rewrites 到 `api/index.py` |
| 数据库 | SQLite（本地）/ Turso（云端） | WAL 模式，支持并发读写；Turso 作为生产环境云数据库 |
| 定时任务 | Vercel Cron | 5 个定时任务，覆盖抓取→新闻→分类→摘要全流程 |
| 内网穿透 | Cloudflare Tunnel | Mac mini 作为本地后端服务器 |
| AI 模型 | MiniMax (`MiniMax-M2.7-highspeed`) | 用于分类、摘要、推荐、每日新闻生成 |
| 邮件 | Buttondown API | Newsletter 分发渠道 |
| 翻译 | Google Translate（deep-translator） | 中英文双向翻译 |

#### Cron 调度总览

| Cron | UTC 时间 | 端点 | 最大时长 | 功能 |
|------|----------|------|----------|------|
| 每日爬虫 | 0:00 | `/api/cron/scrape` | 600s | 运行四个爬虫 |
| 每日新闻（首次） | 0:30 | `/api/cron/daily-news` | 300s | 生成 AI 日报 |
| 分类流水线 | 1:00 | `/api/cron/classify` | 600s | 分类 + 摘要 + 翻译 |
| 摘要推荐 | 1:30 | `/api/cron/digest` | 300s | Daily Digest + AI TOP 5 |
| 每日新闻（补充） | 6:00 | `/api/cron/daily-news` | 300s | 补充更多素材后再次生成 |

#### 爬虫健康监控

- `scrape_runs` 表：记录每次爬虫运行的 source、status（success/error/timeout）、found/new/deduped 计数、耗时（ms）、错误信息
- `cron_logs` 表：记录每个 Cron 任务的执行日期、状态、各步骤详情、耗时
- `GET /api/health/scrapes`：返回最近一次各源爬虫运行状态
- `GET /api/cron-logs`：查询 Cron 任务执行历史，支持按 task 过滤

#### 暗色模式

前端支持 light / dark 主题切换，通过 CSS 变量实现，用户偏好持久化到 `localStorage`。

#### Landing Page

品牌主页（`/` 路由），介绍 Metis 的产品定位与功能：AI 工具发现 Newsletter，自动抓取 + 人工策展 + 邮件分发。

---

> 格式参考 [Keep a Changelog](https://keepachangelog.com/)

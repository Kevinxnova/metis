# Metis 产品设计文档 v0.1.0

> 最后更新: 2026-04-13
> 状态: 当前功能基线 + v0.1.0 改动需求

---

## 一、产品定位

**Metis** 是一个 AI 驱动的工具与科技资讯发现平台，帮助开发者和技术从业者从海量信息中高效发现最有价值的工具、项目和趋势。

**核心价值**: 多源聚合 → AI 筛选 → 结构化呈现，让用户花更少时间搜索、更多时间构建。

---

## 二、数据管线（不变）

### 2.1 爬虫源
| 源 | 方式 | 频率 | 数据 |
|---|---|---|---|
| GitHub Trending | HTML 解析 + REST API | 每日 00:00 UTC | repo 路径、描述、stars、stars_today |
| Hacker News | Firebase API | 每日 00:00 UTC | Show HN + Top Stories（min 10 points, max 50） |
| Product Hunt | GraphQL API | 每日 00:00 UTC | 今日产品、votes |
| RSS 聚合 | feedparser | 每日 00:00 UTC | The Verge、TechCrunch、Ars Technica、MIT Tech Review、VentureBeat、Wired、OpenAI Blog、Google AI Blog 等 |

### 2.2 数据处理流水线
```
scrape → dedup(dedup_key) → insert(status=pending)
       → classify(content_type, domain)
       → categorize(discovery_category: news/ai_tool/other)
       → summarize(short_summary, short_summary_zh)
       → translate(title_zh, description_zh)
```

### 2.3 Cron 调度（UTC）
| 时间 | 任务 | 说明 |
|---|---|---|
| 00:00 | scrape | 全部爬虫 |
| 00:30 | daily-news | AI 日报 |
| 01:00 | classify | 分类 + 摘要 + 翻译 |
| 01:30 | digest | AI 推荐 + 每日精选 |
| 06:00 | daily-news | 兜底重试 |

---

## 三、当前功能（基线）

### 3.1 Discover 页 (`/discover`)

#### 3.1.1 Editor's Picks（编辑精选）
- 管理员手动标记 `is_featured` 的工具
- 横向轮播展示

#### 3.1.2 Metis Picks（Metis 精选）
- 管理员标记 `is_metis_pick` + 撰写 take（个人点评）
- 网格展示，含 AI 评分

#### 3.1.3 AI Recommended（AI 推荐）
- MiniMax 从当日工具中选 TOP 5
- 展示推荐理由 + 适用场景 + 评分
- 支持手动触发重新生成

#### 3.1.4 本周发现（This Week's Discoveries）
- 按 `discovery_category` 分三组:
  - 📰 AI 动态 (`news`)
  - 🔧 AI 工具 (`ai_tool`)
  - 🌐 其他 (`other`)
- 每组默认展示前 5 项，可展开查看全部
- 按热度（stars/points/votes）排序
- **当前问题**: 查询 `LIMIT 500`，数据量大时截断；分类未成功导致全部落入"其他"

### 3.2 Daily News 页 (`/daily-news`)
- AI 生成的每日科技简报
- 结构: Headlines (3-5 条) + Quick Bites (3-6 条) + Editor's Take
- 年度日历视图，可跳转到任意已发布日期
- 中英双语

### 3.3 Community 页 (`/community`)
- 用户留言板，可匿名或署名提交
- 展示所有社区消息

### 3.4 Admin 页 (`/admin`)
- 密码登录
- 工具审核: pending → approved / skipped
- 内容筛选: content_type / domain / status
- 撰写 take（自动翻译英文）
- 标记 featured / metis-pick
- Newsletter 草稿预览 + 发送（Buttondown）
- 爬虫健康监控

### 3.5 工具详情（弹窗/侧栏）
- 完整元数据: 标签、标题（双语）、描述
- 指标栏: stars / points / comments / votes / first_seen
- AI 推荐信息（如有）: 理由 + 评分 + 适用场景
- Metis 点评（如有）: 管理员 take
- 外链: Visit Project / View Source

### 3.6 Landing 页 (`/`)
- Hero 区: 标语 + 价值主张
- Why Metis: 三点叙事
- What You Get: 四大功能亮点
- 覆盖领域徽章

---

## 四、数据模型（核心表）

### tools
| 字段 | 类型 | 说明 |
|---|---|---|
| id | INTEGER PK | 自增主键 |
| url | TEXT | 工具/项目直链 |
| dedup_key | TEXT UNIQUE | 去重键 |
| title / description | TEXT | 英文标题/描述 |
| title_zh / description_zh | TEXT | 中文翻译 |
| source | TEXT | 主爬虫源 |
| sources | TEXT (JSON) | 所有发现源 |
| source_url | TEXT | 原始页面链接 |
| metrics | TEXT (JSON) | {stars, points, votes, comments...} |
| status | TEXT | pending/approved/skipped/sent |
| content_type | TEXT | tool/library/model/api/article/other |
| domain | TEXT | ai/web/devops/data/security/design/general |
| discovery_category | TEXT | news/ai_tool/other |
| short_summary / short_summary_zh | TEXT | AI 生成的一行摘要 |
| is_featured | INTEGER | 编辑精选标记 |
| is_metis_pick | INTEGER | Metis 精选标记 |
| take / take_en | TEXT | 管理员点评（中/英） |
| first_seen | DATETIME | 首次发现时间 |

### ai_daily_news
| 字段 | 类型 | 说明 |
|---|---|---|
| news_date | TEXT UNIQUE | YYYY-MM-DD |
| headlines | TEXT (JSON) | 主要新闻数组 |
| quick_bites | TEXT (JSON) | 快讯数组 |
| editor_take / editor_take_en | TEXT | 编辑视角 |

### ai_recommendations
| 字段 | 类型 | 说明 |
|---|---|---|
| tool_id | INTEGER | 关联工具 |
| reason / reason_en | TEXT | 推荐理由 |
| use_cases / use_cases_en | TEXT | 适用场景 |
| score | INTEGER | 1-10 评分 |
| created_date | TEXT | 生成日期 |

### 其他表
- `curation_log`: 管理员操作审计
- `issues`: Newsletter 期刊
- `user_messages`: 社区消息
- `daily_digest`: 每日精选 (tool_pick / hot_news)
- `scrape_runs`: 爬虫运行记录
- `cron_logs`: 定时任务日志

---

## 五、API 端点

### 公开端点
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /api/tools | 工具列表（筛选: status, content_type, domain） |
| GET | /api/tools/categories | 各类型/领域计数 |
| GET | /api/discover/featured | 编辑精选 |
| GET | /api/discover/metis-picks | Metis 精选 |
| GET | /api/discover/ai-picks | AI 推荐 |
| GET | /api/discover/today | 今日发现 |
| GET | /api/discover/week | 本周发现 |
| GET | /api/discover/digest | 每日精选 |
| GET | /api/discover/random | 随机工具 |
| GET | /api/daily-news | AI 日报（?date=） |
| GET | /api/daily-news/list | 日报日期列表 |
| GET | /api/messages | 社区消息 |
| POST | /api/messages | 发送消息 |

### 管理端点
| 方法 | 路径 | 说明 |
|---|---|---|
| POST | /api/admin/verify | 登录验证 |
| PATCH | /api/tools/:id | 更新状态/take |
| POST | /api/tools/:id/featured | 切换精选 |
| POST | /api/tools/:id/metis-pick | 切换 Metis Pick |
| POST | /api/discover/ai-picks/generate | 触发 AI 推荐 |
| POST | /api/daily-news/generate | 触发日报生成 |
| POST | /api/issues | 创建期刊 |
| POST | /api/send/:num | 发送期刊 |

### Cron 端点
| 路径 | 说明 |
|---|---|
| /api/cron/scrape | 爬虫 |
| /api/cron/classify | 分类 + 摘要 + 翻译 |
| /api/cron/daily-news | AI 日报 |
| /api/cron/digest | AI 推荐 + 每日精选 |
| /api/cron-logs | 任务日志查询 |

---

## 六、技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 18 + TypeScript + Vite |
| 后端 | Flask (Python 3.13) |
| 数据库 | SQLite (本地) / Turso (生产) |
| AI | MiniMax M2.7-highspeed (OpenAI SDK) |
| 邮件 | Buttondown API |
| 部署 | Vercel (前端 + Functions) |
| 主题 | 暗色/亮色切换，中英双语 |

---

## 七、v0.1.0 改动需求（已确认）

### 7.1 本周发现 — 重新设计

**现状**: 按 `discovery_category` 分为 AI 动态 / AI 工具 / 其他 三组，每组展示该类别下的全部工具（数百项），缺乏筛选。

**改为**: AI 综合评分 + 精选 Top 20 × 3 类别。

#### 7.1.1 综合评分体系

每个工具入库后，计算并存储一个 `trending_score`（综合评分），维度包括:
- **热度指标**: stars / points / votes / comments（归一化后加权）
- **新鲜度**: 越近期发现的得分越高（时间衰减）
- **社区讨论度**: HN comments、多源发现加分
- **AI 价值评估**: MiniMax 对工具的价值/影响力/新颖性打分

**更新时机**: 每天 classify pipeline 运行时，只处理**当天新入库的工具**:
1. 为新工具计算 `trending_score`（已有评分的不重算）
2. 为新工具生成 `ai_intro`（已有简介的不重做）
3. 前端查询时，按 `trending_score` 排序取各类别 Top 20（纯 SQL 查询）

#### 7.1.2 数据存储

tools 表新增字段:
| 字段 | 类型 | 说明 |
|---|---|---|
| trending_score | REAL | AI 综合评分，每日更新 |
| ai_intro | TEXT | AI 生成的结构化简介（英文，2-3 段） |
| ai_intro_zh | TEXT | AI 生成的结构化简介（中文，2-3 段） |

> 字段直接加在 tools 表（与 short_summary 同模式），无需 JOIN，便于管理。

#### 7.1.3 Pipeline 新增步骤

在 classify pipeline 中自动完成，新增两步:

**Step 5 — 综合评分**（仅新工具）
```
输入: trending_score IS NULL 的工具（即当天新入库的）
计算: 热度归一化 + 时间衰减 + AI 价值打分
输出: 更新 tools.trending_score
已有评分的工具不重算
```

**Step 6 — AI 简介生成**（仅新工具）
```
输入: ai_intro IS NULL 的工具（即当天新入库的）
输出: 更新 tools.ai_intro + tools.ai_intro_zh
已有简介的工具不重做
```

> Top 20 的选取不是预计算，而是前端查询时 `ORDER BY trending_score DESC LIMIT 20`。

简介结构:
- 第一段: 是什么 — 一句话定位
- 第二段: 核心能力 — 关键特性和亮点
- 第三段: 适用场景 — 谁适合用、解决什么问题

> 摘要（short_summary）沿用现有逻辑，不变。

#### 7.1.4 前端展示

三个类别（📰 AI 动态 / 🔧 AI 工具 / 🌐 其他）使用**统一的组件和样式**:
- 相同的外框、底色、布局
- 复用同一个渲染函数
- "其他"类别与前两个完全同样式（不再是无框灰色）

| 状态 | 展示数量 |
|---|---|
| 默认 | 每个类别展示 **10 项** |
| 点击"查看全部" | 展开至 **20 项** |

每项展示:
- 编号 + 标题 + 一行摘要（short_summary）
- 保持现有的编号列表样式
- 点击进入详情: 展示 `ai_intro`（结构化简介），替代/补充原有 description

#### 7.1.5 API 变更

| 端点 | 变更 |
|---|---|
| GET /api/discover/week | 返回 Top 60（每类 20），按 trending_score 排序，含 ai_intro 字段 |
| 工具详情 | 新增 ai_intro / ai_intro_zh 字段 |

### 7.2 不变的部分
- 爬虫逻辑、数据源、去重机制
- Editor's Picks、Metis Picks、AI Recommended 保持不变
- Daily News 页保持不变
- Community 页保持不变
- Admin 页保持不变
- 现有 API 端点保持兼容

---

## 八、决策记录

| 问题 | 决策 | 理由 |
|---|---|---|
| AI 筛选算法 | 综合评估（非纯热度） | 热度 + 新鲜度 + AI 价值 多维度 |
| 简介字段存储 | tools 表新增 ai_intro / ai_intro_zh | 与 short_summary 同模式，易管理，无需 JOIN |
| 生成时机 | classify pipeline 自动生成 | 全流程自动化，无需人工干预 |
| 更新频率 | 只对当天新入库的工具算分和生成简介 | Top 20 是查询时排序，不需要重算全表 |
| 前端样式 | 保持现有编号列表 | 先不改 UI，聚焦数据和筛选逻辑 |
| "其他"类别样式 | 与 AI 动态/AI 工具统一 | 复用同一组件，统一外框和底色 |

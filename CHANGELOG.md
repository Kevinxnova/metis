# Changelog

All notable changes to Metis are documented here.

---

## [v0.3.0] — 2026-04-05

### 「本周发现」模块重构

- **三模块拆分**：将原来的单一列表拆分为 📰 AI 动态 / 🔧 AI 工具 / 🌐 其他，按内容类型分区展示
- **AI 智能摘要**：每条内容自动生成「标题 — 一句话功能描述」，不再只显示项目名称
- **自动分类触发**：每次爬虫发现新内容后，自动调用 MiniMax 完成分类和中英文摘要生成
- **AI 推荐自动化**：AI 推荐从手动触发改为每日发现新内容后自动运行

---

## [v0.2.0] — 2026-03

### 社区页、每周视图与 AI 精选

- **社区页** (`/community`)：用户反馈与留言入口
- **本周发现**：展示最近 7 天新发现内容，按热度排序
- **今日精选（Daily Digest）**：AI 每日生成工具推荐和热点新闻摘要
- **AI 推荐**：MiniMax 分析今日工具，选出 TOP 5 并附中英文理由和评分
- **Carousel 优化**：优选榜和 AI 推荐支持平滑滚动、方向箭头
- **AI 推荐快速预览**：推荐列表上方展示「名称 — 一行理由」速览

---

## [v0.1.0] — 2026-02 ～ 2026-03

### 基础功能上线

- **数据抓取**：GitHub Trending、Hacker News、Product Hunt 三源爬虫，每日自动运行
- **工具分类**：自动识别 content_type（工具/库/模型/API等）和 domain（AI/Web/DevOps等）
- **双语支持**：中英文切换，内容自动翻译
- **Discover 页**：优选榜、Metis 推荐、AI 推荐、今日发现四大板块
- **管理后台**：Admin 密码保护，支持设置 featured / metis-pick / 编辑 take
- **部署架构**：Vercel 前端 + Mac mini 后端 + Turso 云数据库 + Cloudflare Tunnel
- **Landing page**：品牌主页，介绍 Metis 定位与功能

---

> 格式参考 [Keep a Changelog](https://keepachangelog.com/)

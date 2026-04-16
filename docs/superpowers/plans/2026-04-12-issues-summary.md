# Metis 问题排查总结 (2026-04-12)

> 基于 4月12日 cron 日志、数据库状态、本地手动复现的完整排查结果。

---

## 问题一：Scrape 三大数据源全部超时

**现象：** 4月12日 00:00 UTC 的 scrape cron，GitHub / HackerNews / ProductHunt 全部超时，只有 RSS 成功（6条新工具）。本地手动重跑也复现了超时。

**Cron 日志：**
```
github:      found=78, new=0, error="The read operation timed out" (67.3s)
hackernews:  found=77, new=0, error="The read operation timed out" (65.3s)
producthunt: error="The read operation timed out" (30.0s)
rss_news:    found=24, new=6, OK (67.5s)
```

**本地手动重跑（约10分钟后）：**
```
github:      found=77, new=1, error="HTTP Error 400" (355s)
hackernews:  found=77, new=2, error="SSL EOF" (275s)
producthunt: "No PRODUCTHUNT_API_TOKEN set, skipping"
rss_news:    found=17, new=3, OK (108s)
```

**分析：**
- GitHub 和 HN 爬虫在 Vercel serverless 环境下容易超时（Vercel 出口 IP 可能被限流）
- ProductHunt 还缺 `PRODUCTHUNT_API_TOKEN` 环境变量，等于完全废了
- 本地虽然能跑但也很慢（GitHub 355s、HN 275s），说明爬虫本身效率也有问题
- 只依赖 RSS 的话素材太少，日报质量下降

**待决策：**
- [ ] 爬虫需要加重试逻辑？还是增大超时时间？
- [ ] Vercel 600s maxDuration 够不够？GitHub 本地就要 355s
- [ ] ProductHunt API token 需要配置到 Vercel 环境变量
- [ ] 是否要在 daily_news 生成前检查素材量，不够的话先重跑 scrape？

---

## 问题二：Scrape 的 skip 逻辑导致无法补数据

**现象：** scrape 任务开头检查当天是否已有工具，如果有就直接 skip。所以凌晨 scrape 部分成功（6条 RSS）后，后续无论手动还是 cron 都无法重跑补数据。

**代码位置：** `backend/cron_tasks.py:28-37`
```python
tool_count = db.execute(
    "SELECT COUNT(*) FROM tools WHERE date(first_seen) = ?", (today,)
).fetchone()[0]
if tool_count > 0:
    return {"status": "skipped", "tools_existing": tool_count}
```

**影响：** 如果第一次 scrape 只跑成功了一个源（比如 RSS），其他源全部超时，当天就再也补不回来了。

**待决策：**
- [ ] skip 逻辑改成按源判断？比如只跳过已经成功的源
- [ ] 或者完全去掉 skip，改用去重（dedup_key）自然处理重复
- [ ] 或者加一个 force 参数，cron 可以选择强制重跑

---

## 问题三：Daily News 生成 HTTP 400

**现象：** 4月12日 daily_news 两次运行（00:30 UTC 和 06:00 UTC）都失败，错误是 `HTTP Error 400: Bad Request`。

**Cron 日志：**
```
00:30 | daily_news | error | dur=1.79s | err=HTTP Error 400: Bad Request | steps={"tools_available": 6}
06:00 | daily_news | error | dur=1.71s | err=HTTP Error 400: Bad Request | steps={"tools_available": 6}
```

**但本地手动跑同样的数据成功了。**

**分析：**
- 错误来自 `_minimax_chat()` 调用 MiniMax API
- 400 是 HTTP 层面返回的，不是 MiniMax base_resp 错误码
- 可能原因：Vercel serverless 环境的网络问题、请求被 MiniMax WAF 拦截、或者是 `max_tokens=196608` 在某些情况下被拒绝
- 目前 `_minimax_chat` 没有捕获 HTTP 400 的 response body，所以看不到 MiniMax 返回的具体错误信息

**待决策：**
- [ ] `_minimax_chat` 需要在 HTTPError 时读取 response body 并记录到日志
- [ ] 是否需要加重试机制（400 可能是暂时性的）
- [ ] daily_news 在 06:00 有第二次 cron 调度，但因为两次都失败了，需要排查是不是同一个原因

---

## 问题四：Classify 空转 551 秒

**现象：** 4月12日 01:00 UTC 的 classify 任务运行了 551 秒（接近 TIME_LIMIT 550s），但三个步骤的结果都是 0：
```
categorized=0, classified=0, translated=0
remaining_categorize=true, remaining_classify=true, remaining_translate=true
```

**根因：** `categorize_and_summarize()` 的返回值逻辑有 bug。

代码流程：
1. Step 1 分类（`_classify_batch`）→ 成功，写入 `discovery_category`
2. Step 2 概要（`_summarize_batch`）→ 失败（网络超时）
3. **返回值是 `summarized` 计数（=0），不是 `categorized` 计数**

然后在 `task_classify` 里：
```python
n = categorize_and_summarize(tool_ids)   # n=0 因为 summarize 全失败
steps["categorized"] += n                 # 记录 0
```

但 `get_uncategorized_tool_ids()` 用的是 `WHERE short_summary IS NULL`，所以分类成功但概要失败的工具仍然会被选中 → 下一轮又拿到同一批 → 分类已有跳不过（因为 classify 不检查是否已分类）→ **反复空转直到超时**。

**影响：**
- 551 秒的 Vercel Function 调用，全在做无用功
- 513 条工具的 `short_summary` 一直是 NULL
- Step 2（content_type/domain）和 Step 3（翻译）完全没有执行机会

**待决策：**
- [ ] `categorize_and_summarize` 需要分离返回值：分类数 + 概要数
- [ ] 或者拆成两个独立函数：`categorize_batch()` 和 `summarize_batch()`
- [ ] `get_uncategorized_tool_ids` 的查询条件需要更精确（区分"未分类"和"未概要"）
- [ ] 分类和概要失败时应该独立重试，不要因为概要失败就卡住分类

---

## 问题五：ProductHunt API Token 缺失

**现象：** 本地手动跑时 ProductHunt 直接跳过：`No PRODUCTHUNT_API_TOKEN set, skipping`

**影响：** 每天少一个数据源，减少了工具发现的多样性。

**待决策：**
- [ ] 需要在 Vercel 环境变量中配置 `PRODUCTHUNT_API_TOKEN`
- [ ] 或者如果不打算用 ProductHunt，就从 scraper 列表中移除

---

## 问题六：历史积压 — 513 条工具缺 short_summary

**现象：** 数据库中有 513 条工具的 `short_summary` 为 NULL。

**原因：** 问题四的连锁效应。classify 任务反复空转，概要步骤从未成功完成。

**影响：** 前端 "This Week's Discoveries" 模块显示不完整。

**待决策：**
- [ ] 修复问题四后，需要手动或分批补跑这 513 条的概要
- [ ] 按优先级处理：最近日期的先做

---

## 当前 Cron 时间线（UTC）和问题点

```
00:00  scrape        → GitHub/HN/PH 超时，只有 RSS 成功
00:30  daily_news    → HTTP 400 失败（素材只有 6 条 RSS）
01:00  classify      → 空转 551s，categorize/summarize 都是 0
01:30  digest        → 成功（但基于有限数据）
06:00  daily_news    → HTTP 400 再次失败
```

## 优先级建议

| 优先级 | 问题 | 原因 |
|--------|------|------|
| P0 | 问题四：classify 空转 | 每天浪费 551s 且阻塞所有后续处理 |
| P0 | 问题三：daily_news 400 | 核心功能完全不工作，且无法从日志定位原因 |
| P1 | 问题二：scrape skip 逻辑 | 部分成功后无法补数据 |
| P1 | 问题一：爬虫超时 | 数据源不可靠影响下游所有功能 |
| P2 | 问题六：513 条积压 | 修复问题四后可以自动消化 |
| P2 | 问题五：ProductHunt token | 配置项缺失 |

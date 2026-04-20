"""Generate daily news using curl for API calls (bypasses Python SSL issues)."""
import os, sys, json, subprocess, re, time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'))

TURSO_URL = os.getenv('TURSO_DATABASE_URL', '').replace('libsql://', 'https://')
TURSO_TOKEN = os.getenv('TURSO_AUTH_TOKEN', '')
MINIMAX_KEY = os.getenv('MINIMAX_API_KEY', '')

def turso_exec(sql, params=None):
    """Execute SQL via Turso HTTP API using curl."""
    stmt = {"sql": sql}
    if params:
        args = []
        for p in params:
            if p is None:
                args.append({"type": "null"})
            elif isinstance(p, (int, float)):
                args.append({"type": "integer", "value": str(p)})
            else:
                args.append({"type": "text", "value": str(p)})
        stmt["args"] = args

    payload = json.dumps({"requests": [{"type": "execute", "stmt": stmt}]})
    for attempt in range(3):
        result = subprocess.run(
            ['curl', '-s', '-m', '30', '-X', 'POST',
             f'{TURSO_URL}/v2/pipeline',
             '-H', f'Authorization: Bearer {TURSO_TOKEN}',
             '-H', 'Content-Type: application/json',
             '--data-binary', '@-'],
            input=payload, capture_output=True, text=True
        )
        if result.stdout:
            data = json.loads(result.stdout)
            res = data['results'][0]
            if res.get('type') == 'error':
                raise Exception(res['error']['message'])
            return res['response']['result']
        print(f"  Turso empty response (attempt {attempt+1}), retrying...")
        time.sleep(3)
    raise Exception("Turso connection failed after 3 attempts")


def minimax_chat(prompt, max_tokens=10000, temperature=0.7):
    """Call MiniMax via curl."""
    payload = json.dumps({
        "model": "MiniMax-M2.7-highspeed",
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": max_tokens,
        "temperature": temperature
    }, ensure_ascii=False)

    for attempt in range(3):
        result = subprocess.run(
            ['curl', '-s', '-m', '120', '-X', 'POST',
             'https://api.minimax.chat/v1/chat/completions',
             '-H', f'Authorization: Bearer {MINIMAX_KEY}',
             '-H', 'Content-Type: application/json',
             '--data-binary', '@-'],
            input=payload, capture_output=True, text=True
        )
        if result.stdout:
            try:
                data = json.loads(result.stdout)
                if 'choices' in data:
                    return data['choices'][0]['message']['content'].strip()
                print(f"  MiniMax response (no choices): {result.stdout[:200]}")
            except json.JSONDecodeError:
                print(f"  MiniMax invalid JSON: {result.stdout[:200]}")
        else:
            print(f"  MiniMax empty response, stderr: {result.stderr[:200]}")
        if attempt < 2:
            time.sleep(5)
    raise Exception("MiniMax call failed after 3 attempts")


def extract_json(text):
    text = re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL).strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
        return text.strip()
    if not text.startswith("{"):
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            return text[start:end]
    return text


PROMPT_TEMPLATE = """你是一位资深 AI 科技记者，请基于以下今日 AI 领域资讯素材，撰写一份专业的 AI 科技日报。

## 素材来源说明
以下数据来自 Hacker News、GitHub Trending、Product Hunt、The Verge、TechCrunch、Ars Technica、MIT Technology Review、VentureBeat、Wired、OpenAI Blog、Google AI Blog 等多个渠道的今日更新，已经过去重和初步分类。

## 输入素材
{news_json}

## 输出要求（严格按此 JSON 结构返回，不要有任何其他文字）

{{"date": "{today}",
  "headlines": [
    {{
      "rank": 1,
      "title": "标题（≤30字，有信息量）",
      "title_en": "English title (≤80 chars)",
      "summary": "2-3句核心要点，提炼关键信息而非复述原文",
      "summary_en": "English summary, 2-3 sentences",
      "source": "来源名称",
      "source_url": "原文链接",
      "tag": "模型发布|融资|开源|产品|政策|研究|工具"
    }}
  ],
  "quick_bites": [
    {{
      "text": "一句话快讯（≤50字）",
      "text_en": "English one-liner",
      "source": "来源",
      "source_url": "链接"
    }}
  ],
  "editor_take": "编辑视角（中文）：3-5句话的趋势分析，要有观点和洞察，不是流水账",
  "editor_take_en": "Editor's take (English): 3-5 sentences with insight"
}}

## 撰写规则
1. headlines 选 3-5 条最重要的新闻，按影响力降序排列
2. quick_bites 选 3-6 条次要但值得关注的信息
3. 去重：同一事件即使来自多个源，只保留一条（选最权威的来源）
4. 标题避免"震惊""重磅"等标题党用词，信息量优先
5. tag 必须从 7 个类别中选一个：模型发布、融资、开源、产品、政策、研究、工具
6. editor_take 需总结当日 AI 领域整体动态，点出最值得关注的趋势或转折点
7. 如果素材不足（<3条有价值信息），headlines 可以少于 3 条，但必须保证质量
8. source_url 必须是真实原文链接，不要编造"""


def generate_for_date(target_date):
    print(f"\n=== Generating daily news for {target_date} ===")

    # Get AI news for the date
    result = turso_exec("""
        SELECT id, url, title, description, source, source_url, metrics,
               content_type, domain, discovery_category, first_seen
        FROM tools
        WHERE date(first_seen) = ?
          AND (domain = 'ai'
               OR source = 'rss_news'
               OR discovery_category = 'news'
               OR content_type IN ('model', 'article'))
        ORDER BY
            COALESCE(
                json_extract(metrics, '$.stars'),
                json_extract(metrics, '$.points'),
                json_extract(metrics, '$.votes'),
                0
            ) DESC
        LIMIT 80
    """, [target_date])

    rows = result.get('rows', [])
    cols = [c['name'] for c in result.get('cols', [])]
    items = []
    source_ids = []
    for row in rows:
        d = {cols[i]: row[i].get('value') if row[i]['type'] != 'null' else None for i in range(len(cols))}
        source_ids.append(d['id'])
        metrics = json.loads(d.get('metrics') or '{}')
        items.append({
            "id": d['id'],
            "title": d['title'],
            "description": (d.get('description') or '')[:200],
            "source": metrics.get('rss_label') or d['source'],
            "source_url": d.get('source_url') or d['url'],
            "content_type": d.get('content_type', 'other'),
            "stars": metrics.get('stars'),
            "points": metrics.get('points'),
        })

    if not items:
        print(f"  No AI news for {target_date}")
        return

    print(f"  Found {len(items)} news items")

    prompt = PROMPT_TEMPLATE.format(
        news_json=json.dumps(items, ensure_ascii=False, indent=2)[:6000],
        today=target_date,
    )

    text = minimax_chat(prompt, max_tokens=10000, temperature=0.7)
    text = extract_json(text)
    data = json.loads(text)

    headlines = data.get('headlines', [])
    quick_bites = data.get('quick_bites', [])
    editor_take = data.get('editor_take', '')
    editor_take_en = data.get('editor_take_en', '')

    # Check if exists
    check = turso_exec("SELECT id FROM ai_daily_news WHERE news_date = ?", [target_date])
    exists = len(check.get('rows', [])) > 0

    if exists:
        turso_exec(
            """UPDATE ai_daily_news SET headlines=?, quick_bites=?, editor_take=?,
               editor_take_en=?, source_tool_ids=?, model=? WHERE news_date=?""",
            [json.dumps(headlines, ensure_ascii=False),
             json.dumps(quick_bites, ensure_ascii=False),
             editor_take, editor_take_en,
             json.dumps(source_ids), 'MiniMax-M2.7-highspeed', target_date]
        )
    else:
        turso_exec(
            """INSERT INTO ai_daily_news (news_date, headlines, quick_bites, editor_take,
               editor_take_en, source_tool_ids, model) VALUES (?,?,?,?,?,?,?)""",
            [target_date, json.dumps(headlines, ensure_ascii=False),
             json.dumps(quick_bites, ensure_ascii=False),
             editor_take, editor_take_en,
             json.dumps(source_ids), 'MiniMax-M2.7-highspeed']
        )

    print(f"  OK: {len(headlines)} headlines")
    for h in headlines:
        print(f"    - {h.get('title', '')}")


if __name__ == '__main__':
    dates = sys.argv[1:] if len(sys.argv) > 1 else []
    if not dates:
        from datetime import date
        dates = [date.today().isoformat()]
    for d in dates:
        generate_for_date(d)

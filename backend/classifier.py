"""Auto-classifier for tools. Rule-based, zero API cost.

Two orthogonal dimensions:
- content_type: what the thing IS (tool, library, model, api, article, other)
- domain: what field it belongs to (ai, web, devops, data, security, design, general)
"""

import re

# --- Content Type Rules ---
# Order matters: first match wins. More specific patterns first.

_MODEL_PATTERNS = [
    r'\b(llm|gpt|claude|gemini|llama|mistral|phi-\d|qwen|deepseek)\b',
    r'\b(language model|foundation model|diffusion model|embedding model)\b',
    r'\b(fine-?tun|LoRA|GGUF|quantiz|ggml|transformer model)\b',
    r'\b(stable diffusion|midjourney|dall-?e|flux)\b',
    r'\b(text-to-|speech-to-|image-to-)\b',
]

_LIBRARY_PATTERNS = [
    r'\b(library|framework|sdk|package|module|crate|gem|pip install|npm install)\b',
    r'\b(react|vue|svelte|angular|django|flask|fastapi|express|rails)\b',
    r'\b(pytorch|tensorflow|jax|scikit|pandas|numpy)\b',
    r'\b(import \w+|require\(|from \w+ import)\b',
]

_API_PATTERNS = [
    r'\b(api|saas|hosted|cloud service|platform|as-a-service)\b',
    r'\b(endpoint|webhook|rest api|graphql api)\b',
    r'\b(pricing|free tier|subscription|pay per)\b',
]

_TOOL_PATTERNS = [
    r'\b(tool|app|application|cli|desktop|editor|ide|browser|extension)\b',
    r'\b(install|download|binary|executable|homebrew|brew install)\b',
    r'\b(open[- ]source (tool|app|alternative))\b',
    r'\b(dashboard|monitor|debugger|profiler|linter|formatter)\b',
]

_ARTICLE_PATTERNS = [
    r'\b(blog|article|paper|essay|tutorial|guide|how[- ]to|write-?up)\b',
    r'\b(research|study|analysis|deep[- ]dive|explained|introduction to)\b',
    r'\b(show hn.*\b(built|made|created|wrote))\b',
    r'\b(lessons learned|postmortem|retrospective|experience)\b',
    r'\b(arxiv|doi\.org|acm\.org|ieee\.org)\b',
]

# --- Domain Rules ---

_AI_PATTERNS = [
    r'\b(ai|artificial intelligence|machine learning|ml|deep learning|dl)\b',
    r'\b(llm|gpt|claude|gemini|llama|neural|transformer|attention)\b',
    r'\b(nlp|natural language|computer vision|cv|reinforcement learning)\b',
    r'\b(prompt|embedding|vector|rag|retrieval.augmented|agent|agentic)\b',
    r'\b(chatbot|copilot|assistant|generative|gen-?ai)\b',
    r'\b(diffusion|gan|vae|autoencoder|classifier|segmentation)\b',
    r'\b(hugging\s?face|openai|anthropic|ollama|vllm|langchain|llamaindex)\b',
]

_WEB_PATTERNS = [
    r'\b(web|frontend|front-?end|backend|back-?end|fullstack|full-?stack)\b',
    r'\b(react|vue|svelte|angular|next\.?js|nuxt|remix|astro)\b',
    r'\b(html|css|javascript|typescript|dom|browser|responsive)\b',
    r'\b(http|rest|graphql|websocket|cors|cookie|session|oauth)\b',
    r'\b(tailwind|bootstrap|sass|webpack|vite|esbuild|bundler)\b',
]

_DEVOPS_PATTERNS = [
    r'\b(devops|ci/?cd|deploy|infrastructure|infra|cloud|container)\b',
    r'\b(docker|kubernetes|k8s|terraform|ansible|helm|nginx)\b',
    r'\b(aws|gcp|azure|vercel|netlify|fly\.io|railway)\b',
    r'\b(linux|unix|shell|bash|terminal|ssh|systemd)\b',
    r'\b(monitoring|logging|observability|prometheus|grafana)\b',
    r'\b(git|github actions|gitlab ci|jenkins|argo)\b',
]

_DATA_PATTERNS = [
    r'\b(data|database|sql|nosql|analytics|bi|warehouse|etl|pipeline)\b',
    r'\b(postgres|mysql|sqlite|mongo|redis|elastic|clickhouse|duckdb)\b',
    r'\b(pandas|polars|spark|dbt|airflow|dagster|kafka)\b',
    r'\b(visualization|chart|graph|plot|dashboard|report)\b',
]

_SECURITY_PATTERNS = [
    r'\b(security|auth|authentication|authorization|encrypt|crypto)\b',
    r'\b(vulnerability|exploit|pentest|firewall|waf|ddos)\b',
    r'\b(oauth|jwt|saml|sso|mfa|2fa|zero[- ]trust)\b',
    r'\b(malware|phishing|ransomware|cve|owasp)\b',
]

_DESIGN_PATTERNS = [
    r'\b(design|ui|ux|figma|sketch|prototype|wireframe)\b',
    r'\b(typography|color|layout|spacing|animation|motion)\b',
    r'\b(icon|illustration|font|svg|canvas)\b',
    r'\b(accessibility|a11y|wcag|aria)\b',
]


def _match_score(text: str, patterns: list[str]) -> int:
    """Count how many pattern groups match the text."""
    score = 0
    for pattern in patterns:
        if re.search(pattern, text, re.IGNORECASE):
            score += 1
    return score


def classify_content_type(title: str, description: str, url: str) -> str:
    """Classify content type based on title, description, and URL."""
    text = f"{title} {description} {url}".lower()

    scores = {
        'model': _match_score(text, _MODEL_PATTERNS),
        'library': _match_score(text, _LIBRARY_PATTERNS),
        'api': _match_score(text, _API_PATTERNS),
        'tool': _match_score(text, _TOOL_PATTERNS),
        'article': _match_score(text, _ARTICLE_PATTERNS),
    }

    # GitHub repos are tools or libraries by default
    if 'github.com' in url and scores['article'] == 0:
        scores['tool'] = max(scores['tool'], 1)

    # HN text posts are articles
    if 'news.ycombinator.com/item' in url and not any(
        url.endswith(ext) for ext in ['.com', '.io', '.dev', '.org']
    ):
        scores['article'] = max(scores['article'], 1)

    best = max(scores, key=lambda k: scores[k])
    return best if scores[best] > 0 else 'other'


def classify_domain(title: str, description: str, url: str) -> str:
    """Classify domain based on title, description, and URL."""
    text = f"{title} {description} {url}".lower()

    scores = {
        'ai': _match_score(text, _AI_PATTERNS),
        'web': _match_score(text, _WEB_PATTERNS),
        'devops': _match_score(text, _DEVOPS_PATTERNS),
        'data': _match_score(text, _DATA_PATTERNS),
        'security': _match_score(text, _SECURITY_PATTERNS),
        'design': _match_score(text, _DESIGN_PATTERNS),
    }

    best = max(scores, key=lambda k: scores[k])
    return best if scores[best] > 0 else 'general'


def classify_tool(tool: dict) -> tuple[str, str]:
    """Classify a tool dict. Returns (content_type, domain)."""
    title = tool.get('title', '')
    desc = tool.get('description', '')
    url = tool.get('url', '')
    return classify_content_type(title, desc, url), classify_domain(title, desc, url)

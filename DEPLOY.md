# Metis 部署指南

架构: Vercel (前端) + Mac mini (后端 + 数据库) + Cloudflare Tunnel

## Mac mini 后端部署

### 1. 克隆仓库
```bash
git clone https://github.com/Kevinxnova/metis.git
cd metis
```

### 2. 一键设置
```bash
chmod +x scripts/setup-mac.sh
./scripts/setup-mac.sh
```

### 3. 配置 .env
```bash
nano .env
# 填入 MINIMAX_API_KEY 等
```

### 4. 启动服务
```bash
# 启动后端 (开机自启)
launchctl load ~/Library/LaunchAgents/com.metis.backend.plist

# 启动定时爬虫 (每12小时)
launchctl load ~/Library/LaunchAgents/com.metis.scraper.plist

# 验证
curl http://localhost:8000/api/health
```

### 5. Cloudflare Tunnel (暴露 API 到公网)
```bash
brew install cloudflared
cloudflared tunnel login
cloudflared tunnel create metis
cloudflared tunnel route dns metis api.你的域名.com

# 启动 tunnel
cloudflared tunnel --url http://localhost:8000 run metis
```

记下 tunnel 分配的 URL (类似 https://xxx.trycloudflare.com)
或者绑定自定义域名 api.你的域名.com

### 管理命令
```bash
# 停止后端
launchctl unload ~/Library/LaunchAgents/com.metis.backend.plist

# 查看日志
tail -f data/backend.log
tail -f data/scrape.log

# 手动触发爬虫
source .venv/bin/activate && python -m backend.scheduler

# 更新代码
git pull && source .venv/bin/activate && pip install -r backend/requirements.txt
launchctl unload ~/Library/LaunchAgents/com.metis.backend.plist
launchctl load ~/Library/LaunchAgents/com.metis.backend.plist
```

## Vercel 前端部署

### 1. 导入项目
- 打开 https://vercel.com/new
- 选择 GitHub 仓库 Kevinxnova/metis
- Framework Preset: Vite
- Root Directory: `frontend`
- Build Command: `npm run build`
- Output Directory: `dist`

### 2. 设置环境变量
在 Vercel 项目 Settings > Environment Variables 添加:
```
VITE_API_URL = https://api.你的域名.com (或 Cloudflare Tunnel URL)
```

### 3. 部署
Vercel 会自动部署。每次 push 到 main 自动更新。

### 4. 更新后端 CORS
在 Mac mini 的 .env 中添加 Vercel 域名:
```
ALLOWED_ORIGINS=https://metis-xxx.vercel.app,http://localhost:5173
```
重启后端生效。

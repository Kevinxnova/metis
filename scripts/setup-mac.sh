#!/bin/bash
# Metis Mac mini setup — run once after git clone
set -e
cd "$(dirname "$0")/.."
PROJECT_DIR=$(pwd)

echo "=== Metis Setup ==="

# Python venv
if [ ! -d .venv ]; then
  echo "Creating Python venv..."
  python3 -m venv .venv
fi
source .venv/bin/activate
pip install -r backend/requirements.txt

# Init DB
python -c "from backend.db import init_db; init_db(); print('DB initialized')"

# .env
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env — edit it to add your API keys"
fi

# Create launchd plist for backend
PLIST_PATH="$HOME/Library/LaunchAgents/com.metis.backend.plist"
cat > "$PLIST_PATH" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.metis.backend</string>
    <key>ProgramArguments</key>
    <array>
        <string>${PROJECT_DIR}/.venv/bin/uvicorn</string>
        <string>backend.api.main:app</string>
        <string>--host</string>
        <string>0.0.0.0</string>
        <string>--port</string>
        <string>8000</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${PROJECT_DIR}</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>${PROJECT_DIR}/.venv/bin:/usr/bin:/bin</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${PROJECT_DIR}/data/backend.log</string>
    <key>StandardErrorPath</key>
    <string>${PROJECT_DIR}/data/backend.err</string>
</dict>
</plist>
PLIST

echo "Backend service created: $PLIST_PATH"

# Create launchd plist for scraper (every 12 hours)
SCRAPE_PLIST="$HOME/Library/LaunchAgents/com.metis.scraper.plist"
cat > "$SCRAPE_PLIST" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.metis.scraper</string>
    <key>ProgramArguments</key>
    <array>
        <string>${PROJECT_DIR}/.venv/bin/python</string>
        <string>-m</string>
        <string>backend.scheduler</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${PROJECT_DIR}</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>${PROJECT_DIR}/.venv/bin:/usr/bin:/bin</string>
    </dict>
    <key>StartInterval</key>
    <integer>43200</integer>
    <key>StandardOutPath</key>
    <string>${PROJECT_DIR}/data/scrape.log</string>
    <key>StandardErrorPath</key>
    <string>${PROJECT_DIR}/data/scrape.err</string>
</dict>
</plist>
PLIST

echo "Scraper cron created: $SCRAPE_PLIST (every 12h)"

echo ""
echo "=== Next steps ==="
echo "1. Edit .env with your API keys"
echo "2. Start backend:  launchctl load ~/Library/LaunchAgents/com.metis.backend.plist"
echo "3. Start scraper:  launchctl load ~/Library/LaunchAgents/com.metis.scraper.plist"
echo "4. Test: curl http://localhost:8000/api/health"
echo "5. Install cloudflared: brew install cloudflared"
echo "6. Run: cloudflared tunnel --url http://localhost:8000"

#!/usr/bin/env bash
# Installs fbdown (Facebook video downloader API) on an Ubuntu server.
# Usage: sudo bash install.sh   (run from the directory containing server.js)
set -euo pipefail

APP_DIR=/opt/fbdown
UNIT=/etc/systemd/system/fbdown.service

[ "$(id -u)" -eq 0 ] || { echo "Please run with sudo: sudo bash install.sh" >&2; exit 1; }

echo "== Node.js =="
if ! command -v node >/dev/null 2>&1; then
  echo "node not found. Install Node 18+ first, e.g.:"
  echo "  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs"
  exit 1
fi
major=$(node -p "process.versions.node.split('.')[0]")
[ "$major" -ge 18 ] || { echo "Node 18+ required (found $(node -v))" >&2; exit 1; }
echo "node $(node -v) OK"

echo "== yt-dlp =="
if ! command -v yt-dlp >/dev/null 2>&1; then
  echo "installing yt-dlp to /usr/local/bin ..."
  curl -sS -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
  chmod +x /usr/local/bin/yt-dlp
fi
yt-dlp --version

echo "== quick connectivity check =="
if curl -sS --max-time 15 -o /dev/null https://www.facebook.com/; then
  echo "facebook.com reachable"
else
  echo "WARNING: cannot reach facebook.com from this server." >&2
fi

echo "== install =="
mkdir -p "$APP_DIR"
cp -f server.js package.json .env.example "$APP_DIR/"
[ -f fbdown.service ] && cp -f fbdown.service "$UNIT"
chmod 755 "$APP_DIR"

systemctl daemon-reload
systemctl enable --now fbdown

echo
sleep 3
systemctl is-active fbdown
echo
echo "Health check:"
curl -s http://localhost:8001/health; echo
echo
echo "Done. Test with:"
echo '  curl -X POST http://localhost:8001/v1/download -H "Content-Type: application/json" -d "{\"url\":\"https://www.facebook.com/.../videos/...\"}"'
echo "Logs: sudo journalctl -u fbdown -f"

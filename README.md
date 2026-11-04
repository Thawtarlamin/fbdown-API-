# fbdown — Facebook video downloader API

Facebook video link ပေးလိုက်ရင် direct mp4 download link ထုတ်ပေးတဲ့ API။
Node 18+၊ npm package လုံးဝမလို။ `yt-dlp` ကို သုံးထားတယ်။

## API

```bash
# health check
curl http://localhost:8001/health

# video link ထုတ်ရန်
curl -X POST http://localhost:8001/v1/download \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://www.facebook.com/.../videos/..."}'
```

Response:

```json
{
  "ok": true,
  "title": "...",
  "uploader": "...",
  "duration": 83,
  "ext": "mp4",
  "download_url": "https://video-....mp4?...",
  "width": 1280,
  "height": 720,
  "hd_url": "https://video-....mp4?...",
  "hd_quality": "720p",
  "qualities": [
    { "quality": "720p", "hd": true, "width": 1280, "height": 720, "audio": true, "download_url": "https://..." },
    { "quality": "360p", "hd": false, "width": 640, "height": 360, "audio": true, "download_url": "https://..." }
  ]
}
```

- `download_url` — အကောင်းဆုံး link (HD ရှိရင် HD ပဲ)
- `hd_url` — HD (720p+) သီးသန့် link၊ HD version မရှိရင် `null`
- `qualities` — ရနိုင်တဲ့ quality အကုန်လုံး၊ အကောင်းဆုံးကနေ အစဉ်လိုက်

`download_url` ကို browser / download manager ထဲ ထည့်ပြီး တိုက်ရိုက်ဒေါင်းလို့ရတယ်။
တချို့ link တွေက အချိန်တိုအတွင်းပဲ သုံးလို့ရတယ် (expire ဖြစ်နိုင်) — ရတာနဲ့ ဒေါင်းပါ။

## လိုအပ်ချက်များ

- Node.js 18+
- `yt-dlp` (PATH ပေါ်မှာ ရှိရမည်)

```bash
# yt-dlp သွင်းနည်း (Ubuntu)
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
  -o /usr/local/bin/yt-dlp
sudo chmod +x /usr/local/bin/yt-dlp
yt-dlp --version
```

## Run

```bash
cp .env.example .env   # PORT ပြောင်းချင်ရင် ပြင်
node server.js          # :8001 မှာ run မယ်
```

systemd နဲ့ run ချင်ရင်:

```bash
sudo mkdir -p /opt/fbdown
sudo cp server.js package.json /opt/fbdown/
sudo cp fbdown.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now fbdown
curl http://localhost:8001/health
```

## Login လိုတဲ့ video တွေအတွက် (optional)

Public video အများစုက login မလိုဘူး။ Private / friends-only video ဆို
browser က cookies ထုတ်ပြီး သုံးရတယ်：

1. Browser extension "Get cookies.txt LOCALLY" သွင်း
2. facebook.com မှာ login ဝင်ပြီး cookies.txt ထုတ်
3. `.env` ထဲမှာ `COOKIES_FILE=/opt/fbdown/cookies.txt` ထည့်
4. Service restart: `sudo systemctl restart fbdown`

⚠️ cookies.txt ကို ဘယ်သူနဲ့မှ မမျှပါနဲ့ — ကိုယ့် Facebook account နဲ့ ဆိုင်တယ်။

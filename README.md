# fbdown — Facebook Video Downloader API

A small, dependency-free Node.js API that turns a Facebook video link into
direct MP4 download links, including an HD link and a full quality list.
It uses [yt-dlp](https://github.com/yt-dlp/yt-dlp) under the hood — no npm
packages are required.

## Features

- `POST /v1/download` — resolve a Facebook video URL to direct MP4 links
- HD support — `hd_url` / `hd_quality` for 720p and above (`null` when no HD version exists)
- Full quality list — one entry per height, best first, with an `audio` flag
- `GET /health` — simple health check
- Zero npm dependencies — only Node.js and `yt-dlp`
- Runs as a systemd service on Ubuntu

## Requirements

- Node.js 18 or newer
- `yt-dlp` on `PATH`

> **yt-dlp and Python:** the latest platform-independent `yt-dlp` binary
> requires Python 3.11+. If your server still has Python 3.10, install the
> standalone Linux binary instead — it does not use the system Python:
>
> ```bash
> # x86_64 (use yt-dlp_linux_aarch64 on ARM64)
> curl -sS -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux \
>   -o /usr/local/bin/yt-dlp
> chmod +x /usr/local/bin/yt-dlp
> yt-dlp --version
> ```

## Quick start (local)

```bash
node server.js
# fbdown listening on :8001
```

Then:

```bash
curl http://localhost:8001/health
# {"ok":true,"service":"fbdown"}
```

## Install on Ubuntu (systemd)

```bash
# 1. Install Node.js 20 (if not already installed)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. Install yt-dlp (standalone binary, see Requirements above)
# 3. Run the installer from this directory (requires root / sudo)
sudo bash install.sh
```

`install.sh` checks Node.js, installs `yt-dlp` if it is missing, copies the
app to `/opt/fbdown`, and enables the `fbdown` systemd service.

Verify:

```bash
systemctl status fbdown
curl http://localhost:8001/health
ss -tlnp | grep 8001   # should show 0.0.0.0:8001
```

### Exposing the API

The service listens on `0.0.0.0:8001`. To reach it from outside the server,
open the port in the firewall — allow SSH first, or you may lock yourself out:

```bash
ufw allow 22/tcp
ufw allow 8001/tcp
ufw enable   # only if ufw was inactive; answer y when prompted
```

> **Security note:** this API has no authentication. Do not expose port 8001
> to the whole internet unless you understand that anyone who can reach it
> can use it. For production use, put it behind a reverse proxy with
> authentication, or restrict access to your own IP address.

## API reference

Base URL: `http://<your-server>:8001` (or `http://localhost:8001` on the server itself).

### `GET /health`

Returns service status.

```bash
curl http://localhost:8001/health
```

```json
{"ok": true, "service": "fbdown"}
```

### `POST /v1/download`

Request body (JSON):

```json
{
  "url": "https://www.facebook.com/share/v/xxxxxxxx/"
}
```

Accepted URL hosts: `facebook.com` (including `www.`, `m.`, `mbasic.`)
and `fb.watch`.

Success response (200):

```json
{
  "ok": true,
  "title": "Video title",
  "uploader": "Page name",
  "duration": 83,
  "thumbnail": "https://...",
  "ext": "mp4",
  "download_url": "https://video-....mp4?...",
  "width": 1280,
  "height": 720,
  "hd_url": "https://video-....mp4?...",
  "hd_quality": "720p",
  "qualities": [
    {
      "quality": "720p",
      "hd": true,
      "width": 1280,
      "height": 720,
      "audio": true,
      "download_url": "https://..."
    },
    {
      "quality": "360p",
      "hd": false,
      "width": 640,
      "height": 360,
      "audio": true,
      "download_url": "https://..."
    }
  ]
}
```

Field notes:

- `download_url` — the best available link (HD first, when the video has one).
- `hd_url` / `hd_quality` — the dedicated HD (≥ 720p) link, or `null` when
  the video has no HD version.
- `qualities` — every available MP4 quality, best first. Use this to let
  users pick a quality in your app.
- `audio: true` means the file includes audio; `false` means video-only.

Error responses:

| Status | Meaning |
|--------|---------|
| 400 | Bad request — missing `url`, or the URL is not a Facebook video link |
| 502 | `yt-dlp` could not resolve the video — it may be private, login-walled, or the link may be broken |
| 404 | Unknown route |

Example:

```bash
curl -X POST http://localhost:8001/v1/download \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://www.facebook.com/share/v/xxxxxxxx/"}'
```

> The returned download links may expire quickly. Download the file as soon
> as you receive a link — do not store links for later use.

## Configuration

Environment variables (see `.env.example`):

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8001` | Port the API listens on |
| `YTDLP_BIN` | `yt-dlp` | Path to the `yt-dlp` executable |
| `COOKIES_FILE` | _(unset)_ | Optional cookies file for login-walled videos (export from your browser with “Get cookies.txt LOCALLY”) |

After changing configuration in `/opt/fbdown`, restart the service:

```bash
systemctl restart fbdown
```

## Project structure

```text
server.js          # the API (Node.js, no npm dependencies)
package.json       # name, version, start script (node server.js)
install.sh         # Ubuntu systemd installer
fbdown.service     # systemd unit (PORT=8001, Restart=always)
.env.example       # PORT, YTDLP_BIN, COOKIES_FILE
```

## Managing the service

```bash
systemctl status fbdown    # status
systemctl restart fbdown   # restart (after a code change)
systemctl stop fbdown      # stop
systemctl disable fbdown   # stop starting on boot
journalctl -u fbdown -f    # live logs
```

Note: after editing code, edit the running copy at `/opt/fbdown/server.js`
(or reinstall with `install.sh`), then restart — editing the source
directory alone does not change the running service.

## Troubleshooting

- **`node not found`** — install Node.js 18+ (see Install on Ubuntu above).
- **`yt-dlp: unsupported Python version`** — install the standalone
  `yt-dlp_linux` binary (see Requirements above) instead of the
  platform-independent `yt-dlp` binary.
- **`Connection refused` on localhost** — the service is not running;
  check `systemctl status fbdown` and `journalctl -u fbdown`.
- **Works on localhost, not from outside** — check that the service is
  listening on `0.0.0.0:8001` (`ss -tlnp | grep 8001`), then check the
  server firewall (`ufw`) and your cloud provider's firewall / security
  group for TCP 8001. Use `http://`, not `https://` — this API has no TLS.
- **Private videos fail with 502** — use a `COOKIES_FILE` (see
  Configuration above). Never share your `cookies.txt` — it belongs to
  your Facebook account.

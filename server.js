// Facebook video downloader API (Node 18+, no npm deps)
// ------------------------------------------------------
// POST /v1/download   {"url": "<facebook video url>"}
//   -> { ok:true, title, uploader, duration, download_url, ... }
// GET  /health        -> { ok:true }
//
// Requires `yt-dlp` on PATH (or YTDLP_BIN=/path/to/yt-dlp).
// Optional: cookies file for login-walled videos -> COOKIES_FILE=./cookies.txt
//   (export from your browser with "Get cookies.txt LOCALLY").
//
// Run:  PORT=8001 node server.js

const http = require("http");
const { execFile } = require("child_process");
const fs = require("fs");

const PORT = parseInt(process.env.PORT || "8001", 10);
const YTDLP = process.env.YTDLP_BIN || "yt-dlp";
const COOKIES = process.env.COOKIES_FILE || "";

function runYtdlp(args, timeoutMs) {
  return new Promise((resolve, reject) => {
    execFile(YTDLP, args, { timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        const why = (stderr || err.message || "").trim().split("\n").slice(-3).join(" | ");
        reject(new Error(why || err.message));
        return;
      }
      resolve(stdout);
    });
  });
}

const FB_RE = /^https?:\/\/(www\.|m\.|mbasic\.)?(facebook\.com|fb\.watch)\//i;

function listMp4Formats(info) {
  const formats = Array.isArray(info.formats) ? info.formats : [];
  const sorted = formats
    .filter((f) => f.url && (f.ext === "mp4" || (f.url || "").includes(".mp4")))
    .sort((a, b) => (b.height || 0) - (a.height || 0) || (b.tbr || 0) - (a.tbr || 0));
  // One entry per distinct height, best first.
  const seen = new Set();
  const out = [];
  for (const f of sorted) {
    const h = f.height || 0;
    if (seen.has(h)) continue;
    seen.add(h);
    out.push({
      quality: h ? `${h}p` : "unknown",
      hd: h >= 720,
      width: f.width || 0,
      height: h,
      audio: f.acodec !== "none",
      download_url: f.url,
    });
  }
  return out;
}

async function resolveFacebook(url) {
  if (!FB_RE.test(url)) throw new Error("URL is not a Facebook video link");
  const args = ["--dump-single-json", "--no-playlist", "--no-warnings"];
  if (COOKIES && fs.existsSync(COOKIES)) args.push("--cookies", COOKIES);
  args.push(url);
  const raw = await runYtdlp(args, 90000);
  let info;
  try {
    info = JSON.parse(raw);
  } catch {
    throw new Error("yt-dlp returned non-JSON output");
  }
  const quals = listMp4Formats(info);
  if (!quals.length) throw new Error("no downloadable mp4 format found (video may be private/login-walled)");
  const progressive = quals.filter((q) => q.audio);
  const best = progressive[0] || quals[0];
  const hd = quals.find((q) => q.hd && q.audio) || quals.find((q) => q.hd) || null;
  return {
    ok: true,
    title: info.title || "",
    uploader: info.uploader || info.channel || "",
    duration: info.duration || 0,
    thumbnail: info.thumbnail || "",
    ext: "mp4",
    // best available link (HD first when the video has it)
    download_url: best.download_url,
    width: best.width,
    height: best.height,
    // dedicated HD link (>=720p); null when the video has no HD version
    hd_url: hd ? hd.download_url : null,
    hd_quality: hd ? hd.quality : null,
    // every available mp4 quality, best first
    qualities: quals,
    note: !best.audio ? "video-only stream (no audio in this file)" : undefined,
  };
}

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(body) });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => {
      data += c;
      if (data.length > 256 * 1024) reject(new Error("body too large"));
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") return sendJson(res, 200, { ok: true, service: "fbdown" });
  if (req.method === "POST" && req.url === "/v1/download") {
    try {
      const body = await readBody(req);
      const { url } = JSON.parse(body || "{}");
      if (!url || typeof url !== "string") return sendJson(res, 400, { ok: false, message: "missing 'url' in JSON body" });
      const out = await resolveFacebook(url.trim());
      return sendJson(res, 200, out);
    } catch (e) {
      const msg = e.message || "failed";
      const code = /not a Facebook|missing 'url'|non-JSON/.test(msg) ? 400 : 502;
      return sendJson(res, code, { ok: false, message: msg });
    }
  }
  return sendJson(res, 404, { ok: false, message: "not found" });
});

server.listen(PORT, () => console.log(`fbdown listening on :${PORT}`));

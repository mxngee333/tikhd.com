# ⚡ TIKHD.APP — Universal Video & Audio Downloader Engine
> Powered by **yt-dlp**, **Audio Catcher IDM**, **Fast TikTok API Mesh**, and **FFmpeg 160kbps LAME**.

---

## 🌟 Overview
**TIKHD.APP** is an elite universal media extraction platform capable of downloading high-definition video and master audio from over 1,000 streaming platforms:
- **TikTok & Douyin**: Instant < 0.8s extraction with zero watermarks via internal feed APIs and TikWM fallback.
- **YouTube (1080p, 720p, 480p, 4K)**: High-speed DASH parallel assembly with 10 concurrent fragments, native H.264 & AAC stream muxing, and residential SOCKS5 proxy rotation.
- **Instagram & Facebook**: Reels, Watch, and Video extraction with RFC 5987 / 6266 dual Content-Disposition headers.
- **Audiomack & SoundCloud**: OAuth 1.0a HMAC-SHA1 stream resolution and direct audio fetching.
- **Audio Catcher IDM Engine**: HLS unencrypted master playlist assembly (`.m3u8`), fragmented MP4 init maps, and direct audio streams (MP3, M4A, AAC, FLAC, WAV).
- **On-the-Fly 160kbps MP3 Transcoding**: Fast, compact, crystal-clear CBR Stereo MP3 streams piped through FFmpeg.

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: `>= 20.x`
- **Python**: `>= 3.10` (for `yt-dlp` execution)
- **FFmpeg**: Available on system `$PATH` (for audio transcoding and DASH muxing)

### 2. Installation
```bash
npm install
```

### 3. Running Locally
```bash
# Start the full-stack server (Vite dev server + API routes)
npm start
# or
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Production Build & Static Site Generation (SSG)
```bash
npm run build
```
Builds the Vite frontend bundle and generates physical SSG HTML files for all canonical routes (`/`, `/blog/`, `/how-to-use/`, `/about/`, `/privacy/`, `/terms/`, `/cookies/`, and all blog articles) along with `sitemap.xml` and `robots.txt`.

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/analyze` | Universal metadata extraction (formats, duration, thumbnail, title) |
| `GET` | `/api/download` | Direct media binary streaming (MP4, MP3 160k, M4A) |
| `POST` / `GET` | `/api/prepare` | Pre-warms YouTube DASH assembly in background |
| `GET` | `/api/status` | Polling endpoint for background assembly status |
| `GET` | `/api/file` | HTTP 206 range delivery of assembled cache files |
| `GET` | `/api/download-file` | Direct CDN download proxy for TikTok and external URLs |
| `GET` | `/api/health` | Healthcheck and engine diagnostics |

---

## ⚙️ Configuration Files
- `proxies.txt`: SOCKS5/HTTP residential proxy pool for anti-bot rotation.
- `cookies.txt`: Netscape format YouTube authentication cookies (auto-sanitized on-the-fly).
- `nixpacks.toml`: Provisioning blueprint for container deployment (Node 22, Python 3, FFmpeg).
- `build-ssg.js`: SSG Prerender, Sitemap generator, and AdSense injector.

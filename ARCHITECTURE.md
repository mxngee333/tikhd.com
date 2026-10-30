# 🏛️ TIKHD.APP UNIVERSAL MEDIA DOWNLOADER — ARCHITECTURE SPECIFICATION
## The 24 Elders — Wave 1: Prometheus (System Architecture)

### 1. Executive Summary
TIKHD.APP is upgraded from a dedicated TikTok video downloader into a **Universal Video & Audio Downloader Engine**.
It leverages the battle-tested, high-performance extraction pipeline from `VIDOGET.COM`:
- **yt-dlp Execution Pipeline** (`youtube-dl-exec`) with multi-tier anti-bot rotation.
- **Audio Catcher IDM Engine** (`audio-catcher-engine.js`) for unencrypted HLS master playlist parsing, fragmented MP4 init maps, and direct audio streams.
- **Audiomack Custom Stream Resolver** (`audiomack-engine.js`) with OAuth 1.0a HMAC-SHA1 signing.
- **Dedicated High-Speed TikTok/Douyin Scrapers** (< 800ms extraction via mobile feed APIs and TikWM fallback).
- **On-the-Fly 160kbps CBR Stereo MP3 Transcoding** via FFmpeg child process pipes.
- **High-Speed DASH Parallel Assembly** with native H.264 & AAC muxing.
- **RFC 5987 / 6266 Dual Content-Disposition** for clean file naming.

---

### 2. High-Level System Architecture

```mermaid
flowchart TD
    User([User / Browser]) -->|URL Input / Smart Paste| Frontend[TIKHD React/TypeScript SPA]
    
    subgraph Frontend Layer
        Frontend -->|Analyze Request| API_Analyze[/api/analyze]
        Frontend -->|Poll YouTube Status| API_Status[/api/status]
        Frontend -->|Download Trigger| API_Download[/api/download]
    end

    subgraph Backend Engine Layer
        API_Analyze --> Router{Platform Router}
        Router -->|TikTok / Douyin| TikTokEngine[Fast TikTok Native API & TikWM]
        Router -->|HLS Stream .m3u8| AudioCatcher[Audio Catcher IDM Engine]
        Router -->|Audiomack| AudiomackEngine[Audiomack OAuth1.0a Engine]
        Router -->|Direct File mp4/mp3| ZeroEgress[Zero-Egress Direct HTTP 307]
        Router -->|YouTube / FB / IG / X| YtDlpEngine[Multi-Tier yt-dlp Mesh]
        
        YtDlpEngine -->|Tier 1: SOCKS5 Proxy| WebsharePool[Residential Proxy Pool]
        YtDlpEngine -->|Tier 2: Cookies| CookieSanitizer[Netscape Cookies Sanitizer]
        YtDlpEngine -->|Tier 3: Android Client| AndroidClient[Emergency Anti-Bot Client]
    end

    subgraph Streaming & Processing Pipeline
        API_Download -->|Audio MP3| FFmpegPipe[FFmpeg 160kbps CBR LAME Transcoder]
        API_Download -->|YouTube HD/4K| DASHAssembly[Parallel DASH In-Flight Cache]
        API_Download -->|Direct Pipe| StreamDelivery[RFC 5987 Stream Delivery]
    end

    FFmpegPipe --> StreamDelivery
    DASHAssembly --> StreamDelivery
    StreamDelivery --> User
```

---

### 3. Service Boundaries & Data Contracts

1. **Extraction Contract (`/api/analyze`)**:
   - Accepts: `{ url: string }`
   - Returns: Standardized media payload containing:
     - `title`, `thumbnail`, `platform`, `duration`, `duration_string`
     - `has_video`, `has_audio`
     - `video_formats`: Array of available qualities (`1080p`, `720p`, `480p`, `360p`)
     - `audio_formats`: Array of audio options (`MP3 160kbps`, `M4A Master`)
     - `original_url`

2. **Stream Contract (`/api/download`)**:
   - Query Parameters: `url`, `format` (`mp4` | `mp3` | `m4a`), `quality` (`1080` | `720` | `480` | `360` | `best`), `title`
   - Yields: Chunked binary HTTP stream with RFC 5987 UTF-8 Content-Disposition header.

3. **Background Assembly Contract (`/api/prepare` & `/api/status`)**:
   - Enables asynchronous processing of 1080p/4K YouTube streams to prevent Cloudflare 524 timeouts.

---

### 4. Compound Leverage Matrix
- **Edge CDN (Firebase Hosting)**: Distributes static HTML/JS/CSS assets with immutable caching.
- **Node.js Express Server**: High-throughput multi-tier video extraction & FFmpeg piping.
- **Client Web APIs**: Clipboard auto-capture, native HTML5 audio preview, zero-lag download triggers.

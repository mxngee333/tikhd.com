# 🛡️ TIKHD.APP UNIVERSAL MEDIA DOWNLOADER — SECURITY & ANTI-BOT SPECIFICATION
## The 24 Elders — Wave 1: Aegis (Security Architecture)

### 1. Anti-Bot Defense & Bot Flag Mitigation
- **Origin-Bound Cookie Sanitization**:
  The system scrubs origin-bound tokens (`__Secure-3PAPISID`) from `cookies.txt` on-the-fly, preventing yt-dlp "The page needs to be reloaded" crashes.
- **Residential & SOCKS5 Proxy Mesh**:
  `proxies.txt` rotates on HTTP 429/403 or signature blocks to bypass cloud datacenter bans.
- **Client Emulation**:
  Player clients automatically fallback from `web` to `android` when unauthenticated extraction fails.
- **Input Sanitization**:
  Strict filename sanitization eliminates illegal filesystem characters (`<>:"/\\|?*`), strip control characters (`\u0000-\u001F`), and clean Unicode quotes (`\u2018`, `\u2019`).
- **Path Traversal Shield**:
  MD5 key verification (`/^[a-f0-9]{32}$/i`) ensures no arbitrary filesystem read is possible on `/api/file`.
- **CORS & Compression**:
  Strict header controls with gzip/deflate compression.

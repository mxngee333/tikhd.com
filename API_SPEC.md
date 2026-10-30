# 📡 TIKHD.APP UNIVERSAL MEDIA DOWNLOADER — API SPECIFICATION
## The 24 Elders — Wave 1: Hermes (API Contracts)

### 1. `POST /api/analyze`
Analyzes any media URL (TikTok, Douyin, YouTube, Facebook, Instagram, Twitter/X, Audiomack, SoundCloud, Vimeo, HLS, or direct link).
- **Request Body**:
  ```json
  {
    "url": "https://www.youtube.com/watch?v=..."
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "title": "Song or Video Title",
    "thumbnail": "https://...",
    "platform": "YouTube / TikTok / Audiomack",
    "duration": 215,
    "duration_string": "03:35",
    "has_video": true,
    "has_audio": true,
    "video_formats": [
      { "format_id": "1080", "ext": "mp4", "label": "Full HD 1080p", "resolution": "1080p" },
      { "format_id": "720", "ext": "mp4", "label": "HD 720p", "resolution": "720p" },
      { "format_id": "480", "ext": "mp4", "label": "SD 480p", "resolution": "480p" },
      { "format_id": "360", "ext": "mp4", "label": "Low 360p", "resolution": "360p" }
    ],
    "audio_formats": [
      { "format_id": "mp3", "ext": "mp3", "label": "High Quality MP3 (160kbps)" },
      { "format_id": "m4a", "ext": "m4a", "label": "Master Stream M4A" }
    ],
    "original_url": "https://..."
  }
  ```

---

### 2. `POST /api/download` (Legacy & Unified Trigger)
Backwards-compatible endpoint for fast TikTok / direct downloads and analysis fallback.
- **Request Body**:
  ```json
  { "url": "https://www.tiktok.com/@user/video/..." }
  ```
- **Response**: Extracted metadata and direct download URL.

---

### 3. `GET /api/download` (Media Stream Delivery)
Streams downloadable media binary.
- **Query Parameters**:
  - `url`: target media URL (encoded)
  - `format`: `mp4` | `mp3` | `m4a` (default: `mp4`)
  - `quality`: `1080` | `720` | `480` | `360` | `best`
  - `title`: desired output title
- **Response**: Binary stream (`video/mp4` or `audio/mpeg`) with RFC 5987 `Content-Disposition`.

---

### 4. `POST /api/prepare` & `GET /api/prepare`
Pre-warms YouTube DASH video assembly in the background.

---

### 5. `GET /api/status`
Checks background assembly status.
- **Query Parameters**: `url`, `quality`, `format`, `title`
- **Response `200 OK`**:
  ```json
  {
    "status": "ready" | "processing",
    "key": "md5_hash",
    "downloadUrl": "/api/file?key=...&title=..."
  }
  ```

---

### 6. `GET /api/file`
Instant HTTP 206 partial content range stream delivery of cached media.

---

### 7. `GET /api/health`
Healthcheck and uptime diagnostic endpoint.

# 🗄️ TIKHD.APP UNIVERSAL MEDIA DOWNLOADER — SCHEMA SPECIFICATION
## The 24 Elders — Wave 1: Atlas (Data Layer & Cache)

### 1. In-Memory Assembly State & Cache (`inFlightYtDownloads`)
```typescript
interface InFlightAssembly {
  cacheKey: string; // MD5 hash of `${mediaUrl}_${safeQuality}`
  promise: Promise<{ filePath: string; size: number; cached: boolean }>;
  createdAt: number;
}
```

### 2. File Cache Storage Schema
- **Directory**: `os.tmpdir()` (`/tmp` or `%TEMP%`)
- **Naming Convention**: `tikhd_yt_${cacheKey}.${format}`
- **TTL**: 25 minutes validity window.
- **Sweeper**: Periodic cleanup daemon running every 15 minutes, unlinking files older than 30 minutes.

### 3. Client LocalStorage Persistence (`tikhd_recent_downloads`)
Stored in browser `localStorage` for 0ms recent download history:
```typescript
interface RecentDownloadItem {
  id: string;
  url: string;
  title: string;
  thumbnail: string;
  platform: string;
  format: 'mp4' | 'mp3' | 'm4a';
  quality?: string;
  timestamp: number;
}
```

### 4. Media Analysis Response Schema
```typescript
interface MediaAnalysisResponse {
  success: boolean;
  title: string;
  thumbnail: string;
  platform: string;
  duration: number;
  duration_string: string;
  has_video: boolean;
  has_audio: boolean;
  url?: string;
  original_url: string;
  video_formats?: Array<{
    format_id: string;
    ext: string;
    label: string;
    resolution: string;
  }>;
  audio_formats?: Array<{
    format_id: string;
    ext: string;
    label: string;
  }>;
  stats?: {
    likes?: number;
    comments?: number;
    shares?: number;
  };
}
```

# ⚙️ TIKHD.APP UNIVERSAL MEDIA DOWNLOADER — DEVOPS & INFRASTRUCTURE SPECIFICATION
## The 24 Elders — Wave 1: Hephaestus (DevOps & Deployment)

### 1. Multi-Target Deployment Topography
1. **Frontend Hosting (Firebase Hosting CDN)**:
   - Site target: `tiktokhd-25f45`
   - Static prerender output directory: `dist/`
   - SSG prerender script generates physical static routes for high SEO authority: `/`, `/blog/`, `/how-to-use/`, etc.
   - Cache control: immutable caching on bundled assets (`/assets/**`), dynamic revalidation for HTML.

2. **Backend API Execution**:
   - Local / VPS / Container: `server.ts` powered by Node.js, `tsx`, `yt-dlp`, and `ffmpeg`.
   - Nixpacks configuration (`nixpacks.toml`): provisions `nodejs_22`, `python3`, and `ffmpeg` in containerized environments (Railway, Coolify, VPS).
   - Firebase Functions: serverless proxy fallback in `functions/` for cloud edge processing.

### 2. Build Pipeline
```bash
npm run build # executes 'vite build && node build-ssg.js'
```

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import compression from "compression";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import os from "os";
import crypto from "crypto";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import axios from "axios";
import https from "https";
import zlib from "zlib";
import * as cheerio from "cheerio";
import youtubedl from "youtube-dl-exec";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const audioCatcher = require("./audio-catcher-engine.cjs");
const audiomack = require("./audiomack-engine.cjs");

// ============================================================================
// 1. HELPER FUNCTIONS & CONFIGURATION
// ============================================================================

function sanitizeFilename(name: string): string {
  if (!name) return "TIKHD Media";
  return name
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[.\s]+|[.\s]+$/g, "")
    .slice(0, 150) || "TIKHD Media";
}

function getResolutionSuffix(quality?: string): string {
  const q = (quality || "").toLowerCase().trim();
  if (q === "1080") return "-1080p";
  if (q === "720") return "-720p";
  if (q === "480") return "-480p";
  if (q === "360") return "-360p";
  if (q === "1440") return "-1440p";
  if (q === "2160") return "-2160p";
  if (q === "best" || q === "max") return "-4K";
  if (/^\d+p?$/i.test(q)) {
    return q.endsWith("p") ? `-${q}` : `-${q}p`;
  }
  return q ? `-${q}` : "";
}

function buildMediaFilename(rawTitle: string, format: string = "mp4", quality?: string): string {
  let clean = sanitizeFilename(rawTitle);
  const fmt = (format || "mp4").toLowerCase();
  if (fmt === "mp4") {
    const suffix = getResolutionSuffix(quality);
    clean = clean.replace(/[-_ ]+(1080p|720p|480p|360p|1440p|2160p|4k|max 4k hd)$/i, "").trim();
    return `${clean}${suffix}.mp4`;
  }
  if (fmt === "mp3" || fmt === "audio") {
    return `${clean}.mp3`;
  }
  if (fmt === "m4a") {
    return `${clean}.m4a`;
  }
  return `${clean}.${fmt}`;
}

function makeContentDisposition(filename: string): string {
  const raw = String(filename || "TIKHD Media").trim();
  const ascii = raw
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/["\\;]/g, "")
    .replace(/\s+/g, " ")
    .trim() || "TIKHD Media";
  const encoded = encodeURIComponent(raw)
    .replace(/['()*]/g, c => "%" + c.charCodeAt(0).toString(16).toUpperCase());
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

function formatDuration(sec: number): string {
  const s = Math.floor(sec || 0);
  const m = Math.floor(s / 60);
  const remainingS = s % 60;
  return `${m.toString().padStart(2, "0")}:${remainingS.toString().padStart(2, "0")}`;
}

// Netscape cookies sanitizer: strips origin-bound tokens like __Secure-3PAPISID
function getSanitizedCookieFile(): string | null {
  const cookieFile = path.join(__dirname, "cookies.txt");
  let raw = "";
  if (process.env.YOUTUBE_COOKIES) {
    raw = process.env.YOUTUBE_COOKIES.replace(/\\n/g, "\n");
  } else if (fs.existsSync(cookieFile)) {
    try {
      raw = fs.readFileSync(cookieFile, "utf8");
    } catch (e: any) {
      console.error("[Cookies] Error reading cookies.txt:", e.message);
    }
  }

  if (raw) {
    const sanitized = raw
      .split("\n")
      .filter(l => !l.includes("__Secure-3PAPISID"))
      .join("\n");
    try {
      fs.writeFileSync(cookieFile, sanitized, "utf8");
      return cookieFile;
    } catch (e: any) {
      console.error("[Cookies] Error writing sanitized cookies:", e.message);
    }
  }

  return fs.existsSync(cookieFile) ? cookieFile : null;
}

// Proxy pool manager with automatic round-robin and fallback rotation
let proxyIndex = 0;
function getActiveProxy(): string | null {
  if (process.env.YOUTUBE_PROXY) {
    return process.env.YOUTUBE_PROXY;
  }
  const proxiesFile = path.join(__dirname, "proxies.txt");
  if (fs.existsSync(proxiesFile)) {
    try {
      const lines = fs.readFileSync(proxiesFile, "utf8")
        .split("\n")
        .map(l => l.trim())
        .filter(l => l && !l.startsWith("#"));
      if (lines.length > 0) {
        return lines[proxyIndex % lines.length];
      }
    } catch (e: any) {
      console.error("[Proxies] Error reading proxies.txt:", e.message);
    }
  }
  return null;
}

function rotateProxy(): string | null {
  proxyIndex++;
  const next = getActiveProxy();
  console.log(`[Proxies] Rotated proxy to index #${proxyIndex} -> ${next ? next.replace(/:[^:]+@/, ":****@") : "none"}`);
  return next;
}

// yt-dlp option generator with multi-tier anti-bot resilience
function getYtDlpOptions(
  cleanUrl: string,
  customOptions: Record<string, any> = {},
  ignoreCookies = false,
  playerClient: string | null = null,
  useProxy = true
): Record<string, any> {
  const isYouTube = cleanUrl.includes("youtube.com") || cleanUrl.includes("youtu.be");
  const base: Record<string, any> = {
    noWarnings: true,
    noCheckCertificate: true,
    noPlaylist: true,
    ...customOptions
  };

  if (isYouTube) {
    const clientToUse = playerClient || "tv_embedded";
    if (!base.extractorArgs) {
      base.extractorArgs = `youtube:player_client=${clientToUse}`;
    }
    if (!ignoreCookies) {
      const cookieFile = getSanitizedCookieFile();
      if (cookieFile) {
        base.cookies = cookieFile;
      }
    }
    if (useProxy) {
      const proxy = getActiveProxy();
      if (proxy) {
        base.proxy = proxy;
      }
    }
  } else {
    base.addHeader = [
      "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      "Accept-Language: en-US,en;q=0.9"
    ];
  }
  return base;
}

// In-flight active video download assembly promises (URL + quality -> Promise)
const inFlightYtDownloads = new Map<string, Promise<{ filePath: string; size: number; cached: boolean }>>();

// Periodic cache cleaner: Prunes temp videos older than 30 minutes
setInterval(() => {
  try {
    const tempDir = os.tmpdir();
    const files = fs.readdirSync(tempDir);
    const now = Date.now();
    for (const file of files) {
      if (file.startsWith("tikhd_yt_") && file.endsWith(".mp4")) {
        const fullPath = path.join(tempDir, file);
        try {
          const stat = fs.statSync(fullPath);
          if (now - stat.mtimeMs > 30 * 60 * 1000) {
            fs.unlinkSync(fullPath);
            console.log(`[Cache Pruner] Removed expired temp file: ${file}`);
          }
        } catch (e) {}
      }
    }
  } catch (err: any) {
    console.warn("[Cache Pruner] Error during prune sweep:", err.message);
  }
}, 15 * 60 * 1000);

async function assembleYouTubeVideo(mediaUrl: string, quality: string = "1080"): Promise<{ filePath: string; size: number; cached: boolean }> {
  const safeQuality = (quality || "1080").toLowerCase();
  const cacheKey = crypto.createHash("md5").update(`${mediaUrl}_${safeQuality}`).digest("hex");
  const tempDir = os.tmpdir();
  const tempFileName = `tikhd_yt_${cacheKey}.mp4`;
  const tempFilePath = path.join(tempDir, tempFileName);

  // 1. Fast Cache Hit (< 20 mins old and > 1KB)
  if (fs.existsSync(tempFilePath)) {
    try {
      const stat = fs.statSync(tempFilePath);
      const ageMs = Date.now() - stat.mtimeMs;
      if (stat.size > 1000 && ageMs < 20 * 60 * 1000) {
        console.log(`[Download Cache] Instant Cache Hit! Serving: ${tempFileName} (${stat.size} bytes, age: ${Math.round(ageMs / 1000)}s)`);
        return { filePath: tempFilePath, size: stat.size, cached: true };
      }
    } catch (e) {}
  }

  // 2. Attach to in-flight assembly if already downloading
  if (inFlightYtDownloads.has(cacheKey)) {
    console.log(`[Download InFlight] Joining active in-flight assembly for: ${cacheKey}`);
    return await inFlightYtDownloads.get(cacheKey)!;
  }

  // 3. High-Speed DASH Parallel Assembly
  let downloadFormat = "bestvideo[height<=1080][vcodec^=avc]+bestaudio[ext=m4a]/bestvideo[height<=1080][vcodec^=avc]+bestaudio/bestvideo[height<=1080]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio/best";
  if (safeQuality === "720") {
    downloadFormat = "bestvideo[height<=720][vcodec^=avc]+bestaudio[ext=m4a]/bestvideo[height<=720][vcodec^=avc]+bestaudio/bestvideo[height<=720]+bestaudio[ext=m4a]/bestvideo[height<=720]+bestaudio/best";
  } else if (safeQuality === "480") {
    downloadFormat = "bestvideo[height<=480][vcodec^=avc]+bestaudio[ext=m4a]/bestvideo[height<=480][vcodec^=avc]+bestaudio/bestvideo[height<=480]+bestaudio[ext=m4a]/bestvideo[height<=480]+bestaudio/best";
  } else if (safeQuality === "360") {
    downloadFormat = "bestvideo[height<=360][vcodec^=avc]+bestaudio[ext=m4a]/bestvideo[height<=360][vcodec^=avc]+bestaudio/bestvideo[height<=360]+bestaudio[ext=m4a]/bestvideo[height<=360]+bestaudio/best";
  } else if (safeQuality === "1440") {
    downloadFormat = "bestvideo[height<=1440][vcodec^=vp09]+bestaudio[ext=m4a]/bestvideo[height<=1440][vcodec^=vp9]+bestaudio[ext=m4a]/bestvideo[height<=1440]+bestaudio[ext=m4a]/bestvideo[height<=1440]+bestaudio/best";
  } else if (safeQuality === "2160") {
    downloadFormat = "bestvideo[height<=2160][vcodec^=vp09]+bestaudio[ext=m4a]/bestvideo[height<=2160][vcodec^=vp9]+bestaudio[ext=m4a]/bestvideo[height<=2160]+bestaudio[ext=m4a]/bestvideo[height<=2160]+bestaudio/best";
  } else if (safeQuality === "best" || safeQuality === "max") {
    downloadFormat = "bestvideo[vcodec^=vp09]+bestaudio[ext=m4a]/bestvideo[vcodec^=vp9]+bestaudio[ext=m4a]/bestvideo[vcodec^=av01]+bestaudio[ext=m4a]/bestvideo+bestaudio[ext=m4a]/bestvideo+bestaudio/best";
  }

  const assemblyPromise = (async () => {
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const downloadOpts = getYtDlpOptions(mediaUrl, {
        format: downloadFormat,
        output: tempFilePath,
        mergeOutputFormat: "mp4",
        concurrentFragments: 10,
        bufferSize: "256K",
        noMtime: true,
        noCheckFormats: true,
        postprocessorArgs: "ffmpeg:-threads 0 -c copy -movflags +faststart"
      }, false, "tv_embedded", true);

      console.log(`[Download] Assembling YouTube HD video (attempt ${attempt}/${maxAttempts}): ${tempFilePath}`);
      try {
        await youtubedl(mediaUrl, downloadOpts);
        if (fs.existsSync(tempFilePath)) {
          const stat = fs.statSync(tempFilePath);
          if (stat.size > 1000) {
            console.log(`[Download] YouTube video assembly completed successfully (${stat.size} bytes).`);
            return { filePath: tempFilePath, size: stat.size, cached: false };
          }
        }
      } catch (ytErr: any) {
        console.warn(`[Download] Attempt ${attempt} failed, rotating proxy... Error: ${ytErr.message?.slice(0, 120)}`);
        rotateProxy();
        try { if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath); } catch (e) {}
      }
    }
    throw new Error("YouTube video assembly failed across all retry attempts");
  })();

  inFlightYtDownloads.set(cacheKey, assemblyPromise);
  try {
    return await assemblyPromise;
  } finally {
    inFlightYtDownloads.delete(cacheKey);
  }
}

// Resilient streaming helper with auto-fallback to guarantee complete downloads
function streamMediaWithFallback(
  mediaUrl: string,
  primaryOpts: Record<string, any>,
  fallbackOpts: Record<string, any> | null,
  res: Response,
  errorLabel: string,
  extraOpts: { transcodeToMp3?: boolean; title?: string } = {}
) {
  const { transcodeToMp3 = false, title = "TIKHD_Audio" } = extraOpts;
  let hasSentData = false;
  let primaryStderr = "";
  let ffmpegProc: any = null;
  let activeCp: any = null;

  function attachStreamPipeline(sourceCp: any, firstChunk: Buffer) {
    hasSentData = true;
    activeCp = sourceCp;

    if (transcodeToMp3) {
      console.log(`[${errorLabel}] Spawning FFmpeg transcode pipeline: 160kbps CBR Stereo 44.1kHz MP3...`);
      ffmpegProc = spawn("ffmpeg", [
        "-loglevel", "error",
        "-i", "pipe:0",
        "-vn",
        "-c:a", "libmp3lame",
        "-b:a", "160k",
        "-ar", "44100",
        "-ac", "2",
        "-id3v2_version", "3",
        "-metadata", `title=${title}`,
        "-metadata", "encoded_by=TIKHD_Universal_Audio_v2.0",
        "-f", "mp3",
        "pipe:1"
      ], { stdio: ["pipe", "pipe", "pipe"] });

      ffmpegProc.stderr.on("data", (d: Buffer) => {
        console.error(`[${errorLabel} FFmpeg Stderr]:`, d.toString().trim());
      });

      ffmpegProc.on("error", (err: any) => {
        console.error(`[${errorLabel} FFmpeg] Process error:`, err);
        if (!res.headersSent) res.status(500).send(`${errorLabel} transcode error`);
      });

      ffmpegProc.stdout.pipe(res);
      ffmpegProc.stdin.write(firstChunk);
      sourceCp.stdout.pipe(ffmpegProc.stdin);

      sourceCp.stdout.on("end", () => {
        try { ffmpegProc.stdin.end(); } catch (e) {}
      });
    } else {
      res.write(firstChunk);
      sourceCp.stdout.pipe(res);
    }
  }

  let primaryCp: any = null;
  let fallbackCp: any = null;

  res.on("close", () => {
    if (primaryCp) {
      try { primaryCp.kill("SIGKILL"); } catch (e) {}
    }
    if (fallbackCp) {
      try { fallbackCp.kill("SIGKILL"); } catch (e) {}
    }
    if (ffmpegProc) {
      try { ffmpegProc.kill("SIGKILL"); } catch (e) {}
    }
  });

  primaryCp = youtubedl.exec(mediaUrl, primaryOpts);
  primaryCp.catch(() => {});

  primaryCp.stderr.on("data", (d: Buffer) => {
    const str = d.toString();
    primaryStderr += str;
    console.error(`[${errorLabel} Stderr]:`, str);
  });

  primaryCp.stdout.once("data", (chunk: Buffer) => {
    attachStreamPipeline(primaryCp, chunk);
  });

  let fallbackTriggered = false;
  function triggerFallback() {
    if (fallbackTriggered) return;
    fallbackTriggered = true;
    console.warn(`[${errorLabel}] Retrying stream with fallback options...`);

    if (primaryCp) {
      try { primaryCp.kill("SIGKILL"); } catch (e) {}
    }

    if (!fallbackOpts) {
      if (!res.headersSent) res.status(500).send(`${errorLabel} stream error`);
      return;
    }

    fallbackCp = youtubedl.exec(mediaUrl, fallbackOpts);
    fallbackCp.catch(() => {});
    fallbackCp.stderr.on("data", (d: Buffer) => console.error(`[${errorLabel} Fallback Stderr]:`, d.toString()));

    fallbackCp.stdout.once("data", (chunk: Buffer) => {
      attachStreamPipeline(fallbackCp, chunk);
    });

    fallbackCp.on("error", (err: any) => {
      console.error(`[${errorLabel} Fallback] Error:`, err);
      if (!res.headersSent) res.status(500).send(`${errorLabel} stream error`);
    });

    fallbackCp.on("close", (code: number) => {
      if (!hasSentData) {
        console.error(`[${errorLabel} Fallback] Exited with code ${code} without data.`);
        if (!res.headersSent) res.status(500).send(`${errorLabel} download failed`);
      }
    });
  }

  primaryCp.on("error", (err: any) => {
    console.error(`[${errorLabel}] Process error:`, err);
    if (!hasSentData && fallbackOpts) {
      triggerFallback();
    } else if (!res.headersSent) {
      res.status(500).send(`${errorLabel} stream error`);
    }
  });

  primaryCp.on("close", (code: number) => {
    if (!hasSentData) {
      console.warn(`[${errorLabel}] Primary stream exited with code ${code} without data.`);
      if (fallbackOpts) {
        triggerFallback();
      } else if (!res.headersSent) {
        res.status(500).send(`${errorLabel} failed to stream`);
      }
    }
  });
}

// Native TikTok / Douyin Scraping Engine
async function scrapeTikTokFast(url: string) {
  let itemId = (url.match(/\/(?:video|photo|v)\/(\d+)/) || url.match(/item_id=(\d+)/) || [])[1];

  if (!itemId) {
    try {
      const oembed = await axios.get(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, { timeout: 5000 });
      itemId = oembed.data?.embed_product_id;
    } catch (e) {}
  }

  if (!itemId) {
    try {
      const response = await axios.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Referer": "https://www.tiktok.com/",
        },
        maxRedirects: 10,
        timeout: 6000,
      });
      const redirectedUrl = response.request?.res?.responseUrl || url;
      const finalUrl = redirectedUrl.split("?")[0];
      const match = finalUrl.match(/\/(?:video|photo|v)\/(\d+)/) || finalUrl.match(/item_id=(\d+)/);
      if (match) itemId = match[1];
    } catch (e) {}
  }

  // Multi-host internal mobile API with gzip decompression
  if (itemId) {
    const hosts = [
      "api16-core-c-useast1a.tiktokv.com",
      "api19-core-c-useast1a.tiktokv.com",
      "api.tiktokv.com"
    ];

    for (const h of hosts) {
      try {
        const item: any = await new Promise((resolve, reject) => {
          https.get(`https://${h}/aweme/v1/feed/?aweme_id=${itemId}`, {
            headers: {
              "User-Agent": "com.zhiliaoapp.musically/2022600030 (Linux; U; Android 7.1.2; es_ES; SM-G988N; Build/NRD90M;tt-ok/3.12.13.1)",
              "Accept-Encoding": "gzip, deflate"
            },
            timeout: 6000
          }, res => {
            let stream: any = res;
            if (res.headers["content-encoding"] === "gzip") {
              stream = res.pipe(zlib.createGunzip());
            } else if (res.headers["content-encoding"] === "deflate") {
              stream = res.pipe(zlib.createInflate());
            }
            const chunks: Buffer[] = [];
            stream.on("data", (c: Buffer) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
            stream.on("end", () => {
              try {
                const raw = Buffer.concat(chunks).toString("utf8");
                const j = JSON.parse(raw);
                resolve(j.aweme_list?.[0]);
              } catch (err) {
                reject(err);
              }
            });
            stream.on("error", reject);
          }).on("error", reject);
        });

        if (item) {
          const videoUrl = item.video?.play_addr?.url_list?.[0] || "";
          return {
            title: item.desc || "TikTok Video",
            author: item.author?.nickname || item.author?.unique_id || "@creator",
            thumbnail: item.video?.cover?.url_list?.[0] || "",
            downloadUrl: videoUrl,
            duration: Math.round((item.duration || 0) / 1000),
            stats: {
              likes: item.statistics?.digg_count || 0,
              comments: item.statistics?.comment_count || 0,
              shares: item.statistics?.share_count || 0
            }
          };
        }
      } catch (err: any) {
        console.warn(`[TikTok Fast] Host ${h} note:`, err.message);
      }
    }
  }

  // TikWM fallback
  try {
    const tikwmUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`;
    const twResponse = await axios.get(tikwmUrl, {
      timeout: 8000,
      headers: {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });
    if (twResponse.data?.data) {
      const twData = twResponse.data.data;
      const getAbsUrl = (p: string) => (!p ? "" : p.startsWith("http") ? p : `https://www.tikwm.com${p}`);
      return {
        title: twData.title || "TikTok Video",
        author: twData.author?.nickname || twData.author?.unique_id || "@user",
        thumbnail: getAbsUrl(twData.cover),
        downloadUrl: getAbsUrl(twData.play),
        duration: twData.duration || 0,
        stats: {
          likes: twData.digg_count || 0,
          comments: twData.comment_count || 0,
          shares: twData.share_count || 0
        }
      };
    }
  } catch (e) {}

  return null;
}

// ============================================================================
// 2. EXPRESS SERVER INITIALIZATION
// ============================================================================

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Gzip compression & CORS
  app.use(compression());
  app.use(cors({ origin: "*" }));
  app.use(express.json());

  // Static assets caching in production
  app.use(express.static(path.join(__dirname, "public"), {
    maxAge: "1d",
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".js") || filePath.endsWith(".css") ||
          filePath.endsWith(".png") || filePath.endsWith(".ico") ||
          filePath.endsWith(".svg") || filePath.endsWith(".webmanifest")) {
        res.setHeader("Cache-Control", "public, max-age=604800, immutable");
      } else {
        res.setHeader("Cache-Control", "public, max-age=86400");
      }
    }
  }));

  // Healthcheck endpoint
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      engine: "TIKHD Universal Media Downloader v2.0.0 (yt-dlp + Audio Catcher IDM + Fast TikTok)",
      uptime: process.uptime()
    });
  });

  // ==========================================================================
  // 3. UNIVERSAL ANALYZE ENDPOINT (/api/analyze)
  // ==========================================================================
  app.post("/api/analyze", async (req: Request, res: Response) => {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    const cleanUrl = String(url).trim();
    console.log(`[Analyze] Processing Universal URL: ${cleanUrl}`);

    try {
      // 1. TikTok / Douyin specialized fast lane
      const isTikTok = cleanUrl.includes("tiktok.com") || cleanUrl.includes("douyin.com");
      if (isTikTok) {
        console.log("[Analyze] Routing through Fast TikTok Engine...");
        try {
          const fastResult = await scrapeTikTokFast(cleanUrl);
          if (fastResult) {
            return res.json({
              success: true,
              title: fastResult.title,
              thumbnail: fastResult.thumbnail,
              platform: "TikTok",
              author: fastResult.author,
              duration: fastResult.duration || 0,
              duration_string: formatDuration(fastResult.duration || 0),
              has_video: true,
              has_audio: true,
              downloadUrl: fastResult.downloadUrl,
              original_url: cleanUrl,
              video_formats: [
                { format_id: "hd_nowatermark", ext: "mp4", label: "HD Video (No Watermark)", resolution: "HD" },
                { format_id: "1080", ext: "mp4", label: "Full HD 1080p", resolution: "1080p" },
                { format_id: "720", ext: "mp4", label: "HD 720p", resolution: "720p" }
              ],
              audio_formats: [
                { format_id: "mp3", ext: "mp3", label: "MP3 Audio (160kbps)" },
                { format_id: "m4a", ext: "m4a", label: "Original Audio (M4A)" }
              ],
              stats: fastResult.stats
            });
          }
        } catch (fastErr: any) {
          console.warn("[Analyze] Fast TikTok extraction failed, falling back to yt-dlp:", fastErr.message);
        }
      }

      // 2. Direct HLS audio playlist (.m3u8) check via Audio Catcher
      if (audioCatcher.isHls(cleanUrl)) {
        console.log("[Analyze] HLS Manifest detected, parsing via Audio Catcher engine");
        try {
          await audioCatcher.resolveMediaPlaylist(cleanUrl);
          return res.json({
            success: true,
            title: "HLS Audio Stream",
            thumbnail: "",
            platform: "HLS Audio Stream",
            duration: 0,
            duration_string: "Live / HLS",
            has_video: false,
            has_audio: true,
            original_url: cleanUrl,
            audio_formats: [
              { format_id: "m4a", ext: "m4a", label: "Audio M4A / AAC (HLS Stream)" },
              { format_id: "mp3", ext: "mp3", label: "Audio MP3 (160kbps)" }
            ]
          });
        } catch (hlsErr: any) {
          console.warn("[Analyze] Audio Catcher HLS resolve note:", hlsErr.message);
        }
      }

      // 3. Direct Audio file check (.mp3, .m4a, .aac, .flac, .wav, .ogg, etc.)
      if (audioCatcher.isDirectAudio(cleanUrl)) {
        const ext = audioCatcher.detectDirectAudioExt(cleanUrl);
        const filename = path.basename(new URL(cleanUrl).pathname) || `audio.${ext}`;
        return res.json({
          success: true,
          title: filename,
          thumbnail: "",
          platform: "Direct Audio File",
          duration: 0,
          duration_string: "Audio",
          has_video: false,
          has_audio: true,
          original_url: cleanUrl,
          audio_formats: [
            { format_id: ext, ext: ext, label: `Direct ${ext.toUpperCase()}` }
          ]
        });
      }

      // 4. Audiomack platform check
      if (audiomack.isAudiomack(cleanUrl)) {
        console.log("[Analyze] Audiomack track detected, analyzing via Audiomack Engine");
        try {
          const track = await audiomack.resolveTrack(cleanUrl);
          return res.json({
            success: true,
            title: track.title,
            thumbnail: track.thumbnail,
            platform: "Audiomack",
            duration: track.duration,
            duration_string: formatDuration(track.duration),
            has_video: false,
            has_audio: true,
            original_url: cleanUrl,
            audio_formats: [
              { format_id: "mp3", ext: "mp3", label: "MP3 Audio (High Quality 160kbps)" },
              { format_id: "m4a", ext: "m4a", label: "M4A Audio (Original Master Stream)" }
            ]
          });
        } catch (amErr: any) {
          console.error("[Analyze] Audiomack resolve error:", amErr.message);
        }
      }

      // 5. Universal Video/Audio analysis via yt-dlp
      let output: any;
      const isYouTube = cleanUrl.includes("youtube.com") || cleanUrl.includes("youtu.be");

      if (isYouTube) {
        const tiers = [
          // Tier 1: SOCKS5 Webshare residential proxy pool with tv_embedded client (0 bot check, 40+ formats)
          { client: "tv_embedded", useCookies: false, useProxy: true },
          // Tier 2: SOCKS5 proxy with ios client
          { client: "ios", useCookies: false, useProxy: true },
          // Tier 3: SOCKS5 proxy with mweb client
          { client: "mweb", useCookies: false, useProxy: true },
          // Tier 4: SOCKS5 proxy with cookies if present
          { client: "tv_embedded", useCookies: true, useProxy: true },
          // Tier 5: Direct with tv_embedded
          { client: "tv_embedded", useCookies: false, useProxy: false },
          // Tier 6: Direct with ios
          { client: "ios", useCookies: false, useProxy: false }
        ];

        let lastErr: any = null;
        for (const tier of tiers) {
          try {
            console.log(`[Analyze] Probing YouTube tier: [${tier.client || "standard"}], proxy=${tier.useProxy}`);
            const opts = getYtDlpOptions(cleanUrl, { dumpSingleJson: true }, !tier.useCookies, tier.client, tier.useProxy);
            output = await youtubedl(cleanUrl, opts);
            if (output && (output.title || output.id)) {
              console.log(`[Analyze] YouTube analysis succeeded via tier [${tier.client || "standard"}]`);
              break;
            }
          } catch (err: any) {
            lastErr = err;
            console.warn(`[Analyze] Tier [${tier.client || "standard"}] failed: ${err.message?.slice(0, 120)}`);
            if (tier.useProxy) rotateProxy();
          }
        }

        if (!output) {
          throw lastErr || new Error("YouTube extraction failed across all tiers");
        }
      } else {
        try {
          output = await youtubedl(cleanUrl, getYtDlpOptions(cleanUrl, { dumpSingleJson: true }));
        } catch (initialErr: any) {
          console.warn("[Analyze] Retrying non-YouTube extraction without cookies...");
          output = await youtubedl(cleanUrl, getYtDlpOptions(cleanUrl, { dumpSingleJson: true }, true));
        }
      }

      const extractor = output.extractor_key || output.extractor || "Web Media";
      const durationSec = output.duration || 0;
      const durationStr = formatDuration(durationSec);

      // Extract available video resolutions
      const videoFormats = [
        { format_id: "1080", ext: "mp4", label: "Full HD 1080p", resolution: "1080p" },
        { format_id: "720", ext: "mp4", label: "HD 720p", resolution: "720p" },
        { format_id: "480", ext: "mp4", label: "Standard 480p", resolution: "480p" },
        { format_id: "360", ext: "mp4", label: "Mobile 360p", resolution: "360p" }
      ];

      const audioFormats = [
        { format_id: "mp3", ext: "mp3", label: "MP3 Audio (High Quality 160kbps)" },
        { format_id: "m4a", ext: "m4a", label: "M4A Audio (Original Stream)" }
      ];

      return res.json({
        success: true,
        title: output.title || "Untitled Media",
        thumbnail: output.thumbnail || "",
        platform: extractor,
        author: output.uploader || output.channel || output.artist || "@creator",
        duration: durationSec,
        duration_string: durationStr,
        has_video: true,
        has_audio: true,
        original_url: cleanUrl,
        video_formats: videoFormats,
        audio_formats: audioFormats
      });

    } catch (error: any) {
      console.error("[Analyze] Universal extraction error:", error);
      const errMsg = error.message || error.toString();
      let userFriendlyMsg = "Failed to analyze media. Verify the URL is public and valid.";
      if (cleanUrl.includes("/stories/") || errMsg.includes("login required")) {
        userFriendlyMsg = "Private stories require logging in and cannot be downloaded without credentials. Please use public video/post links.";
      } else if (errMsg.includes("Sign in to confirm you’re not a bot")) {
        userFriendlyMsg = "The provider temporarily restricted this cloud IP. Please retry in a few seconds or use another link.";
      }
      return res.status(500).json({ error: userFriendlyMsg, details: errMsg });
    }
  });

  // ==========================================================================
  // 4. UNIFIED POST /api/download (Backwards Compatibility)
  // ==========================================================================
  app.post("/api/download", async (req: Request, res: Response) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "URL is required" });

    const cleanUrl = String(url).trim();
    const isTikTok = cleanUrl.includes("tiktok.com") || cleanUrl.includes("douyin.com");

    if (isTikTok) {
      try {
        const scraped = await scrapeTikTokFast(cleanUrl);
        if (scraped) return res.json(scraped);
      } catch (e) {}
    }

    // Forward to universal analyze
    try {
      const output: any = await youtubedl(cleanUrl, getYtDlpOptions(cleanUrl, { dumpSingleJson: true }));
      return res.json({
        title: output.title || "Media",
        author: output.uploader || "creator",
        thumbnail: output.thumbnail || "",
        downloadUrl: `/api/download?url=${encodeURIComponent(cleanUrl)}&format=mp4&quality=1080`,
        duration: output.duration || 0,
        stats: { likes: output.like_count || 0, comments: output.comment_count || 0, shares: 0 }
      });
    } catch (e: any) {
      return res.status(500).json({ error: "Failed to process media. Please check URL." });
    }
  });

  // ==========================================================================
  // 5. STREAMING DOWNLOAD ENDPOINT (GET /api/download)
  // ==========================================================================
  app.get("/api/download", async (req: Request, res: Response) => {
    const mediaUrl = req.query.url as string;
    const format = ((req.query.format as string) || "mp4").toLowerCase();
    const rawTitle = (req.query.title as string) || "TIKHD_Download";
    const cleanTitle = sanitizeFilename(rawTitle);

    if (!mediaUrl) return res.status(400).send("Missing url parameter");

    console.log(`[Download] Requested format: [${format}] for URL: ${mediaUrl}`);

    try {
      // 0. Zero-Egress Direct Media Redirect
      if (audioCatcher.isDirectAudio(mediaUrl)) {
        res.setHeader("Cache-Control", "public, max-age=86400");
        return res.redirect(307, mediaUrl);
      }
      if (format === "mp4" && /^https?:\/\/.*\.(mp4|m4v|mov|webm)(\?.*)?$/i.test(mediaUrl)) {
        res.setHeader("Cache-Control", "public, max-age=86400");
        return res.redirect(307, mediaUrl);
      }

      // 1. Audio Catcher HLS stream assembly
      if (audioCatcher.isHls(mediaUrl)) {
        return await audioCatcher.streamHlsAudio(mediaUrl, res, { filename: cleanTitle });
      }

      // 2. Audiomack stream
      if (audiomack.isAudiomack(mediaUrl)) {
        return await audiomack.streamAudiomack(mediaUrl, res, { format, title: cleanTitle });
      }

      // 3. Audio Download (MP3 or M4A) via yt-dlp
      if (format === "mp3" || format === "audio") {
        const finalAudioFilename = buildMediaFilename(rawTitle, "mp3");
        res.setHeader("Content-Disposition", makeContentDisposition(finalAudioFilename));
        res.setHeader("Content-Type", "audio/mpeg");

        console.log(`[Download] Streaming 160kbps MP3 audio via yt-dlp + FFmpeg...`);
        const primaryOpts = getYtDlpOptions(mediaUrl, { format: "bestaudio/best", output: "-" }, false, "tv_embedded", true);
        const fallbackOpts = getYtDlpOptions(mediaUrl, { format: "bestaudio/best", output: "-" }, true, "ios", true);

        return streamMediaWithFallback(mediaUrl, primaryOpts, fallbackOpts, res, "MP3", {
          transcodeToMp3: true,
          title: cleanTitle
        });
      }

      if (format === "m4a") {
        const finalAudioFilename = buildMediaFilename(rawTitle, "m4a");
        res.setHeader("Content-Disposition", makeContentDisposition(finalAudioFilename));
        res.setHeader("Content-Type", "audio/mp4");

        const primaryOpts = getYtDlpOptions(mediaUrl, { format: "bestaudio[ext=m4a]/bestaudio/best", output: "-" }, false, "tv_embedded", true);
        const fallbackOpts = getYtDlpOptions(mediaUrl, { format: "bestaudio[ext=m4a]/bestaudio/best", output: "-" }, true, "ios", true);

        return streamMediaWithFallback(mediaUrl, primaryOpts, fallbackOpts, res, "M4A");
      }

      // 4. Video Download (MP4 with requested quality)
      const quality = ((req.query.quality as string) || "1080").toLowerCase();
      let videoFormatStr = "bestvideo[height<=1080][vcodec^=avc]+bestaudio[ext=m4a]/bestvideo[height<=1080][vcodec^=avc]+bestaudio/bestvideo[height<=1080]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio/best";
      if (quality === "720") {
        videoFormatStr = "bestvideo[height<=720][vcodec^=avc]+bestaudio[ext=m4a]/bestvideo[height<=720][vcodec^=avc]+bestaudio/bestvideo[height<=720]+bestaudio[ext=m4a]/bestvideo[height<=720]+bestaudio/best";
      } else if (quality === "480") {
        videoFormatStr = "bestvideo[height<=480][vcodec^=avc]+bestaudio[ext=m4a]/bestvideo[height<=480][vcodec^=avc]+bestaudio/bestvideo[height<=480]+bestaudio[ext=m4a]/bestvideo[height<=480]+bestaudio/best";
      } else if (quality === "360") {
        videoFormatStr = "bestvideo[height<=360][vcodec^=avc]+bestaudio[ext=m4a]/bestvideo[height<=360][vcodec^=avc]+bestaudio/bestvideo[height<=360]+bestaudio[ext=m4a]/bestvideo[height<=360]+bestaudio/best";
      }

      const finalVideoFilename = buildMediaFilename(rawTitle, "mp4", quality);
      res.setHeader("Content-Disposition", makeContentDisposition(finalVideoFilename));
      res.setHeader("Content-Type", "video/mp4");

      const isYouTube = mediaUrl.includes("youtube.com") || mediaUrl.includes("youtu.be");
      if (isYouTube) {
        const safeQuality = (quality || "1080").toLowerCase();
        const cacheKey = crypto.createHash("md5").update(`${mediaUrl}_${safeQuality}`).digest("hex");
        const tempFilePath = path.join(os.tmpdir(), `tikhd_yt_${cacheKey}.${format}`);

        if (fs.existsSync(tempFilePath)) {
          try {
            const stat = fs.statSync(tempFilePath);
            if (stat.size > 1000 && (Date.now() - stat.mtimeMs) < 25 * 60 * 1000) {
              res.setHeader("Content-Length", stat.size);
              res.setHeader("Accept-Ranges", "bytes");
              return fs.createReadStream(tempFilePath).pipe(res);
            }
          } catch (e) {}
        }

        // Direct browser visit anti-524 shield
        const acceptsHtml = req.headers.accept && req.headers.accept.includes("text/html");
        if (acceptsHtml) {
          assembleYouTubeVideo(mediaUrl, safeQuality).catch(err => {
            console.warn(`[Direct Download] Background assembly note:`, err.message);
          });

          res.setHeader("Content-Type", "text/html; charset=utf-8");
          return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>TIKHD - Preparing Download</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { background: #08080C; color: #fff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
    .card { background: #111218; border: 1px solid #232636; border-radius: 20px; padding: 36px 28px; max-width: 480px; width: 100%; text-align: center; box-shadow: 0 20px 50px rgba(0,0,0,0.6); }
    .spinner { width: 44px; height: 44px; border: 4px solid #232636; border-top-color: #00F2FE; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 20px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    h1 { font-size: 19px; margin: 0 0 8px; font-weight: 700; color: #fff; }
    p { color: #9ca3af; font-size: 13px; margin: 0 0 22px; line-height: 1.5; word-break: break-word; }
    .bar { width: 100%; height: 6px; background: #232636; border-radius: 99px; overflow: hidden; margin-bottom: 12px; }
    .fill { width: 40%; height: 100%; background: linear-gradient(90deg, #00F2FE, #4FACFE); border-radius: 99px; transition: width 0.3s ease; animation: pulse 1.5s ease-in-out infinite; }
    @keyframes pulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }
    .status { font-size: 12px; color: #00F2FE; font-weight: 600; font-family: monospace; }
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner"></div>
    <h1>Preparing High-Speed Stream</h1>
    <p>${buildMediaFilename(rawTitle, "mp4", safeQuality)}</p>
    <div class="bar"><div class="fill" id="pbar"></div></div>
    <div class="status" id="pstatus">Assembling stream chunks...</div>
  </div>
  <script>
    const key = "${cacheKey}";
    const title = "${encodeURIComponent(cleanTitle)}";
    const format = "${format}";
    const url = "${encodeURIComponent(mediaUrl)}";
    const quality = "${encodeURIComponent(safeQuality)}";
    let count = 0;
    const interval = setInterval(async () => {
      count++;
      try {
        const res = await fetch('/api/status?url=' + url + '&quality=' + quality + '&format=' + format + '&title=' + title);
        const data = await res.json();
        if (data.status === 'ready') {
          clearInterval(interval);
          document.getElementById('pstatus').textContent = 'Download starting now!';
          document.getElementById('pbar').style.width = '100%';
          setTimeout(() => {
            window.location.href = data.downloadUrl || ('/api/file?key=' + key + '&title=' + title + '&format=' + format + '&quality=' + quality);
          }, 400);
        } else {
          if (count > 4) document.getElementById('pstatus').textContent = 'Merging video & audio chunks...';
          if (count > 12) document.getElementById('pstatus').textContent = 'Processing high-definition stream...';
          if (count > 25) document.getElementById('pstatus').textContent = 'Finalizing transfer to browser...';
        }
      } catch(e) {}
    }, 1200);
  </script>
</body>
</html>`);
        }

        try {
          const result = await assembleYouTubeVideo(mediaUrl, safeQuality);
          if (result && fs.existsSync(result.filePath)) {
            res.setHeader("Content-Length", result.size);
            res.setHeader("Accept-Ranges", "bytes");
            return fs.createReadStream(result.filePath).pipe(res);
          }
        } catch (assemblyErr: any) {
          console.warn("[Download] YouTube assembly failed, using direct pipe fallback:", assemblyErr.message);
        }
      }

      console.log(`[Download] Streaming video [quality=${quality}] via yt-dlp pipe...`);
      const primaryOpts = getYtDlpOptions(mediaUrl, { format: videoFormatStr, output: "-" }, false, "tv_embedded", true);
      const fallbackOpts = getYtDlpOptions(mediaUrl, { format: `${videoFormatStr}/bestvideo+bestaudio/best`, output: "-" }, true, "ios", true);

      return streamMediaWithFallback(mediaUrl, primaryOpts, fallbackOpts, res, "Video");

    } catch (err: any) {
      console.error("[Download] Setup error:", err);
      if (!res.headersSent) res.status(500).send("Download processing failed");
    }
  });

  // Background prepare endpoint
  const handlePrepare = async (req: Request, res: Response) => {
    const mediaUrl = (req.body?.url || req.query?.url) as string;
    const quality = ((req.body?.quality || req.query?.quality || "1080") as string).toLowerCase();
    if (!mediaUrl) return res.status(400).json({ error: "Missing url parameter" });

    const isYouTube = mediaUrl.includes("youtube.com") || mediaUrl.includes("youtu.be");
    if (!isYouTube) {
      return res.json({ success: true, message: "Non-YouTube media streams on-the-fly" });
    }

    assembleYouTubeVideo(mediaUrl, quality).catch(err => {
      console.warn(`[Prepare] Background pre-warm note for ${mediaUrl}:`, err.message);
    });

    res.json({ success: true, preparing: true, quality, timestamp: Date.now() });
  };

  app.post("/api/prepare", handlePrepare);
  app.get("/api/prepare", handlePrepare);

  // Status check endpoint
  app.get("/api/status", async (req: Request, res: Response) => {
    const mediaUrl = req.query.url as string;
    const quality = ((req.query.quality as string) || "1080").toLowerCase();
    const format = ((req.query.format as string) || "mp4").toLowerCase();
    const title = (req.query.title as string) || "TIKHD Media";

    if (!mediaUrl) return res.status(400).json({ error: "Missing url parameter" });

    const safeQuality = (quality || "1080").toLowerCase();
    const cacheKey = crypto.createHash("md5").update(`${mediaUrl}_${safeQuality}`).digest("hex");
    const tempFilePath = path.join(os.tmpdir(), `tikhd_yt_${cacheKey}.${format}`);

    if (fs.existsSync(tempFilePath)) {
      try {
        const stat = fs.statSync(tempFilePath);
        const ageMs = Date.now() - stat.mtimeMs;
        if (stat.size > 1000 && ageMs < 25 * 60 * 1000) {
          const finalFilename = buildMediaFilename(title, format, safeQuality);
          return res.json({
            status: "ready",
            key: cacheKey,
            size: stat.size,
            filename: finalFilename,
            downloadUrl: `/api/file?key=${cacheKey}&title=${encodeURIComponent(title)}&format=${format}&quality=${encodeURIComponent(safeQuality)}`
          });
        }
      } catch (e) {}
    }

    const isProcessing = inFlightYtDownloads.has(cacheKey);
    if (!isProcessing) {
      assembleYouTubeVideo(mediaUrl, safeQuality).catch(err => {
        console.warn(`[Status] Auto-assembly note for ${mediaUrl}:`, err.message);
      });
    }

    return res.json({ status: "processing", key: cacheKey, quality: safeQuality });
  });

  // Cached file range delivery endpoint
  app.get("/api/file", (req: Request, res: Response) => {
    const key = req.query.key as string;
    const rawTitle = (req.query.title as string) || "TIKHD Media";
    const format = ((req.query.format as string) || "mp4").toLowerCase();
    const quality = req.query.quality as string;
    const finalFilename = buildMediaFilename(rawTitle, format, quality);

    if (!key || !/^[a-f0-9]{32}$/i.test(key)) {
      return res.status(400).send("Invalid or missing file key");
    }

    const tempFilePath = path.join(os.tmpdir(), `tikhd_yt_${key}.${format}`);
    if (!fs.existsSync(tempFilePath)) {
      return res.status(404).send("File not found or expired. Please re-analyze and download.");
    }

    try {
      const stat = fs.statSync(tempFilePath);
      const fileSize = stat.size;
      const range = req.headers.range;

      res.setHeader("Content-Type", format === "mp4" ? "video/mp4" : "audio/mpeg");
      res.setHeader("Content-Disposition", makeContentDisposition(finalFilename));
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader("Cache-Control", "public, max-age=3600");

      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        const file = fs.createReadStream(tempFilePath, { start, end });
        res.writeHead(206, {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunksize,
          "Content-Type": format === "mp4" ? "video/mp4" : "audio/mpeg",
          "Content-Disposition": makeContentDisposition(finalFilename)
        });
        file.pipe(res);
      } else {
        res.setHeader("Content-Length", fileSize);
        fs.createReadStream(tempFilePath).pipe(res);
      }
    } catch (err) {
      console.error("[File Delivery] Error:", err);
      if (!res.headersSent) res.status(500).send("Error streaming file");
    }
  });

  // Proxy download for direct CDN URLs (TikTok, etc.)
  app.get("/api/download-file", async (req: Request, res: Response) => {
    try {
      const url = req.query.url as string;
      const title = (req.query.title as string) || "tikhd_video";
      if (!url) return res.status(400).send("No URL provided");

      const response = await axios({
        method: "GET",
        url: url,
        responseType: "stream",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Referer": "https://www.tiktok.com/"
        }
      });
      res.setHeader("Content-Disposition", makeContentDisposition(`${sanitizeFilename(title)}.mp4`));
      res.setHeader("Content-Type", "video/mp4");
      response.data.pipe(res);
    } catch (e) {
      console.error("Proxy download error:", e);
      res.status(500).send("Error downloading file");
    }
  });

  // Diagnostic endpoint
  app.get("/api/diag", async (req: Request, res: Response) => {
    const testUrl = (req.query.url as string) || "https://www.youtube.com/watch?v=S1S9gYQv6kA";
    const client = (req.query.client as string) || "android";
    const withCookies = req.query.cookies === "true";

    const opts: Record<string, any> = { dumpSingleJson: true, noWarnings: true };
    if (client !== "default") opts.extractorArgs = `youtube:player_client=${client}`;
    const cookieFile = path.join(__dirname, "cookies.txt");
    if (withCookies && fs.existsSync(cookieFile)) opts.cookies = cookieFile;

    try {
      const result: any = await youtubedl(testUrl, opts);
      res.json({
        success: true,
        client,
        withCookies,
        hasCookieFile: fs.existsSync(cookieFile),
        title: result.title,
        formats: result.formats?.length
      });
    } catch (err: any) {
      res.json({
        success: false,
        client,
        withCookies,
        hasCookieFile: fs.existsSync(cookieFile),
        error: err.message,
        stderr: err.stderr
      });
    }
  });

  // ==========================================================================
  // 6. FRONTEND SERVING (VITE DEV / DIST STATIC SPA)
  // ==========================================================================
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith("/api")) return next();
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`\n======================================================`);
    console.log(`🚀 TIKHD Universal Media Downloader Server Running!`);
    console.log(`👉 Environment Port: ${PORT}`);
    console.log(`👉 Health Check: http://localhost:${PORT}/api/health`);
    console.log(`👉 Engine: yt-dlp + Audio Catcher IDM + Fast TikTok + FFmpeg 160k MP3`);
    console.log(`======================================================\n`);
  });
}

startServer();

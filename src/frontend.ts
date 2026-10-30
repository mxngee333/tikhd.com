import "./index.css";
import "./firebase";
import { blogPosts } from "./blog-data";

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  thumbnail: string;
  date: string;
  readTime: string;
  author: string;
  category: string;
  metaTitle: string;
  metaDescription: string;
}

interface FormatItem {
  format_id: string;
  ext: string;
  label: string;
  resolution?: string;
}

interface MediaAnalysis {
  success: boolean;
  title: string;
  thumbnail: string;
  platform: string;
  author?: string;
  duration: number;
  duration_string: string;
  has_video: boolean;
  has_audio: boolean;
  downloadUrl?: string;
  original_url: string;
  video_formats?: FormatItem[];
  audio_formats?: FormatItem[];
  stats?: {
    likes?: number;
    comments?: number;
    shares?: number;
  };
}

interface RecentDownload {
  id: string;
  title: string;
  thumbnail: string;
  platform: string;
  url: string;
  timestamp: number;
}

// ============================================================================
// i18n Data
// ============================================================================
const translations: Record<string, any> = {
  en: {
    nav_home: "Downloader",
    nav_how: "How to use?",
    hero_title: "TIKHD",
    hero_badge: "Universal Video & Audio Downloader",
    hero_subtitle: "Download high quality videos & audio from TikTok, YouTube, Instagram, Facebook, X, and Audiomack with zero watermarks.",
    input_placeholder: "Paste TikTok, YouTube, Instagram, X, or any video link here...",
    btn_paste: "Paste & Download",
    btn_download: "Download",
    btn_save_no_watermark: "Download HD (No Watermark)",
    loader_text: "Analyzing media stream across edge nodes...",
    error_invalid: "Please enter a valid video or audio URL.",
    error_generic: "An error occurred while analyzing the media. Please check the URL.",
    formats_video: "Video Formats (MP4)",
    formats_audio: "Audio Formats (MP3 / M4A)",
    recent_title: "Recent Extractions",
    download_another: "Download Another Media"
  },
  es: {
    nav_home: "Descargador",
    nav_how: "¿Cómo usar?",
    hero_title: "TIKHD",
    hero_badge: "Descargador Universal de Video y Audio",
    hero_subtitle: "Descarga videos y audios en alta calidad de TikTok, YouTube, Instagram, Facebook, X y Audiomack sin marcas de agua.",
    input_placeholder: "Pega el enlace de TikTok, YouTube, Instagram o video aquí...",
    btn_paste: "Pegar y Descargar",
    btn_download: "Descargar",
    btn_save_no_watermark: "Descargar HD (Sin marca de agua)",
    loader_text: "Analizando flujo de medios en los nodos edge...",
    error_invalid: "Por favor introduce una URL válida de video o audio.",
    error_generic: "Ocurrió un error al procesar el enlace. Verifica la URL.",
    formats_video: "Formatos de Video (MP4)",
    formats_audio: "Formatos de Audio (MP3 / M4A)",
    recent_title: "Descargas Recientes",
    download_another: "Descargar Otro Enlace"
  },
  vi: {
    nav_home: "Trình tải xuống",
    nav_how: "Cách dùng?",
    hero_title: "TIKHD",
    hero_badge: "Trình tải Video & Âm thanh Đa nền tảng",
    hero_subtitle: "Tải video và nhạc chất lượng cao từ TikTok, YouTube, Instagram, Facebook, X và Audiomack không logo.",
    input_placeholder: "Dán link TikTok, YouTube, Instagram, X vào đây...",
    btn_paste: "Dán & Tải xuống",
    btn_download: "Tải xuống",
    btn_save_no_watermark: "Tải HD (Không logo)",
    loader_text: "Đang phân tích luồng phát qua các nút biên...",
    error_invalid: "Vui lòng nhập link video hoặc audio hợp lệ.",
    error_generic: "Đã xảy ra lỗi khi phân tích. Vui lòng kiểm tra lại đường dẫn.",
    formats_video: "Định dạng Video (MP4)",
    formats_audio: "Định dạng Âm thanh (MP3 / M4A)",
    recent_title: "Tải xuống gần đây",
    download_another: "Tải liên kết khác"
  }
};

let currentLang = "en";

function updateI18n() {
  const urlParams = new URLSearchParams(window.location.search);
  const langParam = urlParams.get("lang");
  if (langParam === "es") currentLang = "es";
  else if (langParam === "vi") currentLang = "vi";
  else currentLang = "en";

  const t = translations[currentLang];
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n") as string;
    if (t[key]) el.textContent = t[key];
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    const key = el.getAttribute("data-i18n-placeholder") as string;
    if (t[key]) (el as HTMLInputElement).placeholder = t[key];
  });
  const langLabels: Record<string, string> = { en: "English", es: "Español", vi: "Tiếng Việt" };
  const langEl = document.getElementById("currentLangLabel");
  if (langEl) langEl.textContent = langLabels[currentLang];
}

// Production Backend URL (Hetzner VPS / Coolify Universal Extraction Engine)
const LIVE_BACKEND_URL = "https://api.vidoget.com";

const getApiBase = (): string => {
  if (
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
     window.location.hostname === "127.0.0.1")
  ) {
    return "";
  }
  return LIVE_BACKEND_URL;
};

// ============================================================================
// State & LocalStorage
// ============================================================================
const RECENT_KEY = "tikhd_recent_downloads";
let isAnalyzing = false;
let lastAutoCapturedUrl = "";

function getRecentDownloads(): RecentDownload[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveRecentDownload(item: RecentDownload) {
  try {
    let list = getRecentDownloads().filter(i => i.url !== item.url);
    list.unshift(item);
    if (list.length > 6) list = list.slice(0, 6);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch (e) {}
}

const mainContent = document.getElementById("main-content")!;

function setMetadata(title: string, description: string) {
  document.title = title;
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute("content", description);
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.setAttribute("content", title);
  const ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc) ogDesc.setAttribute("content", description);
}

// ============================================================================
// UI Renderers
// ============================================================================

function renderHome() {
  const t = translations[currentLang];
  setMetadata(
    "TIKHD - Universal Video & Audio Downloader | TikTok, YouTube, Instagram, Audiomack HD",
    "Download videos and audio in Full HD without watermark for free with TIKHD. The fastest universal downloader for TikTok, YouTube, Instagram, Facebook, X, and Audiomack."
  );

  const recentItems = getRecentDownloads();

  mainContent.innerHTML = `
    <section class="hero min-h-[85vh] flex flex-col justify-center pt-28 pb-16">
      <div class="tikhd-container w-full">
        
        <!-- Header Banner / Ad Slot -->
        <div class="max-w-3xl mx-auto mb-10">
          <div class="ad-placeholder h-20">
            <div class="opacity-50 text-[11px] font-bold text-cyan-400">⚡ High-Speed Universal Engine Active</div>
            <div class="opacity-30 text-[9px] mt-1">Multi-Platform Extraction • Zero Watermark • 160kbps MP3 Audio</div>
          </div>
        </div>

        <!-- Hero Header -->
        <div class="text-center mb-10">
          <div class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-bold uppercase tracking-widest mb-6">
            <span class="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
            ${t.hero_badge}
          </div>
          <h1 class="text-4xl md:text-7xl font-extrabold tracking-tight text-white mb-4">
            TIK<span class="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">HD</span> Downloader
          </h1>
          <p class="text-base md:text-xl text-zinc-400 max-w-2xl mx-auto font-medium leading-relaxed">
            ${t.hero_subtitle}
          </p>

          <!-- Supported Platforms Pill Bar -->
          <div class="flex flex-wrap items-center justify-center gap-2.5 mt-6 max-w-xl mx-auto">
            <span class="px-3 py-1 bg-zinc-900/90 border border-zinc-800 rounded-lg text-[11px] font-bold text-zinc-300 flex items-center gap-1.5">
              <span class="text-[#FE2C55]">●</span> TikTok / Douyin
            </span>
            <span class="px-3 py-1 bg-zinc-900/90 border border-zinc-800 rounded-lg text-[11px] font-bold text-zinc-300 flex items-center gap-1.5">
              <span class="text-[#FF0000]">●</span> YouTube (1080p/4K)
            </span>
            <span class="px-3 py-1 bg-zinc-900/90 border border-zinc-800 rounded-lg text-[11px] font-bold text-zinc-300 flex items-center gap-1.5">
              <span class="text-[#E1306C]">●</span> Instagram Reels
            </span>
            <span class="px-3 py-1 bg-zinc-900/90 border border-zinc-800 rounded-lg text-[11px] font-bold text-zinc-300 flex items-center gap-1.5">
              <span class="text-[#1877F2]">●</span> Facebook Video
            </span>
            <span class="px-3 py-1 bg-zinc-900/90 border border-zinc-800 rounded-lg text-[11px] font-bold text-zinc-300 flex items-center gap-1.5">
              <span class="text-[#FFA200]">●</span> Audiomack (160k MP3)
            </span>
            <span class="px-3 py-1 bg-zinc-900/90 border border-zinc-800 rounded-lg text-[11px] font-bold text-zinc-300 flex items-center gap-1.5">
              <span class="text-[#1DA1F2]">●</span> X / Twitter
            </span>
          </div>
        </div>

        <!-- Input Box -->
        <div class="max-w-3xl mx-auto relative z-10">
          <form id="searchForm" class="p-2 bg-gradient-to-r from-cyan-500/20 via-blue-500/10 to-transparent rounded-[32px] border border-cyan-500/20 shadow-2xl shadow-cyan-500/5">
            <div class="tikhd-input-container bg-zinc-950/90 border border-zinc-800/80 rounded-[28px] group transition-all duration-300 focus-within:border-cyan-500/50">
              <div class="flex-1 flex flex-col md:flex-row items-center px-4 md:px-6 py-2 gap-3 min-h-[76px]">
                <div class="w-full flex-1 flex items-center gap-3">
                  <svg class="w-6 h-6 text-zinc-600 group-focus-within:text-cyan-400 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.826a4 4 0 015.656 0l4 4a4 4 0 01-5.656 5.656l-1.102-1.101m0 0l1.102-1.101m-.758-4.826V9m3 3H9"></path></svg>
                  <input id="videoUrl" class="w-full bg-transparent border-none text-white text-base md:text-lg placeholder:text-zinc-600 focus:outline-none focus:ring-0" type="text" placeholder="${t.input_placeholder}" autocomplete="off">
                </div>
                <div class="w-full md:w-auto flex items-center gap-2">
                  <button id="pasteBtn" type="button" class="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-extrabold uppercase tracking-wider rounded-2xl text-xs transition-all active:scale-95 shadow-lg shadow-cyan-500/20 whitespace-nowrap">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
                    ${t.btn_paste}
                  </button>
                </div>
              </div>
            </div>
          </form>

          <!-- Stat Cards -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mt-14">
            <div class="tikhd-stat-card bg-zinc-900/30 border border-zinc-800/60 rounded-2xl p-5">
              <span class="tikhd-stat-label text-cyan-400">Extraction Speed</span>
              <span class="tikhd-stat-value text-3xl font-black text-white">~0.6s</span>
              <span class="tikhd-stat-desc text-zinc-500">Fast Cloud Proxy Relay</span>
            </div>
            <div class="tikhd-stat-card bg-zinc-900/30 border border-zinc-800/60 rounded-2xl p-5">
              <span class="tikhd-stat-label text-cyan-400">Audio Fidelity</span>
              <span class="tikhd-stat-value text-3xl font-black text-white">160k CBR</span>
              <span class="tikhd-stat-desc text-zinc-500">Stereo LAME Transcoding</span>
            </div>
            <div class="tikhd-stat-card bg-zinc-900/30 border border-zinc-800/60 rounded-2xl p-5">
              <span class="tikhd-stat-label text-cyan-400">Platform Reach</span>
              <span class="tikhd-stat-value text-3xl font-black text-white">1,000+</span>
              <span class="tikhd-stat-desc text-zinc-500">Universal Site Extraction</span>
            </div>
          </div>
        </div>

        <!-- Loader -->
        <div id="loader" class="hidden mt-12 text-center">
          <div class="inline-block w-12 h-12 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
          <p class="mt-4 text-cyan-400 font-bold tracking-widest text-xs uppercase" id="loaderText">${t.loader_text}</p>
        </div>

        <!-- Error Container -->
        <div id="errorMsg" class="hidden mt-8 max-w-xl mx-auto bg-red-950/40 border border-red-500/40 text-red-300 p-5 rounded-2xl text-center text-sm font-medium"></div>

        <!-- Asynchronous Progress Container -->
        <div id="progressContainer" class="hidden mt-10 max-w-xl mx-auto bg-zinc-900/90 border border-cyan-500/30 rounded-2xl p-6 text-center shadow-xl">
          <div class="flex items-center justify-between text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">
            <span id="progressTitle">Assembling High-Definition Video</span>
            <span id="progressPercent" class="text-cyan-400">Processing...</span>
          </div>
          <div class="w-full bg-zinc-800 rounded-full h-3 overflow-hidden mb-3">
            <div id="progressBar" class="bg-gradient-to-r from-cyan-400 to-blue-500 h-full rounded-full transition-all duration-300 w-1/3 animate-pulse"></div>
          </div>
          <p id="progressStatus" class="text-xs text-zinc-400">Merging video & audio streams with native codecs...</p>
        </div>

        <!-- Result Section -->
        <div id="result" class="hidden mt-12 max-w-4xl mx-auto">
          <!-- Dynamic Result Card will be populated by attachHomeListeners() -->
        </div>

        <!-- Recent Downloads Section -->
        ${recentItems.length > 0 ? `
          <div class="mt-20 max-w-4xl mx-auto">
            <h3 class="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-6 flex items-center gap-2">
              <svg class="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              ${t.recent_title}
            </h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              ${recentItems.map(item => `
                <div class="recent-card bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4 flex items-center gap-4 hover:border-cyan-500/40 transition-all cursor-pointer" data-recent-url="${item.url}">
                  <img src="${item.thumbnail || '/favicon-96x96.png'}" alt="${item.title}" class="w-16 h-16 rounded-xl object-cover bg-zinc-800 flex-shrink-0" referrerpolicy="no-referrer">
                  <div class="flex-1 min-w-0">
                    <span class="text-[9px] font-bold uppercase tracking-wider text-cyan-400 block">${item.platform || 'Media'}</span>
                    <h4 class="text-xs font-semibold text-white truncate">${item.title}</h4>
                    <span class="text-[10px] text-zinc-500 mt-1 block">Click to reload</span>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

      </div>
    </section>
  ` + renderFooter();

  attachHomeListeners();
}

function renderBlogIndex() {
  setMetadata(
    "Blog - TIKHD | Universal Video Downloader & Creator Guides",
    "Explore our guides for downloading TikTok, YouTube, Instagram, and Audiomack media in high quality without watermark."
  );
  mainContent.innerHTML = `
    <section class="pt-32 pb-20 min-h-screen">
      <div class="tikhd-container">
        <div class="mb-12 text-center">
          <div class="inline-flex items-center gap-2 px-3 py-1 bg-cyan-500/10 border border-cyan-500/30 rounded-full text-cyan-400 text-xs font-bold uppercase tracking-widest mb-4">Authority & Tutorials</div>
          <h1 class="text-4xl md:text-6xl font-black text-white mb-4">The TIKHD <span class="text-cyan-400">Library</span></h1>
          <p class="text-zinc-400 max-w-xl mx-auto">The definitive source on media downloading, high-resolution audio extraction, and video optimization.</p>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
          ${(blogPosts as any as BlogPost[]).map(post => `
            <a href="/blog/${post.slug}/" class="bg-zinc-900/40 border border-zinc-800 rounded-3xl overflow-hidden hover:border-cyan-500/40 transition-all group flex flex-col">
              <div class="h-48 overflow-hidden relative">
                 <img src="${post.thumbnail}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="${post.title}">
                 <div class="absolute top-4 left-4 bg-cyan-500 text-black text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-widest">${post.category}</div>
              </div>
              <div class="p-6 flex-1 flex flex-col justify-between">
                <div>
                  <div class="flex items-center text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 gap-3">
                    <span>${post.date}</span>
                    <span class="w-1 h-1 bg-zinc-700 rounded-full"></span>
                    <span>${post.readTime}</span>
                  </div>
                  <h2 class="text-lg font-bold text-white mb-3 leading-snug group-hover:text-cyan-400 transition-colors line-clamp-2">${post.title}</h2>
                  <p class="text-zinc-500 text-xs mb-6 line-clamp-3 leading-relaxed">${post.excerpt}</p>
                </div>
                <div class="text-[11px] font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-2">
                   Read Guide 
                   <svg class="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 7l5 5m0 0l-5 5m5-5H6"></path></svg>
                </div>
              </div>
            </a>
          `).join('')}
        </div>
      </div>
    </section>
  ` + renderFooter();
  attachNavListeners();
}

function renderBlogPost(slug: string) {
  const post = blogPosts.find(p => p.slug === slug);
  if (!post) return (window.location.href = "/blog/");

  if (!post.content) {
    window.location.href = `/blog/${slug}/`;
    return;
  }

  setMetadata(post.metaTitle, post.metaDescription);
  mainContent.innerHTML = `
    <article class="pt-32 pb-20 min-h-screen">
      <div class="tikhd-container max-w-3xl">
        <div class="mb-10">
          <a href="/blog" class="text-xs font-bold text-cyan-400 hover:text-white uppercase tracking-widest mb-6 inline-flex items-center gap-2 transition-colors">
            ← Back to All Guides
          </a>
          <h1 class="text-3xl md:text-5xl font-black text-white mb-6 leading-tight">${post.title}</h1>
          <div class="flex items-center gap-4 text-xs font-bold text-zinc-500 uppercase tracking-widest">
            <span>By ${post.author}</span>
            <span class="w-1 h-1 bg-zinc-700 rounded-full"></span>
            <span>${post.date}</span>
            <span class="w-1 h-1 bg-zinc-700 rounded-full"></span>
            <span class="text-cyan-400">${post.readTime}</span>
          </div>
        </div>
        <div class="rounded-3xl overflow-hidden mb-12 shadow-2xl border border-zinc-800">
          <img src="${post.thumbnail}" class="w-full h-auto" alt="${post.title}">
        </div>
        <div class="prose prose-invert max-w-none text-zinc-300 text-base md:text-lg leading-relaxed space-y-8">
          ${post.content}
        </div>
        <div class="pt-16 border-t border-zinc-900 mt-16">
           <a href="/" class="inline-flex items-center gap-3 px-8 py-4 bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold uppercase tracking-wider rounded-2xl text-xs transition-all shadow-lg shadow-cyan-500/20" data-nav-link>
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>
              Return to Universal Downloader
           </a>
        </div>
      </div>
    </article>
  ` + renderFooter();
  attachNavListeners();
}

function renderHowTo() {
  setMetadata("How to Use - TIKHD Universal Media Downloader", "Step-by-step instructions for downloading video and audio in HD from TikTok, YouTube, Instagram, Audiomack, and more.");
  mainContent.innerHTML = `
    <section class="pt-32 pb-20 min-h-screen">
      <div class="tikhd-container max-w-3xl">
        <h1 class="text-4xl md:text-6xl font-black text-white mb-10">How to <span class="text-cyan-400">Download</span></h1>
        <div class="space-y-10">
          <div class="flex gap-6 items-start bg-zinc-900/40 border border-zinc-800/80 p-6 rounded-3xl">
             <div class="w-12 h-12 bg-cyan-500 text-black font-black flex items-center justify-center rounded-2xl flex-shrink-0 text-lg shadow-lg shadow-cyan-500/20">1</div>
             <div>
               <h3 class="text-lg font-bold text-white mb-2">Copy Media Link</h3>
               <p class="text-zinc-400 text-sm leading-relaxed">Open TikTok, YouTube, Instagram, Facebook, X, or Audiomack. Click "Share" and copy the link to your clipboard.</p>
             </div>
          </div>
          <div class="flex gap-6 items-start bg-zinc-900/40 border border-zinc-800/80 p-6 rounded-3xl">
             <div class="w-12 h-12 bg-cyan-500 text-black font-black flex items-center justify-center rounded-2xl flex-shrink-0 text-lg shadow-lg shadow-cyan-500/20">2</div>
             <div>
               <h3 class="text-lg font-bold text-white mb-2">Paste or Auto-Capture at TIKHD</h3>
               <p class="text-zinc-400 text-sm leading-relaxed">Return to TIKHD. Click "Paste & Download" or allow the Smart Clipboard to auto-detect your link instantly.</p>
             </div>
          </div>
          <div class="flex gap-6 items-start bg-zinc-900/40 border border-zinc-800/80 p-6 rounded-3xl">
             <div class="w-12 h-12 bg-cyan-500 text-black font-black flex items-center justify-center rounded-2xl flex-shrink-0 text-lg shadow-lg shadow-cyan-500/20">3</div>
             <div>
               <h3 class="text-lg font-bold text-white mb-2">Choose Quality & Download</h3>
               <p class="text-zinc-400 text-sm leading-relaxed">Select 1080p Full HD, 720p HD, TikTok No Watermark, or 160kbps MP3 Audio to save the file straight to your device.</p>
             </div>
          </div>
        </div>
        <div class="pt-16 border-t border-zinc-900 mt-16">
           <a href="/" class="inline-flex items-center gap-2 text-cyan-400 font-bold uppercase tracking-widest text-xs hover:text-white transition-colors" data-nav-link>
              ← Back to Universal Downloader
           </a>
        </div>
      </div>
    </section>
  ` + renderFooter();
  attachNavListeners();
}

function renderAbout() {
  setMetadata("About Us - TIKHD Universal Media Downloader", "Learn about the mission behind the world's most versatile video and audio downloader.");
  mainContent.innerHTML = `
    <section class="pt-32 pb-20 min-h-screen">
      <div class="tikhd-container max-w-3xl">
        <h1 class="text-4xl md:text-6xl font-black text-white mb-10">About <span class="text-cyan-400">TIKHD</span></h1>
        <div class="text-zinc-400 text-base leading-relaxed space-y-6">
          <p>TIKHD was engineered with one sovereign mandate: to give creators, researchers, and everyday internet users a fast, clean, and reliable tool to save high-definition media for offline use.</p>
          <p>By compounding the multi-tier extraction power of <strong class="text-white">yt-dlp</strong>, <strong class="text-white">Audio Catcher IDM</strong>, and <strong class="text-white">Fast TikTok direct scrapers</strong>, TIKHD bridges over 1,000 video and audio streaming services into a single unified interface with zero invasive ads.</p>
        </div>
        <div class="pt-16 border-t border-zinc-900 mt-16">
           <a href="/" class="inline-flex items-center gap-2 text-cyan-400 font-bold uppercase tracking-widest text-xs hover:text-white transition-colors" data-nav-link>
              ← Back to Universal Downloader
           </a>
        </div>
      </div>
    </section>
  ` + renderFooter();
  attachNavListeners();
}

function renderPrivacy() {
  setMetadata("Privacy Policy - TIKHD", "Privacy Policy and data security standards for TIKHD.");
  mainContent.innerHTML = `
    <section class="pt-32 pb-20 min-h-screen">
      <div class="tikhd-container max-w-3xl">
        <h1 class="text-4xl font-black text-white mb-10">Privacy Policy</h1>
        <div class="text-zinc-400 text-sm leading-relaxed space-y-6">
          <p>TIKHD respects your digital privacy. We do not store or catalog the media you download. Video and audio files are fetched in real-time or cached transiently in volatile system memory for streaming delivery, and are permanently pruned via automated sweeper routines.</p>
          <p>Standard web telemetry is utilized solely to monitor global edge performance, maintain server uptime, and optimize proxy routes.</p>
        </div>
        <div class="pt-16 border-t border-zinc-900 mt-16">
           <a href="/" class="inline-flex items-center gap-2 text-cyan-400 font-bold uppercase tracking-widest text-xs hover:text-white transition-colors" data-nav-link>
              ← Back to Universal Downloader
           </a>
        </div>
      </div>
    </section>
  ` + renderFooter();
  attachNavListeners();
}

function renderTerms() {
  setMetadata("Terms of Service - TIKHD", "Terms of Service and acceptable use policy for TIKHD.");
  mainContent.innerHTML = `
    <section class="pt-32 pb-20 min-h-screen">
      <div class="tikhd-container max-w-3xl">
        <h1 class="text-4xl font-black text-white mb-10">Terms of Service</h1>
        <div class="text-zinc-400 text-sm leading-relaxed space-y-6">
          <p>TIKHD is an automated media utility provided for personal, archival, educational, and content creation review purposes. Users are solely responsible for ensuring that their downloading activities adhere to the relevant copyright laws of their jurisdiction.</p>
        </div>
        <div class="pt-16 border-t border-zinc-900 mt-16">
           <a href="/" class="inline-flex items-center gap-2 text-cyan-400 font-bold uppercase tracking-widest text-xs hover:text-white transition-colors" data-nav-link>
              ← Back to Universal Downloader
           </a>
        </div>
      </div>
    </section>
  ` + renderFooter();
  attachNavListeners();
}

function renderCookies() {
  setMetadata("Cookie Policy - TIKHD", "Cookie policy and consent settings for TIKHD.");
  mainContent.innerHTML = `
    <section class="pt-32 pb-20 min-h-screen">
      <div class="tikhd-container max-w-3xl">
        <h1 class="text-4xl font-black text-white mb-10">Cookie Policy</h1>
        <div class="text-zinc-400 text-sm leading-relaxed space-y-6">
          <p>We use essential cookies to maintain user preference states (such as ambient audio preferences and language selection) and privacy-respecting advertising cookies to keep our universal downloader 100% free.</p>
        </div>
        <div class="pt-16 border-t border-zinc-900 mt-16">
           <a href="/" class="inline-flex items-center gap-2 text-cyan-400 font-bold uppercase tracking-widest text-xs hover:text-white transition-colors" data-nav-link>
              ← Back to Universal Downloader
           </a>
        </div>
      </div>
    </section>
  ` + renderFooter();
  attachNavListeners();
}

function renderFooter() {
  const currentYear = new Date().getFullYear();
  return `
    <footer class="bg-[#050508] border-t border-zinc-900 pt-16 pb-10 mt-20">
      <div class="tikhd-container">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          <div class="col-span-1 md:col-span-2">
            <a href="/" class="text-2xl font-black text-white mb-4 block" data-nav-link>TIK<span class="text-cyan-400">HD</span></a>
            <p class="text-zinc-500 text-sm max-w-sm leading-relaxed">The high-performance universal media downloader. Save HD videos & 160kbps MP3 audio from TikTok, YouTube, Instagram, Audiomack, and 1,000+ platforms in seconds.</p>
          </div>
          <div>
            <h4 class="text-white font-bold mb-4 uppercase tracking-widest text-xs">Resources</h4>
            <ul class="space-y-3 text-zinc-500 text-sm">
              <li><a href="/" class="hover:text-cyan-400 transition-colors" data-nav-link>Downloader</a></li>
              <li><a href="/blog" class="hover:text-cyan-400 transition-colors" data-nav-link>Blog & Guides</a></li>
              <li><a href="/how-to-use" class="hover:text-cyan-400 transition-colors" data-nav-link>How To Use</a></li>
              <li><a href="/about" class="hover:text-cyan-400 transition-colors" data-nav-link>About Us</a></li>
            </ul>
          </div>
          <div>
            <h4 class="text-white font-bold mb-4 uppercase tracking-widest text-xs">Legal</h4>
            <ul class="space-y-3 text-zinc-500 text-sm">
              <li><a href="/privacy" class="hover:text-cyan-400 transition-colors" data-nav-link>Privacy Policy</a></li>
              <li><a href="/terms" class="hover:text-cyan-400 transition-colors" data-nav-link>Terms of Service</a></li>
              <li><a href="/cookies" class="hover:text-cyan-400 transition-colors" data-nav-link>Cookie Policy</a></li>
            </ul>
          </div>
        </div>
        
        <div class="pt-8 border-t border-zinc-900/80 flex flex-col md:flex-row justify-between items-center gap-4 text-zinc-500 text-xs">
          <p>© ${currentYear} <a href="https://tikhd.app/" class="hover:text-cyan-400 transition-colors">tikhd.app</a> · Universal Video & Audio Downloader · All rights reserved.</p>
          <div class="flex items-center gap-6">
            <span class="text-cyan-400/70 font-mono text-[11px]">Engine v2.0.0 Pro-Universal</span>
          </div>
        </div>
      </div>
    </footer>

    <!-- Cookie Consent Banner -->
    <div id="cookieBanner" class="fixed bottom-0 left-0 right-0 bg-zinc-950/95 border-t border-zinc-800 p-6 z-[100] transform translate-y-full transition-transform duration-500 backdrop-blur-xl">
       <div class="tikhd-container flex flex-col md:flex-row items-center justify-between gap-4">
          <div class="flex-1">
             <h5 class="text-white font-bold text-base mb-1">Privacy & Cookie Preferences</h5>
             <p class="text-zinc-400 text-xs leading-relaxed">TIKHD uses cookies to deliver fast edge media extraction and compliant advertising. By clicking "Accept", you agree to our usage policies.</p>
          </div>
          <div class="flex items-center gap-3 w-full md:w-auto">
             <button id="acceptCookies" class="px-6 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all">Accept All</button>
             <a href="/cookies" class="px-6 py-2.5 border border-zinc-700 hover:border-zinc-500 text-zinc-300 font-bold text-xs uppercase tracking-wider rounded-xl transition-all text-center" data-nav-link>Learn More</a>
          </div>
       </div>
    </div>
  `;
}

// ============================================================================
// Event Listeners & Interaction Engine
// ============================================================================

function attachHomeListeners() {
  const input = document.getElementById("videoUrl") as HTMLInputElement;
  const pasteBtn = document.getElementById("pasteBtn") as HTMLButtonElement;
  const searchForm = document.getElementById("searchForm") as HTMLFormElement;
  const resultSection = document.getElementById("result");
  const loader = document.getElementById("loader");
  const loaderText = document.getElementById("loaderText");
  const errorMsg = document.getElementById("errorMsg");
  const progressContainer = document.getElementById("progressContainer");

  // Perform Analysis
  const performAnalysis = async (targetUrl?: string) => {
    const rawUrl = (targetUrl || input.value || "").trim();
    if (!rawUrl) {
      alert(translations[currentLang].error_invalid);
      return;
    }

    if (isAnalyzing) return;
    isAnalyzing = true;

    resultSection?.classList.add("hidden");
    errorMsg?.classList.add("hidden");
    progressContainer?.classList.add("hidden");
    loader?.classList.remove("hidden");
    if (pasteBtn) pasteBtn.disabled = true;

    try {
      const response = await fetch(`${getApiBase()}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: rawUrl })
      });

      const contentType = response.headers.get("content-type") || "";
      let data: MediaAnalysis;

      if (contentType.includes("application/json")) {
        data = await response.json();
      } else {
        const text = await response.text();
        console.warn("[TIKHD] Non-JSON API response:", text.slice(0, 200));
        throw new Error("Temporary stream extraction delay from server. Please retry in a few moments.");
      }

      if (!response.ok || (data as any).error) {
        throw new Error((data as any).error || translations[currentLang].error_generic);
      }

      // Save to recent downloads
      saveRecentDownload({
        id: crypto.randomUUID?.() || Date.now().toString(),
        title: data.title || "Media",
        thumbnail: data.thumbnail || "",
        platform: data.platform || "Universal",
        url: rawUrl,
        timestamp: Date.now()
      });

      renderResultCard(data, rawUrl);

    } catch (err: any) {
      if (errorMsg) {
        errorMsg.textContent = err.message || translations[currentLang].error_generic;
        errorMsg.classList.remove("hidden");
      }
    } finally {
      loader?.classList.add("hidden");
      if (pasteBtn) pasteBtn.disabled = false;
      isAnalyzing = false;
    }
  };

  // Render Result Card
  function renderResultCard(data: MediaAnalysis, rawUrl: string) {
    if (!resultSection) return;

    const isTikTok = data.platform?.toLowerCase().includes("tiktok") || rawUrl.includes("tiktok.com");
    const videoFormats = data.video_formats || [
      { format_id: "1080", ext: "mp4", label: "Full HD 1080p", resolution: "1080p" },
      { format_id: "720", ext: "mp4", label: "HD 720p", resolution: "720p" }
    ];
    const audioFormats = data.audio_formats || [
      { format_id: "mp3", ext: "mp3", label: "MP3 Audio (160kbps)" },
      { format_id: "m4a", ext: "m4a", label: "Master Audio (M4A)" }
    ];

    resultSection.innerHTML = `
      <div class="result-card bg-zinc-900/80 border border-zinc-800 rounded-[32px] p-6 md:p-8 shadow-2xl backdrop-blur-xl">
        <div class="flex flex-col md:flex-row gap-6 md:gap-8 items-start">
          
          <!-- Thumbnail & Preview -->
          <div class="w-full md:w-72 rounded-2xl overflow-hidden bg-zinc-950 flex-shrink-0 relative group shadow-lg border border-zinc-800">
            <img src="${data.thumbnail || '/favicon-96x96.png'}" alt="${data.title}" class="w-full h-56 md:h-72 object-cover" referrerpolicy="no-referrer">
            <div class="absolute top-3 left-3 px-3 py-1 bg-black/80 backdrop-blur-md rounded-lg text-[10px] font-extrabold uppercase tracking-widest text-cyan-400 border border-cyan-500/30">
              ${data.platform || 'Media'}
            </div>
            ${data.duration_string ? `
              <div class="absolute bottom-3 right-3 px-2.5 py-1 bg-black/80 backdrop-blur-md rounded-md text-[10px] font-mono text-white border border-zinc-700">
                ${data.duration_string}
              </div>
            ` : ''}
          </div>

          <!-- Media Information & Download Matrix -->
          <div class="flex-1 w-full space-y-6">
            <div>
              <div class="flex items-center gap-3 mb-2 flex-wrap">
                <span class="text-sm font-bold text-cyan-400">${data.author || '@creator'}</span>
                <span class="px-2 py-0.5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-[10px] font-bold tracking-widest uppercase rounded flex items-center gap-1.5">
                  <span class="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-ping"></span>
                  Verified High-Speed Stream
                </span>
              </div>
              <h2 class="text-lg md:text-xl font-bold text-white leading-snug">${data.title}</h2>
            </div>

            <!-- TikTok Featured HD Button if applicable -->
            ${isTikTok && data.downloadUrl ? `
              <div class="p-4 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-transparent border border-cyan-500/30 rounded-2xl">
                <button id="tiktokDirectBtn" class="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-extrabold rounded-xl flex items-center justify-center gap-3 shadow-lg shadow-cyan-500/20 transition-all active:scale-95 text-sm uppercase tracking-wider">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                  <span>✨ Download HD Video (No Watermark)</span>
                </button>
              </div>
            ` : ''}

            <!-- Video Formats Grid -->
            <div>
              <h4 class="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <svg class="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                ${translations[currentLang].formats_video}
              </h4>
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                ${videoFormats.map(f => `
                  <button class="download-format-btn px-4 py-3 bg-zinc-800/80 hover:bg-zinc-700/90 border border-zinc-700 hover:border-cyan-500/50 rounded-xl text-left transition-all active:scale-95" data-format="mp4" data-quality="${f.format_id}" data-url="${rawUrl}" data-title="${encodeURIComponent(data.title)}">
                    <span class="block text-xs font-black text-white">${f.label}</span>
                    <span class="block text-[10px] text-zinc-400 font-mono mt-0.5">MP4 • Fast Stream</span>
                  </button>
                `).join('')}
              </div>
            </div>

            <!-- Audio Formats Grid -->
            <div>
              <h4 class="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <svg class="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"></path></svg>
                ${translations[currentLang].formats_audio}
              </h4>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                ${audioFormats.map(a => `
                  <button class="download-format-btn px-4 py-3 bg-zinc-800/80 hover:bg-zinc-700/90 border border-zinc-700 hover:border-cyan-500/50 rounded-xl text-left transition-all active:scale-95 flex items-center justify-between" data-format="${a.format_id}" data-quality="audio" data-url="${rawUrl}" data-title="${encodeURIComponent(data.title)}">
                    <div>
                      <span class="block text-xs font-black text-white">${a.label}</span>
                      <span class="block text-[10px] text-zinc-400 font-mono mt-0.5">${a.format_id === 'mp3' ? '160kbps CBR Stereo' : 'Original Master'}</span>
                    </div>
                    <svg class="w-4 h-4 text-cyan-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                  </button>
                `).join('')}
              </div>
            </div>

            <!-- Reset Button -->
            <button id="resetBtn" class="w-full py-3.5 bg-zinc-950 hover:bg-zinc-800 text-zinc-400 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 border border-zinc-800 transition-colors">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
              <span>${translations[currentLang].download_another}</span>
            </button>
          </div>
        </div>
      </div>
    `;

    resultSection.classList.remove("hidden");
    resultSection.scrollIntoView({ behavior: "smooth", block: "start" });

    // TikTok Direct Download Button Listener
    const tiktokDirectBtn = document.getElementById("tiktokDirectBtn");
    tiktokDirectBtn?.addEventListener("click", () => {
      const downloadEndpoint = data.downloadUrl?.startsWith("http")
        ? data.downloadUrl
        : `${getApiBase()}/api/download-file?url=${encodeURIComponent(data.downloadUrl!)}&title=${encodeURIComponent(data.title)}`;
      triggerBrowserDownload(downloadEndpoint, `tikhd_${Date.now()}.mp4`);
    });

    // Format Buttons Listeners
    document.querySelectorAll(".download-format-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const fmt = btn.getAttribute("data-format") || "mp4";
        const quality = btn.getAttribute("data-quality") || "1080";
        const url = btn.getAttribute("data-url") || rawUrl;
        const title = btn.getAttribute("data-title") || encodeURIComponent(data.title);

        handleFormatDownload(url, fmt, quality, title);
      });
    });

    // Reset Listener
    document.getElementById("resetBtn")?.addEventListener("click", () => {
      resultSection.classList.add("hidden");
      input.value = "";
      input.focus();
      input.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  // Handle format download with YouTube async assembly support
  function handleFormatDownload(url: string, format: string, quality: string, encodedTitle: string) {
    const isYouTube = url.includes("youtube.com") || url.includes("youtu.be");

    if (isYouTube && format === "mp4") {
      // YouTube video requires DASH assembly in background
      progressContainer?.classList.remove("hidden");
      progressContainer?.scrollIntoView({ behavior: "smooth", block: "center" });

      fetch(`${getApiBase()}/api/prepare?url=${encodeURIComponent(url)}&quality=${encodeURIComponent(quality)}`).catch(() => {});

      let pollCount = 0;
      const interval = setInterval(async () => {
        pollCount++;
        try {
          const res = await fetch(`${getApiBase()}/api/status?url=${encodeURIComponent(url)}&quality=${encodeURIComponent(quality)}&format=${format}&title=${encodedTitle}`);
          const cType = res.headers.get("content-type") || "";
          if (!cType.includes("application/json")) return;
          const statusData = await res.json();

          if (statusData.status === "ready") {
            clearInterval(interval);
            const statusText = document.getElementById("progressStatus");
            const bar = document.getElementById("progressBar");
            const percent = document.getElementById("progressPercent");

            if (statusText) statusText.textContent = "Stream ready! Download starting...";
            if (bar) (bar as HTMLElement).style.width = "100%";
            if (percent) percent.textContent = "100%";

            setTimeout(() => {
              const finalDownloadUrl = statusData.downloadUrl?.startsWith("http")
                ? statusData.downloadUrl
                : `${getApiBase()}${statusData.downloadUrl}`;
              triggerBrowserDownload(finalDownloadUrl, statusData.filename || `tikhd_${Date.now()}.${format}`);
              setTimeout(() => progressContainer?.classList.add("hidden"), 3000);
            }, 600);
          } else {
            const statusText = document.getElementById("progressStatus");
            const percent = document.getElementById("progressPercent");
            const bar = document.getElementById("progressBar");

            if (pollCount > 3 && statusText) statusText.textContent = "Merging video and audio chunks with native H.264 & AAC...";
            if (pollCount > 8 && statusText) statusText.textContent = "Processing high-definition 1080p stream...";
            if (pollCount > 15 && statusText) statusText.textContent = "Finalizing packet transfer...";
            
            const simulatedWidth = Math.min(25 + pollCount * 6, 92);
            if (bar) (bar as HTMLElement).style.width = `${simulatedWidth}%`;
            if (percent) percent.textContent = `${Math.round(simulatedWidth)}%`;
          }
        } catch (e) {}
      }, 1200);

    } else {
      // Direct stream download for Audio (MP3/M4A), TikTok, Facebook, IG, Audiomack
      const streamUrl = `${getApiBase()}/api/download?url=${encodeURIComponent(url)}&format=${format}&quality=${quality}&title=${encodedTitle}`;
      triggerBrowserDownload(streamUrl, `${decodeURIComponent(encodedTitle)}.${format}`);
    }
  }

  function triggerBrowserDownload(downloadUrl: string, filename: string) {
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Smart Clipboard Paste & Capture
  const handlePasteCapture = async (triggerDownload = true) => {
    try {
      const text = await navigator.clipboard.readText();
      const clean = (text || "").trim();
      if (clean && clean !== lastAutoCapturedUrl && /^https?:\/\//i.test(clean)) {
        input.value = clean;
        lastAutoCapturedUrl = clean;
        if (triggerDownload) {
          performAnalysis(clean);
        }
      } else if (clean && !clean.startsWith("http")) {
        alert("Clipboard content does not appear to be a URL.");
      }
    } catch (err) {
      if (triggerDownload) {
        // Fallback: if clipboard read permission is blocked, focus input
        input.focus();
      }
    }
  };

  pasteBtn?.addEventListener("click", () => handlePasteCapture(true));

  searchForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    performAnalysis();
  });

  // Recent card clicks
  document.querySelectorAll("[data-recent-url]").forEach(card => {
    card.addEventListener("click", () => {
      const u = card.getAttribute("data-recent-url");
      if (u) {
        input.value = u;
        performAnalysis(u);
      }
    });
  });

  attachNavListeners();

  // Cookie banner acceptance
  const cookieBanner = document.getElementById("cookieBanner");
  const acceptBtn = document.getElementById("acceptCookies");
  if (!localStorage.getItem("tikhd_consent")) {
    setTimeout(() => cookieBanner?.classList.remove("translate-y-full"), 1500);
  }
  acceptBtn?.addEventListener("click", () => {
    localStorage.setItem("tikhd_consent", "true");
    cookieBanner?.classList.add("translate-y-full");
  });

  // Ambient Audio Toggle
  const audio = document.getElementById("ambientAudio") as HTMLAudioElement;
  const audioToggle = document.getElementById("audioToggle");
  const audioIcon = document.getElementById("audioIcon");

  const updateIcon = (playing: boolean) => {
    if (audioIcon) {
      audioIcon.innerHTML = playing
        ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>'
        : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>';
    }
  };

  if (localStorage.getItem("tikhd_audio") === "true") {
    audio.play().then(() => updateIcon(true)).catch(() => {});
  } else {
    updateIcon(false);
  }

  audioToggle?.addEventListener("click", () => {
    if (audio.paused) {
      audio.play().then(() => {
        localStorage.setItem("tikhd_audio", "true");
        updateIcon(true);
      }).catch(() => {});
    } else {
      audio.pause();
      localStorage.setItem("tikhd_audio", "false");
      updateIcon(false);
    }
  });
}

function attachNavListeners() {
  document.querySelectorAll('a[href^="/"]').forEach(anchor => {
    anchor.addEventListener("click", (e) => {
      const target = anchor.getAttribute("href")!;
      if (target.startsWith("http")) return;
      e.preventDefault();
      window.history.pushState({}, "", target);
      router();
    });
  });
}

// Router
function router() {
  window.scrollTo(0, 0);
  const path = window.location.pathname;
  if (path === "/" || path === "") {
    renderHome();
  } else if (path === "/blog" || path === "/blog/") {
    renderBlogIndex();
  } else if (path.startsWith("/blog/")) {
    const slug = path.split("/")[2];
    renderBlogPost(slug);
  } else if (path === "/about" || path === "/about/") {
    renderAbout();
  } else if (path === "/how-to-use" || path === "/how-to-use/") {
    renderHowTo();
  } else if (path === "/privacy" || path === "/privacy/") {
    renderPrivacy();
  } else if (path === "/terms" || path === "/terms/") {
    renderTerms();
  } else if (path === "/cookies" || path === "/cookies/") {
    renderCookies();
  } else {
    renderHome();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  updateI18n();
  router();
});

window.addEventListener("popstate", router);

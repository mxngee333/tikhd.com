import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'https://tikhd.app';
const OUT_DIR = path.resolve(__dirname, 'dist');
const SRC_INDEX = path.resolve(OUT_DIR, 'index.html');
const CURRENT_YEAR = new Date().getFullYear();

const CANONICAL_ROUTES = [
  {
    path: '/',
    priority: '1.0',
    changefreq: 'weekly',
    title: 'TIKHD - Universal Video & Audio Downloader | TikTok, YouTube, Instagram, Audiomack HD',
    desc: 'Download videos and audio in Full HD without watermark for free with TIKHD. The fastest universal downloader for TikTok, YouTube, Instagram, Facebook, X, and Audiomack.'
  },
  {
    path: '/blog/',
    priority: '0.9',
    changefreq: 'daily',
    title: 'Blog & Guides - TIKHD Universal Video & Audio Downloader',
    desc: 'Explore the definitive guides on downloading video and audio in high quality without watermark across all platforms.'
  },
  {
    path: '/how-to-use/',
    priority: '0.8',
    changefreq: 'monthly',
    title: 'How to Use TIKHD - Universal Video & Audio Downloader Guide',
    desc: 'Step-by-step instructions for downloading video and audio in HD from TikTok, YouTube, Instagram, Audiomack, and more.'
  },
  {
    path: '/about/',
    priority: '0.7',
    changefreq: 'monthly',
    title: 'About Us - TIKHD Universal Media Downloader',
    desc: 'Learn about the mission behind the world\'s most versatile video and audio downloader.'
  },
  {
    path: '/privacy/',
    priority: '0.6',
    changefreq: 'monthly',
    title: 'Privacy Policy - TIKHD Universal Media Downloader',
    desc: 'Privacy Policy and data security standards for TIKHD.'
  },
  {
    path: '/terms/',
    priority: '0.6',
    changefreq: 'monthly',
    title: 'Terms of Service - TIKHD Universal Media Downloader',
    desc: 'Terms of Service and acceptable use policy for TIKHD.'
  },
  {
    path: '/cookies/',
    priority: '0.6',
    changefreq: 'monthly',
    title: 'Cookie Policy - TIKHD Universal Media Downloader',
    desc: 'Cookie policy and consent settings for TIKHD.'
  }
];

try {
  const blogs = JSON.parse(fs.readFileSync(path.join(__dirname, 'src/blog-data.json'), 'utf-8'));
  
  // Assign rich HTML index to /blog/
  const blogRoute = CANONICAL_ROUTES.find(r => r.path === '/blog/');
  if (blogRoute) {
    blogRoute.content = `
    <div class="py-16 max-w-6xl mx-auto px-6">
      <div class="text-center mb-16">
        <span class="text-cyan-400 font-extrabold uppercase tracking-widest text-xs bg-cyan-950/60 border border-cyan-800/80 px-4 py-1.5 rounded-full">Knowledge Base & Pillar Guides</span>
        <h1 class="text-4xl md:text-6xl font-black text-white mt-4 tracking-tight">The Universal Media Engineering Library</h1>
        <p class="text-zinc-400 mt-4 max-w-2xl mx-auto text-base">Master video stream extraction, 160k audio transcoding, watermark eradication, and competitor technical comparisons across 132 authoritative guides.</p>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        ${blogs.map(b => `
          <article class="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl overflow-hidden hover:border-cyan-500/50 transition-all flex flex-col justify-between group">
            <div class="h-44 overflow-hidden relative bg-zinc-950 border-b border-zinc-800/60">
              <a href="/blog/${b.slug}/">
                <img src="${b.thumbnail || `/thumbnails/${b.slug}.webp`}" alt="${b.title}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" onerror="this.onerror=null; this.src='/thumbnails/${b.slug}.png';" />
              </a>
              <span class="absolute top-3 left-3 text-[10px] font-extrabold text-black bg-cyan-400 px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm">${b.category || 'Guides'}</span>
            </div>
            <div class="p-6 flex-1 flex flex-col justify-between">
              <div>
                <div class="flex items-center justify-between gap-2 mb-3">
                  <span class="text-xs text-zinc-500 font-medium">${b.readTime || '15 min read'}</span>
                  <span class="text-xs text-zinc-500 font-medium">${b.date}</span>
                </div>
                <h2 class="text-lg font-bold text-white group-hover:text-cyan-300 transition-colors line-clamp-2 mb-2 leading-snug">
                  <a href="/blog/${b.slug}/">${b.title}</a>
                </h2>
                <p class="text-sm text-zinc-400 line-clamp-3 mb-4 leading-relaxed">${b.excerpt}</p>
              </div>
              <div class="pt-4 border-t border-zinc-800/80 flex items-center justify-between text-xs font-semibold">
                <a href="/blog/${b.slug}/" class="text-cyan-400 hover:text-white transition-colors inline-flex items-center gap-1">Read Guide →</a>
              </div>
            </div>
          </article>
        `).join('')}
      </div>
    </div>
    `;
  }

  for (const blog of blogs) {
    CANONICAL_ROUTES.push({
      path: "/blog/" + blog.slug + "/",
      priority: '0.7',
      changefreq: 'monthly',
      title: blog.title || 'Blog Post',
      desc: blog.excerpt || 'Read this post on TIKHD',
      content: blog.content,
      thumbnail: blog.thumbnail
    });
  }
} catch (e) {
  console.log('No blog data found or error parsing:', e.message);
}

function generateSitemap() {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

  for (const route of CANONICAL_ROUTES) {
    const fullUrl = `${BASE_URL}${route.path}`;
    const date = new Date().toISOString().split('T')[0];
    xml += `  <url>\n`;
    xml += `    <loc>${fullUrl}</loc>\n`;
    xml += `    <lastmod>${date}</lastmod>\n`;
    xml += `    <changefreq>${route.changefreq}</changefreq>\n`;
    xml += `    <priority>${route.priority}</priority>\n`;
    xml += `  </url>\n`;
  }

  xml += `</urlset>\n`;
  fs.writeFileSync(path.join(OUT_DIR, 'sitemap.xml'), xml);
  console.log(`[Success] Sitemap generated: ${CANONICAL_ROUTES.length} canonical pages -> Base URL: ${BASE_URL}`);
}

function generateRobots() {
  const robots = `User-agent: *\nAllow: /\nSitemap: ${BASE_URL}/sitemap.xml\n\nUser-agent: Mediapartners-Google\nAllow: /\n\nUser-agent: AdsBot-Google\nAllow: /\nUser-agent: Googlebot-Image\nAllow: /\n`;
  fs.writeFileSync(path.join(OUT_DIR, 'robots.txt'), robots);
  console.log('[Success] robots.txt generated');
}

function processPages() {
  if (!fs.existsSync(SRC_INDEX)) {
    console.error('Source index.html not found in dist. Run vite build first.');
    return;
  }
  const baseHtml = fs.readFileSync(SRC_INDEX, 'utf-8');

  for (const route of CANONICAL_ROUTES) {
    const routeDir = path.join(OUT_DIR, route.path);
    if (!fs.existsSync(routeDir)) {
      fs.mkdirSync(routeDir, { recursive: true });
    }

    let pageHtml = baseHtml;
    
    // Clean out base template SEO tags to prevent duplicate meta / canonical issues
    pageHtml = pageHtml.replace(/<title>.*?<\/title>/is, '');
    pageHtml = pageHtml.replace(/<meta\s+name="description"\s+content=".*?"\s*\/?>/gis, '');
    pageHtml = pageHtml.replace(/<link\s+rel="canonical"\s+href=".*?"\s*\/?>/gis, '');
    pageHtml = pageHtml.replace(/<meta\s+property="og:.*?"\s+content=".*?"\s*\/?>/gis, '');
    pageHtml = pageHtml.replace(/<meta\s+(?:name|property)="twitter:.*?"\s+content=".*?"\s*\/?>/gis, '');

    // For non-home pages, remove default root schema
    if (route.path !== '/') {
      pageHtml = pageHtml.replace(/<script type="application\/ld\+json">\s*\{\s*"@context":\s*"https:\/\/schema\.org",\s*"@type":\s*"WebSite"[\s\S]*?<\/script>/gis, '');
      pageHtml = pageHtml.replace(/<script type="application\/ld\+json">\s*\{\s*"@context":\s*"https:\/\/schema\.org",\s*"@type":\s*"SoftwareApplication"[\s\S]*?<\/script>/gis, '');
    }

    // Inject custom meta tags per route
    const canonical = `${BASE_URL}${route.path}`;
    const ogImg = route.thumbnail ? `${BASE_URL}${route.thumbnail.replace(/\.webp$/, '.png')}` : `${BASE_URL}/og-image.png`;
    const headInjection = `
    <title>${route.title}</title>
    <meta name="description" content="${route.desc}">
    <link rel="canonical" href="${canonical}">
    <meta property="og:title" content="${route.title}">
    <meta property="og:description" content="${route.desc}">
    <meta property="og:url" content="${canonical}">
    <meta property="og:type" content="${route.path.startsWith('/blog/') && route.path !== '/blog/' ? 'article' : 'website'}">
    <meta property="og:image" content="${ogImg}">
    <meta property="twitter:card" content="summary_large_image">
    <meta property="twitter:title" content="${route.title}">
    <meta property="twitter:description" content="${route.desc}">
    <meta property="twitter:image" content="${ogImg}">
    <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1">
    `;

    // Inject head tags right after charset / viewport
    pageHtml = pageHtml.replace(/(<meta\s+name="viewport"[^>]*>)/i, `$1\n${headInjection}`);
    
    // Inject Schema if homepage
    if (route.path === '/') {
        const schema = `
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "TIKHD Universal Media Downloader",
      "operatingSystem": "Web, Windows, macOS, Android, iOS, Linux",
      "applicationCategory": "MultimediaApplication",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD"
      },
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": "4.95",
        "ratingCount": "18450",
        "bestRating": "5"
      }
    }
    </script>
        `;
        pageHtml = pageHtml.replace('</head>', schema + '\n</head>');
    }
    
    // Inject article content into <main> if provided (for SEO indexing)
    if (route.content) {
        if (route.path === '/blog/') {
            pageHtml = pageHtml.replace(/<main id="main-content".*?>.*?<\/main>/s, `<main id="main-content" class="w-full">\n${route.content}\n</main>`);
            const collectionSchema = `
            <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "CollectionPage",
              "name": "TIKHD Media Engineering Library & Guides",
              "description": "Comprehensive knowledge base of 132 guides covering video stream extraction, watermark removal, audio fidelity, and competitor comparisons.",
              "url": "https://tikhd.app/blog/"
            }
            </script>
            `;
            pageHtml = pageHtml.replace('</head>', collectionSchema + '\n</head>');
        } else {
            const articleThumb = route.thumbnail ? `<div class="rounded-3xl overflow-hidden mb-12 shadow-2xl border border-zinc-800 bg-zinc-950"><img src="${route.thumbnail}" alt="${route.title}" class="w-full h-auto object-cover" onerror="this.onerror=null; this.src='${route.thumbnail.replace(/\.webp$/, '.png')}';" /></div>` : '';
            pageHtml = pageHtml.replace(/<main id="main-content".*?>.*?<\/main>/s, `<main id="main-content" class="w-full">\n<article class="prose prose-invert max-w-4xl mx-auto py-12 px-6">\n${articleThumb}\n${route.content}\n</article>\n</main>`);
        }
    }

    fs.writeFileSync(path.join(routeDir, 'index.html'), pageHtml);
  }
  console.log(`[Success] Prerendered ${CANONICAL_ROUTES.length} physical HTML routes in dist/`);
}

// Generate SSG pages
processPages();
generateSitemap();
generateRobots();

// Copy ads.txt to dist if present in public
if (fs.existsSync(path.join(__dirname, 'public', 'ads.txt'))) {
    fs.copyFileSync(path.join(__dirname, 'public', 'ads.txt'), path.join(OUT_DIR, 'ads.txt'));
}

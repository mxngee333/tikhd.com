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
    
    // Inject custom meta tags per route
    const canonical = `${BASE_URL}${route.path}`;
    const headInjection = `
    <title>${route.title}</title>
    <meta name="description" content="${route.desc}">
    <link rel="canonical" href="${canonical}">
    <meta property="og:title" content="${route.title}">
    <meta property="og:description" content="${route.desc}">
    <meta property="og:url" content="${canonical}">
    <meta property="twitter:title" content="${route.title}">
    <meta property="twitter:description" content="${route.desc}">
    <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1">
    <meta name="google-adsense-account" content="ca-pub-4157219900484080">
    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4157219900484080" crossorigin="anonymous"></script>
    `;

    // Replace title and inject tags
    pageHtml = pageHtml.replace(/<title>.*?<\/title>/s, headInjection);
    
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
        pageHtml = pageHtml.replace(/<main id="main-content".*?>.*?<\/main>/s, `<main id="main-content" class="w-full">\n<article class="prose prose-invert max-w-3xl mx-auto py-12 px-6">\n<h1>${route.title}</h1>\n${route.content}\n</article>\n</main>`);
        
        if (route.path.startsWith('/blog/')) {
            const blogSchema = `
            <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "BlogPosting",
              "headline": "${route.title}",
              "image": "${route.thumbnail || 'https://tikhd.app/og-image.png'}",
              "author": {
                "@type": "Organization",
                "name": "TIKHD"
              },
              "publisher": {
                "@type": "Organization",
                "name": "TIKHD",
                "logo": {
                  "@type": "ImageObject",
                  "url": "https://tikhd.app/favicon-96x96.png"
                }
              },
              "datePublished": "${new Date().toISOString()}",
              "dateModified": "${new Date().toISOString()}"
            }
            </script>
            ${route.thumbnail ? `<link rel="preload" as="image" href="${route.thumbnail}">` : ''}
            `;
            pageHtml = pageHtml.replace('</head>', blogSchema + '\n</head>');
        }
    }

    fs.writeFileSync(path.join(routeDir, 'index.html'), pageHtml);
    console.log(`[Success] Generated ${route.path}index.html`);
  }
}

// Generate SSG pages
processPages();
generateSitemap();
generateRobots();

// Copy ads.txt to dist if present in public
if (fs.existsSync(path.join(__dirname, 'public', 'ads.txt'))) {
    fs.copyFileSync(path.join(__dirname, 'public', 'ads.txt'), path.join(OUT_DIR, 'ads.txt'));
}

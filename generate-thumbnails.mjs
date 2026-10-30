import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicDir = path.join(__dirname, 'public');
const thumbsDir = path.join(publicDir, 'thumbnails');

if (!fs.existsSync(thumbsDir)) {
  fs.mkdirSync(thumbsDir, { recursive: true });
}

// Cluster Visual Theme Configs
const CLUSTERS = {
  'Competitor Reviews': {
    primary: '#06b6d4',
    secondary: '#3b82f6',
    bgDark: '#080c14',
    glow: 'rgba(6, 182, 212, 0.25)',
    pillBorder: '#0e7490',
    pillBg: '#083344',
    iconType: 'comparison',
    fallbackSlug: 'competitor-reviews'
  },
  'Under the Hood': {
    primary: '#10b981',
    secondary: '#06b6d4',
    bgDark: '#07130e',
    glow: 'rgba(16, 185, 129, 0.25)',
    pillBorder: '#047857',
    pillBg: '#064e3b',
    iconType: 'code',
    fallbackSlug: 'under-the-hood'
  },
  'Creator Guides': {
    primary: '#f43f5e',
    secondary: '#a855f7',
    bgDark: '#14080e',
    glow: 'rgba(244, 63, 94, 0.25)',
    pillBorder: '#be123c',
    pillBg: '#4c0519',
    iconType: 'creator',
    fallbackSlug: 'creator-guides'
  },
  'Platform Guides': {
    primary: '#a855f7',
    secondary: '#06b6d4',
    bgDark: '#100816',
    glow: 'rgba(168, 85, 247, 0.25)',
    pillBorder: '#7e22ce',
    pillBg: '#3b0764',
    iconType: 'platform',
    fallbackSlug: 'platform-guides'
  },
  'Audio Mastering': {
    primary: '#f59e0b',
    secondary: '#ef4444',
    bgDark: '#140c06',
    glow: 'rgba(245, 158, 11, 0.25)',
    pillBorder: '#b45309',
    pillBg: '#451a03',
    iconType: 'audio',
    fallbackSlug: 'audio-mastering'
  },
  'Security & Legal': {
    primary: '#3b82f6',
    secondary: '#10b981',
    bgDark: '#070b16',
    glow: 'rgba(59, 130, 246, 0.25)',
    pillBorder: '#1d4ed8',
    pillBg: '#172554',
    iconType: 'security',
    fallbackSlug: 'security-legal'
  }
};

function escapeXml(unsafe) {
  return (unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wrapTitle(title, maxCharsPerLine = 42) {
  const words = title.split(' ');
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
      currentLine = (currentLine + ' ' + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
      if (lines.length === 2) break;
    }
  }
  if (currentLine && lines.length < 2) lines.push(currentLine);

  if (lines.length === 0) lines.push(title.slice(0, 40));
  if (words.length > 0 && lines.length === 2 && words.join(' ').length > (lines[0].length + lines[1].length + 4)) {
    if (!lines[1].endsWith('...')) lines[1] += '...';
  }
  return lines;
}

function getIconSvg(iconType, primaryColor, secondaryColor) {
  switch (iconType) {
    case 'comparison':
      return `
        <!-- Dual Matrix Comparison Swords / Meter -->
        <g transform="translate(930, 160) scale(1.4)">
          <circle cx="70" cy="70" r="64" fill="${secondaryColor}" fill-opacity="0.1" stroke="${primaryColor}" stroke-width="2"/>
          <path d="M 40 100 L 100 40 M 100 40 L 80 40 M 100 40 L 100 60" stroke="${primaryColor}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M 100 100 L 40 40 M 40 40 L 60 40 M 40 40 L 40 60" stroke="${secondaryColor}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="70" cy="70" r="14" fill="${primaryColor}"/>
        </g>
      `;
    case 'code':
      return `
        <!-- High-Speed Terminal Engine -->
        <g transform="translate(930, 160) scale(1.4)">
          <rect x="10" y="15" width="120" height="95" rx="16" fill="${secondaryColor}" fill-opacity="0.1" stroke="${primaryColor}" stroke-width="2"/>
          <path d="M 35 48 L 55 63 L 35 78" stroke="${primaryColor}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
          <line x1="68" y1="78" x2="105" y2="78" stroke="${secondaryColor}" stroke-width="5" stroke-linecap="round"/>
          <circle cx="30" cy="30" r="4" fill="#ef4444"/>
          <circle cx="45" cy="30" r="4" fill="#f59e0b"/>
          <circle cx="60" cy="30" r="4" fill="#10b981"/>
        </g>
      `;
    case 'creator':
      return `
        <!-- Creator Lens & 60fps Spark -->
        <g transform="translate(930, 160) scale(1.4)">
          <circle cx="70" cy="70" r="60" fill="${secondaryColor}" fill-opacity="0.1" stroke="${primaryColor}" stroke-width="2"/>
          <circle cx="70" cy="70" r="38" fill="none" stroke="${secondaryColor}" stroke-width="4" stroke-dasharray="8 4"/>
          <circle cx="70" cy="70" r="20" fill="${primaryColor}"/>
          <path d="M 100 25 L 115 45 L 98 47 L 110 65" fill="none" stroke="#fbbf24" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
        </g>
      `;
    case 'platform':
      return `
        <!-- Multi-Platform Music & Video Node -->
        <g transform="translate(930, 160) scale(1.4)">
          <rect x="15" y="15" width="110" height="110" rx="24" fill="${secondaryColor}" fill-opacity="0.1" stroke="${primaryColor}" stroke-width="2"/>
          <!-- Play Triangle & Note -->
          <polygon points="50,45 50,85 85,65" fill="${primaryColor}"/>
          <circle cx="95" cy="40" r="10" fill="${secondaryColor}"/>
        </g>
      `;
    case 'audio':
      return `
        <!-- Audio Waves & 160k CBR Visualizer -->
        <g transform="translate(930, 160) scale(1.4)">
          <circle cx="70" cy="70" r="64" fill="${secondaryColor}" fill-opacity="0.1" stroke="${primaryColor}" stroke-width="2"/>
          <!-- Sound Bars -->
          <rect x="35" y="55" width="8" height="30" rx="4" fill="${secondaryColor}"/>
          <rect x="49" y="40" width="8" height="60" rx="4" fill="${primaryColor}"/>
          <rect x="63" y="30" width="8" height="80" rx="4" fill="#ffffff"/>
          <rect x="77" y="45" width="8" height="50" rx="4" fill="${primaryColor}"/>
          <rect x="91" y="58" width="8" height="24" rx="4" fill="${secondaryColor}"/>
        </g>
      `;
    case 'security':
    default:
      return `
        <!-- Verified SSL Shield & Padlock -->
        <g transform="translate(930, 160) scale(1.4)">
          <path d="M 70 20 L 115 38 C 115 85 70 115 70 115 C 70 115 25 85 25 38 Z" fill="${secondaryColor}" fill-opacity="0.12" stroke="${primaryColor}" stroke-width="2"/>
          <path d="M 50 65 L 64 78 L 92 48" fill="none" stroke="${primaryColor}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
        </g>
      `;
  }
}

export function generateBannerSvg(post, cluster) {
  const escapedTitle = escapeXml(post.title);
  const titleLines = wrapTitle(post.title);
  const escapedCategory = escapeXml(post.category || 'Guides');
  const escapedReadTime = escapeXml(post.readTime || '15 MIN');
  const escapedDate = escapeXml(post.date || 'OCTOBER 2026');

  const line1 = escapeXml(titleLines[0] || '');
  const line2 = escapeXml(titleLines[1] || '');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <!-- Background Gradient -->
    <linearGradient id="canvasGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0c0d14"/>
      <stop offset="50%" stop-color="#08080c"/>
      <stop offset="100%" stop-color="${cluster.bgDark}"/>
    </linearGradient>

    <!-- Theme Accent Gradient -->
    <linearGradient id="themeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${cluster.primary}"/>
      <stop offset="100%" stop-color="${cluster.secondary}"/>
    </linearGradient>

    <!-- Ambient Radial Glow -->
    <radialGradient id="ambientGlow" cx="80%" cy="30%" r="50%">
      <stop offset="0%" stop-color="${cluster.primary}" stop-opacity="0.25"/>
      <stop offset="70%" stop-color="${cluster.secondary}" stop-opacity="0.05"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>

    <!-- Subtle Grid Pattern -->
    <pattern id="cyberGrid" width="48" height="48" patternUnits="userSpaceOnUse">
      <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#27272a" stroke-width="1" stroke-opacity="0.18"/>
    </pattern>

    <!-- Drop Shadow Filter -->
    <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="6" stdDeviation="16" flood-color="${cluster.primary}" flood-opacity="0.35"/>
    </filter>
  </defs>

  <!-- Canvas Surface -->
  <rect width="1200" height="630" fill="url(#canvasGrad)"/>
  <rect width="1200" height="630" fill="url(#ambientGlow)"/>
  <rect width="1200" height="630" fill="url(#cyberGrid)"/>

  <!-- Outer Luxury Border -->
  <rect x="24" y="24" width="1152" height="582" rx="32" fill="none" stroke="#27272a" stroke-width="1.5" stroke-opacity="0.6"/>
  <rect x="28" y="28" width="1144" height="574" rx="28" fill="none" stroke="${cluster.primary}" stroke-width="1" stroke-opacity="0.2"/>

  <!-- Left Header Pill -->
  <g transform="translate(70, 70)">
    <rect width="320" height="38" rx="19" fill="#18181b" stroke="#27272a" stroke-width="1"/>
    <circle cx="20" cy="19" r="5" fill="${cluster.primary}"/>
    <text x="35" y="24" fill="#a1a1aa" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="800" letter-spacing="2">TIKHD MEDIA ENGINEERING LABS</text>
  </g>

  <!-- Right Category Badge -->
  <g transform="translate(410, 70)">
    <rect width="210" height="38" rx="19" fill="${cluster.pillBg}" stroke="${cluster.pillBorder}" stroke-width="1.5"/>
    <text x="105" y="24" fill="${cluster.primary}" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="900" letter-spacing="1.5" text-anchor="middle">${escapedCategory.toUpperCase()}</text>
  </g>

  <!-- Center Decorative Vector Graphic -->
  ${getIconSvg(cluster.iconType, cluster.primary, cluster.secondary)}

  <!-- Post Title Area -->
  <g transform="translate(70, 220)">
    <text x="0" y="40" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif" font-size="44" font-weight="900" letter-spacing="-0.5" filter="url(#softGlow)">
      ${line1}
    </text>
    ${line2 ? `
    <text x="0" y="98" fill="#e4e4e7" font-family="system-ui, -apple-system, sans-serif" font-size="44" font-weight="900" letter-spacing="-0.5">
      ${line2}
    </text>
    ` : ''}
  </g>

  <!-- Bottom Accent Divider Bar -->
  <line x1="70" y1="460" x2="1130" y2="460" stroke="#27272a" stroke-width="1"/>
  <line x1="70" y1="460" x2="280" y2="460" stroke="url(#themeGrad)" stroke-width="3" stroke-linecap="round"/>

  <!-- Footer Metadata & Brand -->
  <g transform="translate(70, 520)">
    <!-- Meta Items -->
    <text x="0" y="10" fill="#71717a" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="700" letter-spacing="1.5">
      ${escapedDate.toUpperCase()}  •  ${escapedReadTime.toUpperCase()} READ  •  WATERMARK-FREE
    </text>

    <!-- Right Brand Indicator -->
    <g transform="translate(860, -10)">
      <rect width="180" height="36" rx="10" fill="#18181b" stroke="${cluster.primary}" stroke-width="1" stroke-opacity="0.4"/>
      <!-- Download Arrow Icon -->
      <path d="M 24 12 L 24 22 M 19 18 L 24 23 L 29 18" stroke="${cluster.primary}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      <text x="40" y="23" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="900" letter-spacing="1">TIKHD.APP</text>
    </g>
  </g>
</svg>
`;
}

async function main() {
  console.log('🚀 Starting Universal Thumbnail Engine for TIKHD...');

  // 1. Load blog data
  const blogDataPath = path.join(__dirname, 'src/blog-data.json');
  const blogMetaPath = path.join(__dirname, 'src/blog-meta.json');

  const blogs = JSON.parse(fs.readFileSync(blogDataPath, 'utf8'));
  const metaBlogs = JSON.parse(fs.readFileSync(blogMetaPath, 'utf8'));

  console.log(`Loaded ${blogs.length} articles to generate thumbnails for.`);

  // 2. Generate individual SVG thumbnails for all 132 posts
  let count = 0;
  for (const post of blogs) {
    const cluster = CLUSTERS[post.category] || CLUSTERS['Competitor Reviews'];
    const svgContent = generateBannerSvg(post, cluster);
    const svgFile = path.join(thumbsDir, `${post.slug}.svg`);
    fs.writeFileSync(svgFile, svgContent, 'utf8');

    // Update thumbnail URL
    post.thumbnail = `/thumbnails/${post.slug}.svg`;
    count++;
  }

  // 3. Update meta blogs as well
  for (const post of metaBlogs) {
    post.thumbnail = `/thumbnails/${post.slug}.svg`;
  }

  // 4. Generate cluster fallback SVGs + default fallback
  for (const [catName, cluster] of Object.entries(CLUSTERS)) {
    const fallbackPost = {
      title: `${catName}: Comprehensive Guides & Engineering Analysis`,
      category: catName,
      readTime: '15 min',
      date: 'OCTOBER 2026'
    };
    const catSvg = generateBannerSvg(fallbackPost, cluster);
    fs.writeFileSync(path.join(thumbsDir, `${cluster.fallbackSlug}.svg`), catSvg, 'utf8');
  }

  // Default fallback
  const defaultSvg = generateBannerSvg({
    title: 'Universal Media Downloader & Audio Extraction Hub',
    category: 'Competitor Reviews',
    readTime: '15 min',
    date: 'OCTOBER 2026'
  }, CLUSTERS['Competitor Reviews']);
  fs.writeFileSync(path.join(thumbsDir, 'default.svg'), defaultSvg, 'utf8');

  // Master og-image.svg
  fs.writeFileSync(path.join(publicDir, 'og-image.svg'), defaultSvg, 'utf8');

  // Save updated json files
  fs.writeFileSync(blogDataPath, JSON.stringify(blogs, null, 2), 'utf8');
  fs.writeFileSync(blogMetaPath, JSON.stringify(metaBlogs, null, 2), 'utf8');

  console.log(`✅ Generated ${count} bespoke SVGs in public/thumbnails/`);
  console.log('✅ Generated 6 category fallback SVGs in public/thumbnails/');
  console.log('✅ Updated src/blog-data.json and src/blog-meta.json with local thumbnail paths.');
}

main().catch(err => {
  console.error('Error generating thumbnails:', err);
  process.exit(1);
});

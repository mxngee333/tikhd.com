const fs = require('fs');
// Use relative path from the script execution location
const blogData = require('../src/blog-data');

const baseUrl = 'https://tikhd.app';
const urls = [
  '',
  '/blog'
];

blogData.blogPosts.forEach(post => {
  urls.push('/blog/' + post.slug);
});

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(url => `  <url>
    <loc>${baseUrl}${url}</loc>
    <changefreq>weekly</changefreq>
    <priority>${url === '' ? '1.0' : (url === '/blog' ? '0.8' : '0.6')}</priority>
  </url>`).join('\n')}
</urlset>`;

fs.writeFileSync('public/sitemap.xml', sitemap);
console.log('Sitemap generated with ' + urls.length + ' URLs');

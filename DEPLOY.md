# Deployment Instructions - SnapTik Clone

This application is a full-stack project using Node.js (Express) and Vite.

## Hosting Options

### 1. VPS (Recommended for Custom Scrapers)
Since TikTok may block common cloud ranges (Vercel/AWS), hosting on a VPS with a clean IP is often best.

1. **Server Setup**:
   - Install Node.js (v18+).
   - Clone the repository.
   - `npm install`
   - `npm run build`
   - Start the server: `NODE_ENV=production npm start`

2. **Server Service**:
   Use `pm2` to keep the process running:
   ```bash
   npm install pm2 -g
   pm2 start npm --name "snaptik" -- start
   ```

### 2. Vercel (Serverless)
*Note: Scrapers can be flaky on serverless platforms due to IP blocking by TikTok.*

- Connect your GitHub repo to Vercel.
- Vercel should auto-detect the Vite build.
- Ensure you set up the `api/` routes correctly if using Vercel's specific serverless function structure (you might need to move `server.ts` logic to `/api/*.ts`).

## Infrastructure: Behind Cloudflare

1. **DNS**: Point your domain (A or CNAME record) to your server IP or Vercel URL.
2. **SSL/TLS**: Set to "Full" or "Full (Strict)" in Cloudflare.
3. **Caching**:
   - Create a Cache Rule to cache static assets (`/assets/*`).
   - Do **NOT** cache the `/api/download` endpoint as it must fetch fresh data from TikTok.
4. **Performance**:
   - Enable **Auto Minify** (HTML, CSS, JS).
   - Enable **Brotli** and **HTTP/3 (QUIC)** in the Speed tab.
5. **Security (DDoS Protection)**:
   - Enable **Under Attack Mode** if you experience a burst of bot traffic.
   - Use **Bot Management** to block automated scrapers trying to use your utility as an API.
6. **CORS/Hreflang**: Ensure Cloudflare doesn't strip the `hreflang` tags or interfere with cross-origin requests from the CDN links.

## Environment Variables
- `NODE_ENV`: Set to `production`.
- `PORT`: Default is 3000.

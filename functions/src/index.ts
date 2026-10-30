import * as functions from "firebase-functions";
import express from "express";
import cors from "cors";
import axios from "axios";
import * as cheerio from "cheerio";

const app = express();
app.use(cors({ origin: true }));

// Debug log to see path
app.use((req, res, next) => {
  console.log(`[Proxy] Request Path: ${req.path}, Method: ${req.method}`);
  next();
});

// Helper for scraping TikTok
async function scrapeTikTok(url: string) {
  const baseInputUrl = url.trim().split("?")[0];
  const response = await axios.get(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Referer": "https://www.tiktok.com/",
    },
    maxRedirects: 10,
    timeout: 10000,
  });

  const redirectedUrl = response.request?.res?.responseUrl || url;
  const finalUrl = redirectedUrl.split("?")[0];
  const itemIdMatch = finalUrl.match(/\/(?:video|photo|v)\/(\d+)/) || finalUrl.match(/item_id=(\d+)/);
  const itemId = itemIdMatch ? itemIdMatch[1] : null;
  const isDouyin = finalUrl.includes("douyin.com");

  const attemptHtmlScraping = (html: string) => {
    const $ = cheerio.load(html);
    const scriptData = $("#__UNIVERSAL_DATA_FOR_REHYDRATION__").text();
    if (scriptData) {
      try {
        const json = JSON.parse(scriptData);
        const videoData = json["__DEFAULT_SCOPE__"]?.["webapp.video-detail"]?.["itemInfo"]?.["itemStruct"] || 
                         json["__DEFAULT_SCOPE__"]?.["webapp.video-detail"]?.["shareMeta"];
        if (videoData) {
          return {
            title: videoData.desc || videoData.title || "TikTok Video",
            author: videoData.author?.nickname || videoData.authorName || "@user",
            thumbnail: videoData.video?.cover || videoData.imageMeta?.url || "",
            downloadUrl: videoData.video?.playAddr || "",
            duration: videoData.video?.duration || 0,
            stats: videoData.stats || {}
          };
        }
      } catch (e) {}
    }

    const sigiData = $("#SIGI_STATE").text();
    if (sigiData) {
      try {
        const json = JSON.parse(sigiData);
        const itemKey = Object.keys(json.ItemModule || {})[0];
        const videoData = json.ItemModule?.[itemKey];
        if (videoData) {
          return {
            title: videoData.desc || "TikTok Video",
            author: videoData.author || "@user",
            thumbnail: videoData.video?.cover || "",
            downloadUrl: videoData.video?.playAddr || "",
            duration: videoData.video?.duration || 0,
            stats: videoData.stats || {}
          };
        }
      } catch (e) {}
    }
    return null;
  };

  if (itemId) {
    const endpoints = isDouyin 
      ? [`https://www.douyin.com/aweme/v1/web/aweme/detail/?aweme_id=${itemId}`]
      : [
          `https://api16-normal-c-useast1a.tiktokv.com/media/api/item/detail/?item_id=${itemId}`,
          `https://api22-normal-c-alisg.tiktokv.com/aweme/v1/feed/?aweme_id=${itemId}`
        ];

    const userAgents = [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21A329 TikTok 31.5.0",
      "Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36"
    ];

    for (const apiEndpoint of endpoints) {
      try {
        const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];
        const apiResponse = await axios.get(apiEndpoint, {
          headers: { "User-Agent": randomUA },
          timeout: 5000,
        });

        const itemData = isDouyin 
          ? apiResponse.data?.aweme_detail 
          : (apiResponse.data?.item_list?.[0] || apiResponse.data?.aweme_list?.[0]);

        if (itemData) {
          return {
            title: itemData.desc || itemData.text || "TikTok Video",
            author: itemData.author?.nickname || "unknown",
            thumbnail: itemData.video?.cover?.url_list?.[0] || "",
            downloadUrl: itemData.video?.play_addr?.url_list?.[0] || "",
            duration: itemData.video?.duration || 0,
            stats: {
              likes: itemData.statistics?.digg_count || 0,
              comments: itemData.statistics?.comment_count || 0,
              shares: itemData.statistics?.share_count || 0
            }
          };
        }
      } catch (innerErr: any) {}
    }
  }

  // TikWM fallback
  try {
    const tikwmUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(finalUrl)}`;
    const tikwmResponse = await axios.get(tikwmUrl, {
      timeout: 8000,
      headers: {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });
    
    if (tikwmResponse.data?.data) {
      const twData = tikwmResponse.data.data;
      const getAbsoluteUrl = (p: string) => (!p ? "" : p.startsWith("http") ? p : `https://www.tikwm.com${p}`);
      return {
        title: twData.title || "TikTok Video",
        author: twData.author?.nickname || twData.author?.unique_id || "@user",
        thumbnail: getAbsoluteUrl(twData.cover),
        downloadUrl: getAbsoluteUrl(twData.play),
        duration: twData.duration || 0,
        stats: {
          likes: twData.digg_count,
          comments: twData.comment_count,
          shares: twData.share_count
        }
      };
    }
  } catch (twErr) {}

  return attemptHtmlScraping(response.data);
}

// Universal /api/analyze Handler
const analyzeHandler = async (req: express.Request, res: express.Response) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "URL is required" });

  const cleanUrl = String(url).trim();
  const isTikTok = cleanUrl.includes("tiktok.com") || cleanUrl.includes("douyin.com");

  if (isTikTok) {
    try {
      const result = await scrapeTikTok(cleanUrl);
      if (result) {
        return res.json({
          success: true,
          title: result.title,
          thumbnail: result.thumbnail,
          platform: "TikTok",
          author: result.author,
          duration: result.duration || 0,
          duration_string: `${Math.floor((result.duration || 0) / 60)}:${Math.floor((result.duration || 0) % 60).toString().padStart(2, "0")}`,
          has_video: true,
          has_audio: true,
          downloadUrl: result.downloadUrl,
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
          stats: result.stats
        });
      }
    } catch (e: any) {
      console.error("[Functions Analyze] TikTok scrape error:", e.message);
    }
  }

  // Universal metadata extraction via OpenGraph / oEmbed
  try {
    const pageRes = await axios.get(cleanUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      },
      timeout: 8000
    });

    const $ = cheerio.load(pageRes.data);
    const title = $('meta[property="og:title"]').attr("content") || $("title").text() || "Universal Media";
    const thumbnail = $('meta[property="og:image"]').attr("content") || "";
    const siteName = $('meta[property="og:site_name"]').attr("content") || "Web Media";

    return res.json({
      success: true,
      title: title.trim(),
      thumbnail,
      platform: siteName,
      author: "@creator",
      duration: 0,
      duration_string: "Media",
      has_video: true,
      has_audio: true,
      downloadUrl: cleanUrl,
      original_url: cleanUrl,
      video_formats: [
        { format_id: "1080", ext: "mp4", label: "Full HD 1080p", resolution: "1080p" },
        { format_id: "720", ext: "mp4", label: "HD 720p", resolution: "720p" }
      ],
      audio_formats: [
        { format_id: "mp3", ext: "mp3", label: "MP3 Audio (160kbps)" }
      ]
    });
  } catch (err: any) {
    return res.status(500).json({
      error: "Unable to analyze media via cloud proxy. Please ensure the link is public.",
      details: err.message
    });
  }
};

app.post("/api/analyze", analyzeHandler);
app.post("/analyze", analyzeHandler);

// Legacy POST /api/download
const downloadHandler = async (req: express.Request, res: express.Response) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "Invalid URL" });

  try {
    const scraped = await scrapeTikTok(url);
    if (scraped) return res.json(scraped);
    return res.status(404).json({ error: "Media not found or restricted." });
  } catch (error: any) {
    return res.status(500).json({ error: "Failed to process video." });
  }
};

app.post("/api/download", downloadHandler);
app.post("/download", downloadHandler);

// GET /api/download-file proxy
const downloadFileHandler = async (req: express.Request, res: express.Response) => {
  try {
    const url = req.query.url as string;
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
    res.setHeader("Content-Disposition", `attachment; filename="tikhd_${Date.now()}.mp4"`);
    res.setHeader("Content-Type", "video/mp4");
    response.data.pipe(res);
  } catch (e) {
    res.status(500).send("Error downloading file");
  }
};

app.get("/api/download-file", downloadFileHandler);
app.get("/download-file", downloadFileHandler);

// Export proxy function
export const proxy = functions.https.onRequest(app);

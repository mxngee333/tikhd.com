"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.proxy = void 0;
const functions = __importStar(require("firebase-functions"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const axios_1 = __importDefault(require("axios"));
const cheerio = __importStar(require("cheerio"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)({ origin: true }));
// Debug log to see path
app.use((req, res, next) => {
    console.log(`[Proxy] Request Path: ${req.path}, Method: ${req.method}`);
    next();
});
// Helper for scraping TikTok
async function scrapeTikTok(url) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w;
    const baseInputUrl = url.trim().split("?")[0];
    const response = await axios_1.default.get(url, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": "https://www.tiktok.com/",
        },
        maxRedirects: 10,
        timeout: 10000,
    });
    const redirectedUrl = ((_b = (_a = response.request) === null || _a === void 0 ? void 0 : _a.res) === null || _b === void 0 ? void 0 : _b.responseUrl) || url;
    const finalUrl = redirectedUrl.split("?")[0];
    const itemIdMatch = finalUrl.match(/\/(?:video|photo|v)\/(\d+)/) || finalUrl.match(/item_id=(\d+)/);
    const itemId = itemIdMatch ? itemIdMatch[1] : null;
    const isDouyin = finalUrl.includes("douyin.com");
    const attemptHtmlScraping = (html) => {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
        const $ = cheerio.load(html);
        const scriptData = $("#__UNIVERSAL_DATA_FOR_REHYDRATION__").text();
        if (scriptData) {
            try {
                const json = JSON.parse(scriptData);
                const videoData = ((_c = (_b = (_a = json["__DEFAULT_SCOPE__"]) === null || _a === void 0 ? void 0 : _a["webapp.video-detail"]) === null || _b === void 0 ? void 0 : _b["itemInfo"]) === null || _c === void 0 ? void 0 : _c["itemStruct"]) ||
                    ((_e = (_d = json["__DEFAULT_SCOPE__"]) === null || _d === void 0 ? void 0 : _d["webapp.video-detail"]) === null || _e === void 0 ? void 0 : _e["shareMeta"]);
                if (videoData) {
                    return {
                        title: videoData.desc || videoData.title || "TikTok Video",
                        author: ((_f = videoData.author) === null || _f === void 0 ? void 0 : _f.nickname) || videoData.authorName || "@user",
                        thumbnail: ((_g = videoData.video) === null || _g === void 0 ? void 0 : _g.cover) || ((_h = videoData.imageMeta) === null || _h === void 0 ? void 0 : _h.url) || "",
                        downloadUrl: ((_j = videoData.video) === null || _j === void 0 ? void 0 : _j.playAddr) || "",
                        duration: ((_k = videoData.video) === null || _k === void 0 ? void 0 : _k.duration) || 0,
                        stats: videoData.stats || {}
                    };
                }
            }
            catch (e) { }
        }
        const sigiData = $("#SIGI_STATE").text();
        if (sigiData) {
            try {
                const json = JSON.parse(sigiData);
                const itemKey = Object.keys(json.ItemModule || {})[0];
                const videoData = (_l = json.ItemModule) === null || _l === void 0 ? void 0 : _l[itemKey];
                if (videoData) {
                    return {
                        title: videoData.desc || "TikTok Video",
                        author: videoData.author || "@user",
                        thumbnail: ((_m = videoData.video) === null || _m === void 0 ? void 0 : _m.cover) || "",
                        downloadUrl: ((_o = videoData.video) === null || _o === void 0 ? void 0 : _o.playAddr) || "",
                        duration: ((_p = videoData.video) === null || _p === void 0 ? void 0 : _p.duration) || 0,
                        stats: videoData.stats || {}
                    };
                }
            }
            catch (e) { }
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
                const apiResponse = await axios_1.default.get(apiEndpoint, {
                    headers: { "User-Agent": randomUA },
                    timeout: 5000,
                });
                const itemData = isDouyin
                    ? (_c = apiResponse.data) === null || _c === void 0 ? void 0 : _c.aweme_detail
                    : (((_e = (_d = apiResponse.data) === null || _d === void 0 ? void 0 : _d.item_list) === null || _e === void 0 ? void 0 : _e[0]) || ((_g = (_f = apiResponse.data) === null || _f === void 0 ? void 0 : _f.aweme_list) === null || _g === void 0 ? void 0 : _g[0]));
                if (itemData) {
                    return {
                        title: itemData.desc || itemData.text || "TikTok Video",
                        author: ((_h = itemData.author) === null || _h === void 0 ? void 0 : _h.nickname) || "unknown",
                        thumbnail: ((_l = (_k = (_j = itemData.video) === null || _j === void 0 ? void 0 : _j.cover) === null || _k === void 0 ? void 0 : _k.url_list) === null || _l === void 0 ? void 0 : _l[0]) || "",
                        downloadUrl: ((_p = (_o = (_m = itemData.video) === null || _m === void 0 ? void 0 : _m.play_addr) === null || _o === void 0 ? void 0 : _o.url_list) === null || _p === void 0 ? void 0 : _p[0]) || "",
                        duration: ((_q = itemData.video) === null || _q === void 0 ? void 0 : _q.duration) || 0,
                        stats: {
                            likes: ((_r = itemData.statistics) === null || _r === void 0 ? void 0 : _r.digg_count) || 0,
                            comments: ((_s = itemData.statistics) === null || _s === void 0 ? void 0 : _s.comment_count) || 0,
                            shares: ((_t = itemData.statistics) === null || _t === void 0 ? void 0 : _t.share_count) || 0
                        }
                    };
                }
            }
            catch (innerErr) { }
        }
    }
    // TikWM fallback
    try {
        const tikwmUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(finalUrl)}`;
        const tikwmResponse = await axios_1.default.get(tikwmUrl, {
            timeout: 8000,
            headers: {
                "Accept": "application/json",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }
        });
        if ((_u = tikwmResponse.data) === null || _u === void 0 ? void 0 : _u.data) {
            const twData = tikwmResponse.data.data;
            const getAbsoluteUrl = (p) => (!p ? "" : p.startsWith("http") ? p : `https://www.tikwm.com${p}`);
            return {
                title: twData.title || "TikTok Video",
                author: ((_v = twData.author) === null || _v === void 0 ? void 0 : _v.nickname) || ((_w = twData.author) === null || _w === void 0 ? void 0 : _w.unique_id) || "@user",
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
    }
    catch (twErr) { }
    return attemptHtmlScraping(response.data);
}
// Universal /api/analyze Handler
const analyzeHandler = async (req, res) => {
    const { url } = req.body;
    if (!url)
        return res.status(400).json({ error: "URL is required" });
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
        }
        catch (e) {
            console.error("[Functions Analyze] TikTok scrape error:", e.message);
        }
    }
    // Universal metadata extraction via OpenGraph / oEmbed
    try {
        const pageRes = await axios_1.default.get(cleanUrl, {
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
    }
    catch (err) {
        return res.status(500).json({
            error: "Unable to analyze media via cloud proxy. Please ensure the link is public.",
            details: err.message
        });
    }
};
app.post("/api/analyze", analyzeHandler);
app.post("/analyze", analyzeHandler);
// Legacy POST /api/download
const downloadHandler = async (req, res) => {
    const { url } = req.body;
    if (!url)
        return res.status(400).json({ error: "Invalid URL" });
    try {
        const scraped = await scrapeTikTok(url);
        if (scraped)
            return res.json(scraped);
        return res.status(404).json({ error: "Media not found or restricted." });
    }
    catch (error) {
        return res.status(500).json({ error: "Failed to process video." });
    }
};
app.post("/api/download", downloadHandler);
app.post("/download", downloadHandler);
// GET /api/download-file proxy
const downloadFileHandler = async (req, res) => {
    try {
        const url = req.query.url;
        if (!url)
            return res.status(400).send("No URL provided");
        const response = await (0, axios_1.default)({
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
    }
    catch (e) {
        res.status(500).send("Error downloading file");
    }
};
app.get("/api/download-file", downloadFileHandler);
app.get("/download-file", downloadFileHandler);
// Export proxy function
exports.proxy = functions.https.onRequest(app);
//# sourceMappingURL=index.js.map
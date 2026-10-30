'use strict';

/**
 * Audiomack Engine for VideoVault / VidoGet
 * 
 * Capabilities:
 * - Detects all Audiomack URLs (songs, tracks, embeds)
 * - Directly extracts track metadata & track ID from Audiomack pages (Next.js SSR & OpenGraph)
 * - Signs requests using Audiomack OAuth 1.0a HMAC-SHA1 to retrieve signed high-bitrate master audio streams
 * - Streams uncompressed M4A / AAC directly, or transcodes on the fly to 320kbps MP3 via FFmpeg
 */

const crypto = require('crypto');
const { spawn } = require('child_process');

const CONSUMER_KEY = 'audiomack-js';
const CONSUMER_SECRET = 'f3ac5b086f3eab260520d8e3049561e6';

function isAudiomack(url) {
    if (!url) return false;
    return /audiomack\.com/i.test(url);
}

function percentEncode(str) {
    return encodeURIComponent(String(str || ''))
        .replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

function generateOAuthUrl(url, method, params, consumerKey, consumerSecret, tokenSecret = '') {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = crypto.randomBytes(16).toString('hex');

    const oauthParams = {
        ...params,
        oauth_consumer_key: consumerKey,
        oauth_nonce: nonce,
        oauth_signature_method: 'HMAC-SHA1',
        oauth_timestamp: timestamp,
        oauth_version: '1.0'
    };

    const sortedKeys = Object.keys(oauthParams).sort();
    const paramString = sortedKeys
        .map(k => `${percentEncode(k)}=${percentEncode(oauthParams[k])}`)
        .join('&');

    const baseString = [
        method.toUpperCase(),
        percentEncode(url),
        percentEncode(paramString)
    ].join('&');

    const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`;
    const signature = crypto
        .createHmac('sha1', signingKey)
        .update(baseString)
        .digest('base64');

    oauthParams.oauth_signature = signature;

    const queryString = Object.keys(oauthParams)
        .map(k => `${percentEncode(k)}=${percentEncode(oauthParams[k])}`)
        .join('&');

    return `${url}?${queryString}`;
}

function extractMetadata(html) {
    // 1. Extract music ID
    let musicId = null;
    const m1 = html.match(/\\?"music\\?":\s*\{\s*\\?"id\\?":\s*(\d+)/);
    if (m1) musicId = m1[1];
    if (!musicId) {
        const m2 = html.match(/\\?"id\\?":\s*(\d+),\s*\\?"patronage\\?":/);
        if (m2) musicId = m2[1];
    }
    if (!musicId) {
        const m3 = html.match(/\\?"musicId\\?":\s*(\d+)/i);
        if (m3) musicId = m3[1];
    }

    // 2. Extract OpenGraph and Twitter metadata
    const musicianMatch = html.match(/property="music:musician"\s+content="([^"]+)"/i) || html.match(/content="([^"]+)"\s+property="music:musician"/i);
    const durationMatch = html.match(/property="music:duration"\s+content="([^"]+)"/i) || html.match(/content="([^"]+)"\s+property="music:duration"/i);
    const imageMatch = html.match(/property="og:image"\s+content="([^"]+)"/i) || html.match(/content="([^"]+)"\s+property="og:image"/i);
    const titleMatch = html.match(/property="og:title"\s+content="([^"]+)"/i) || html.match(/content="([^"]+)"\s+property="og:title"/i);

    let artist = musicianMatch ? musicianMatch[1].trim() : 'Audiomack Artist';
    let fullTitle = titleMatch ? titleMatch[1].replace(/: Listen on Audiomack/i, '').replace(/on Audiomack/i, '').trim() : 'Audiomack Track';
    let duration = durationMatch ? parseInt(durationMatch[1], 10) : 0;
    let image = imageMatch ? imageMatch[1].trim() : '';

    return {
        id: musicId,
        artist,
        title: fullTitle,
        duration,
        image
    };
}

async function resolveTrack(pageUrl) {
    console.log(`[Audiomack] Fetching track metadata: ${pageUrl}`);
    const res = await fetch(pageUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
    });

    if (!res.ok) {
        throw new Error(`Audiomack responded with HTTP ${res.status}`);
    }

    const html = await res.text();
    const meta = extractMetadata(html);

    if (!meta.id) {
        throw new Error('Could not resolve Audiomack track identifier from page.');
    }

    // Request signed play URL via OAuth 1.0a
    const playEndpoint = `https://api.audiomack.com/v1/music/play/${meta.id}`;
    const signedUrl = generateOAuthUrl(playEndpoint, 'GET', {}, CONSUMER_KEY, CONSUMER_SECRET);

    console.log(`[Audiomack] Requesting signed playback URL for ID: ${meta.id}`);
    const playRes = await fetch(signedUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*'
        }
    });

    if (!playRes.ok) {
        throw new Error(`Audiomack Play API returned HTTP ${playRes.status}`);
    }

    const playData = await playRes.json();
    if (!playData.signedUrl) {
        throw new Error('Audiomack did not return a valid audio stream URL.');
    }

    return {
        id: meta.id,
        title: meta.title,
        artist: meta.artist,
        duration: meta.duration,
        thumbnail: meta.image,
        streamUrl: playData.signedUrl,
        format: playData.signedUrl.includes('.mp3') ? 'mp3' : 'm4a'
    };
}

function makeContentDisposition(filename) {
    const raw = String(filename || 'VidoGet Media').trim();
    const ascii = raw
        .replace(/[^\x20-\x7E]/g, '')
        .replace(/["\\;]/g, '')
        .replace(/\s+/g, ' ')
        .trim() || 'VidoGet Media';
    const encoded = encodeURIComponent(raw)
        .replace(/['()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
    return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

/**
 * Streams Audiomack audio directly or transcodes to MP3 via FFmpeg.
 */
async function streamAudiomack(trackUrl, res, options = {}) {
    const { format = 'mp3', title = 'Audiomack_Track' } = options;
    console.log(`[Audiomack] Streaming requested for format [${format}]: ${trackUrl}`);

    const track = await resolveTrack(trackUrl);
    const cleanTitle = (title || track.title).replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').trim() || 'Audiomack_Track';

    if (format === 'mp3' || format === 'audio') {
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Disposition', makeContentDisposition(`${cleanTitle}.mp3`));

        console.log(`[Audiomack] Transcoding to 160kbps MP3 via FFmpeg (compact size & high quality)...`);
        const ffmpegProc = spawn('ffmpeg', [
            '-reconnect', '1',
            '-reconnect_streamed', '1',
            '-reconnect_delay_max', '5',
            '-i', track.streamUrl,
            '-vn',
            '-c:a', 'libmp3lame',
            '-b:a', '160k',
            '-ar', '44100',
            '-ac', '2',
            '-id3v2_version', '3',
            '-metadata', `title=${cleanTitle}`,
            '-metadata', 'encoded_by=VidoGet_DAW_Master_v1.5',
            '-f', 'mp3',
            'pipe:1'
        ], { stdio: ['ignore', 'pipe', 'pipe'] });

        ffmpegProc.stdout.pipe(res);

        ffmpegProc.stderr.on('data', () => {});

        ffmpegProc.on('error', (err) => {
            console.error('[Audiomack FFmpeg] Process error:', err);
            if (!res.headersSent) res.status(500).send('Audiomack transcode error');
        });

        ffmpegProc.on('close', (code) => {
            if (code !== 0 && !res.headersSent) {
                console.error(`[Audiomack FFmpeg] Exited with code ${code}`);
                res.status(500).send('Audiomack transcode failed');
            }
        });

        res.on('close', () => {
            try { ffmpegProc.kill('SIGKILL'); } catch (e) {}
        });

    } else {
        // Zero-Egress HTTP 307 Redirect for Direct M4A Master Stream
        console.log(`[Audiomack] Issuing Zero-Egress HTTP 307 redirect directly to master stream`);
        res.setHeader('Cache-Control', 'public, max-age=3600');
        return res.redirect(307, track.streamUrl);
    }
}

module.exports = {
    isAudiomack,
    resolveTrack,
    streamAudiomack
};

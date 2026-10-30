'use strict';

/**
 * Audio Catcher Engine (Ported from Audio Catcher IDM v1.4.0)
 * 
 * Capabilities:
 * - HLS master playlist parsing & audio rendition resolution (#EXT-X-MEDIA: TYPE=AUDIO)
 * - Fragmented MP4 initialization map handling (#EXT-X-MAP) & byte-range segments (#EXT-X-BYTERANGE)
 * - Safe assembly of unencrypted HLS audio segments into unified M4A / AAC / MP3 / WebM / TS streams
 * - Detection & streaming of direct audio formats (MP3, M4A, AAC, OGG, Opus, WAV, FLAC, WebM)
 * - Site-specific playback replay headers (e.g., x-boomplay-ref for Boomplay CDN)
 * - Strict verification against encrypted / DRM streams (stops safely instead of corrupting output)
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

const DEFAULT_MAX_BYTES = 500 * 1024 * 1024; // 500MB safety limit
const MAX_PLAYLIST_DEPTH = 5;
const MAX_SEGMENTS = 4000;

const DIRECT_AUDIO_EXT = /\.(mp3|m4a|aac|ogg|oga|opus|wav|flac|weba)(?:$|[?#])/i;
const MANIFEST_EXT = /\.(m3u8|mpd)(?:$|[?#])/i;

function parseAttributes(line) {
    const idx = line.indexOf(':');
    const source = idx >= 0 ? line.slice(idx + 1) : line;
    const attrs = {};
    const re = /([A-Z0-9-]+)=("[^"]*"|[^,]*)/gi;
    let match;
    while ((match = re.exec(source))) {
        let value = String(match[2] || '').trim();
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        attrs[String(match[1]).toUpperCase()] = value;
    }
    return attrs;
}

function cleanLines(text) {
    return String(text || '')
        .replace(/^\uFEFF/, '')
        .split(/\r?\n/)
        .map(v => v.trim())
        .filter(Boolean);
}

function requestHeaders(replay = {}, range = '') {
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
    };
    if (replay.xBoomplayRef) headers['x-boomplay-ref'] = replay.xBoomplayRef;
    if (replay.referer) headers['Referer'] = replay.referer;
    if (replay.accept) headers['Accept'] = replay.accept;
    if (range) headers['Range'] = range;
    return headers;
}

async function fetchChecked(url, options = {}) {
    const { asText = false, replay = {}, range = '' } = options;
    let response;
    try {
        response = await fetch(url, {
            method: 'GET',
            cache: 'no-store',
            redirect: 'follow',
            headers: requestHeaders(replay, range)
        });
    } catch (error) {
        throw new Error(`Network error while reading stream: ${error.message || error}`);
    }

    if (!response.ok) {
        if (response.status === 401) throw new Error('Stream server returned HTTP 401 Unauthorized.');
        if (response.status === 403) throw new Error('Stream server returned HTTP 403 Forbidden. Auth or playback token required.');
        if (response.status === 416) throw new Error('Stream server rejected requested byte range (HTTP 416).');
        throw new Error(`Stream request failed with HTTP ${response.status}`);
    }

    return asText ? response.text() : response;
}

function protectionInfo(lines) {
    for (const line of lines) {
        if (line.startsWith('#EXT-X-SESSION-KEY:')) {
            const attrs = parseAttributes(line);
            return {
                source: 'session-key',
                method: String(attrs.METHOD || 'UNKNOWN').toUpperCase(),
                keyFormat: String(attrs.KEYFORMAT || '').replace(/^"|"$/g, '') || 'identity'
            };
        }
        if (line.startsWith('#EXT-X-KEY:')) {
            const attrs = parseAttributes(line);
            const method = String(attrs.METHOD || '').toUpperCase();
            if (method && method !== 'NONE') {
                return {
                    source: 'media-key',
                    method,
                    keyFormat: String(attrs.KEYFORMAT || '').replace(/^"|"$/g, '') || 'identity'
                };
            }
        }
    }
    return null;
}

function assertUnencrypted(lines) {
    const protection = protectionInfo(lines);
    if (!protection) return;
    const method = protection.method || 'encrypted';
    const keyFormat = protection.keyFormat && protection.keyFormat !== 'identity' ? ` / ${protection.keyFormat}` : '';
    throw new Error(`Protected HLS stream detected (${method}${keyFormat}). Stream cannot be decrypted without DRM keys.`);
}

function selectAudioRendition(lines, baseUrl) {
    const renditions = lines
        .filter(line => line.startsWith('#EXT-X-MEDIA:'))
        .map(line => parseAttributes(line))
        .filter(attrs => String(attrs.TYPE || '').toUpperCase() === 'AUDIO' && attrs.URI)
        .sort((a, b) => {
            const score = attrs =>
                (String(attrs.DEFAULT).toUpperCase() === 'YES' ? 4 : 0) +
                (String(attrs.AUTOSELECT).toUpperCase() === 'YES' ? 2 : 0);
            return score(b) - score(a);
        });
    return renditions[0]?.URI ? new URL(renditions[0].URI, baseUrl).href : '';
}

function selectVariant(lines, baseUrl) {
    const variants = [];
    for (let i = 0; i < lines.length; i++) {
        if (!lines[i].startsWith('#EXT-X-STREAM-INF:')) continue;
        const attrs = parseAttributes(lines[i]);
        let j = i + 1;
        while (j < lines.length && lines[j].startsWith('#')) j++;
        if (j < lines.length) {
            variants.push({
                url: new URL(lines[j], baseUrl).href,
                bandwidth: Number(attrs.BANDWIDTH || attrs['AVERAGE-BANDWIDTH'] || 0)
            });
        }
    }
    variants.sort((a, b) => b.bandwidth - a.bandwidth);
    return variants[0]?.url || '';
}

async function resolveMediaPlaylist(url, replay = {}, depth = 0) {
    if (depth > MAX_PLAYLIST_DEPTH) {
        throw new Error('HLS playlist nesting is deeper than supported.');
    }
    const text = await fetchChecked(url, { asText: true, replay });
    const lines = cleanLines(text);
    if (!lines.length || lines[0] !== '#EXTM3U') {
        throw new Error('The detected URL is not a valid HLS playlist (#EXTM3U header missing).');
    }

    assertUnencrypted(lines);

    const audioRendition = selectAudioRendition(lines, url);
    if (audioRendition) return resolveMediaPlaylist(audioRendition, replay, depth + 1);

    if (lines.some(line => line.startsWith('#EXT-X-STREAM-INF:'))) {
        const variant = selectVariant(lines, url);
        if (!variant) throw new Error('HLS master playlist has no usable media variant.');
        return resolveMediaPlaylist(variant, replay, depth + 1);
    }

    return { url, lines };
}

function parseRangeSpec(spec, url, nextOffsetByUrl) {
    const match = String(spec || '').trim().match(/^(\d+)(?:@(\d+))?$/);
    if (!match) throw new Error(`Unsupported HLS byte range: ${spec}`);
    const length = Number(match[1]);
    const explicitOffset = match[2] == null ? null : Number(match[2]);
    if (!Number.isFinite(length) || length <= 0) throw new Error('Invalid HLS byte-range length.');
    const start = explicitOffset == null ? Number(nextOffsetByUrl.get(url) || 0) : explicitOffset;
    const end = start + length - 1;
    nextOffsetByUrl.set(url, end + 1);
    return { start, end };
}

function parseMediaParts(lines, playlistUrl) {
    const nextOffsetByUrl = new Map();
    const parts = [];
    let pendingByteRange = '';
    let mapSeen = false;

    for (const line of lines) {
        if (line.startsWith('#EXT-X-MAP:')) {
            const attrs = parseAttributes(line);
            if (!attrs.URI) continue;
            const url = new URL(attrs.URI, playlistUrl).href;
            const range = attrs.BYTERANGE ? parseRangeSpec(attrs.BYTERANGE, url, nextOffsetByUrl) : null;
            parts.push({ kind: 'init', url, range });
            mapSeen = true;
            continue;
        }
        if (line.startsWith('#EXT-X-BYTERANGE:')) {
            pendingByteRange = line.slice(line.indexOf(':') + 1).trim();
            continue;
        }
        if (line.startsWith('#')) continue;

        const url = new URL(line, playlistUrl).href;
        const range = pendingByteRange ? parseRangeSpec(pendingByteRange, url, nextOffsetByUrl) : null;
        pendingByteRange = '';
        parts.push({ kind: 'media', url, range });
    }

    const segmentCount = parts.filter(p => p.kind === 'media').length;
    if (!segmentCount) throw new Error('The HLS playlist contains no media segments.');
    if (segmentCount > MAX_SEGMENTS) {
        throw new Error(`Playlist contains ${segmentCount} segments, exceeding safe limit of ${MAX_SEGMENTS}.`);
    }
    return { parts, segmentCount, mapSeen };
}

function determineOutputType(parts, firstMime, mapSeen) {
    const mediaUrls = parts.filter(p => p.kind === 'media').map(p => p.url.toLowerCase());
    const mime = String(firstMime || '').toLowerCase().split(';')[0];
    if (mapSeen || mediaUrls.some(url => /\.(m4s|mp4)(?:$|[?#])/.test(url)) || mime.includes('mp4')) {
        return { ext: 'm4a', mime: 'audio/mp4' };
    }
    if (mediaUrls.every(url => /\.aac(?:$|[?#])/.test(url)) || mime.includes('aac')) {
        return { ext: 'aac', mime: 'audio/aac' };
    }
    if (mediaUrls.every(url => /\.mp3(?:$|[?#])/.test(url)) || mime.includes('mpeg')) {
        return { ext: 'mp3', mime: 'audio/mpeg' };
    }
    if (mediaUrls.every(url => /\.webm(?:$|[?#])/.test(url)) || mime.includes('webm')) {
        return { ext: 'weba', mime: 'audio/webm' };
    }
    if (mime.includes('ogg')) {
        return { ext: 'ogg', mime: 'audio/ogg' };
    }
    return { ext: 'ts', mime: 'video/mp2t' };
}

function isHls(url) {
    return MANIFEST_EXT.test(url);
}

function isDirectAudio(url) {
    return DIRECT_AUDIO_EXT.test(url);
}

function detectDirectAudioExt(url) {
    const match = url.match(/\.([a-z0-9]{2,5})(?:$|[?#])/i);
    return match ? match[1].toLowerCase() : 'mp3';
}

/**
 * Streams assembled HLS audio directly to an Express HTTP response.
 */
async function streamHlsAudio(playlistUrl, res, options = {}) {
    const { replay = {}, filename = 'VideoVault_Audio' } = options;
    console.log(`[AudioCatcher] Resolving HLS audio playlist: ${playlistUrl}`);

    const resolved = await resolveMediaPlaylist(playlistUrl, replay);
    const { parts, segmentCount, mapSeen } = parseMediaParts(resolved.lines, resolved.url);

    console.log(`[AudioCatcher] Found ${segmentCount} audio segments (init map: ${mapSeen})`);

    // Fetch initial segment to discover mime type
    let firstMime = 'audio/mp4';
    if (parts.length > 0) {
        try {
            const probe = await fetchChecked(parts[0].url, { replay, range: parts[0].range ? `bytes=${parts[0].range.start}-${parts[0].range.end}` : '' });
            firstMime = probe.headers.get('content-type') || firstMime;
        } catch (e) {
            console.warn('[AudioCatcher] Could not probe first segment mime, falling back:', e.message);
        }
    }

    const { ext, mime } = determineOutputType(parts, firstMime, mapSeen);
    const finalFilename = filename.endsWith(`.${ext}`) ? filename : `${filename}.${ext}`;

    const asciiName = String(finalFilename || 'VidoGet Audio')
        .replace(/[^\x20-\x7E]/g, '')
        .replace(/["\\;]/g, '')
        .replace(/\s+/g, ' ')
        .trim() || 'VidoGet Audio';
    const encodedName = encodeURIComponent(String(finalFilename || 'audio'))
        .replace(/['()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());

    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`);
    res.setHeader('Transfer-Encoding', 'chunked');

    let totalBytes = 0;
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const range = part.range ? `bytes=${part.range.start}-${part.range.end}` : '';
        const response = await fetchChecked(part.url, { replay, range });
        const arrayBuf = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);
        totalBytes += buffer.length;

        if (totalBytes > DEFAULT_MAX_BYTES) {
            throw new Error(`Assembled audio exceeded ${DEFAULT_MAX_BYTES / (1024 * 1024)}MB safety threshold.`);
        }

        res.write(buffer);
    }

    res.end();
    console.log(`[AudioCatcher] Successfully streamed ${parts.length} segments (${(totalBytes / 1024 / 1024).toFixed(2)} MB) as ${finalFilename}`);
}

module.exports = {
    isHls,
    isDirectAudio,
    detectDirectAudioExt,
    resolveMediaPlaylist,
    streamHlsAudio,
    requestHeaders
};

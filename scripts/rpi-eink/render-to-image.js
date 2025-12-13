#!/usr/bin/env node
"use strict";
/**
 * render-to-image.ts
 * Server-side renderer for trainboard departure board
 * Generates PNG images without using a browser (faster on Raspberry Pi)
 *
 * Usage: node render-to-image.js <outputPath> [width] [height] [configFile]
 *
 * Performance: ~10x faster than Chromium on Raspberry Pi
 * Memory: ~50MB vs ~500MB for browser-based rendering
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderToImage = renderToImage;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const url_1 = require("url");
const canvas_1 = require("canvas");
// Import existing utilities from src
const utils_js_1 = require("../../src/lib/utils.js");
const api_js_1 = require("../../src/odpt/api.js");
// Get __dirname equivalent in ES modules
const __filename = (0, url_1.fileURLToPath)(import.meta.url);
const __dirname = path_1.default.dirname(__filename);
// Load terminus data
const terminusDataPath = path_1.default.join(__dirname, '../../src/odpt/data/terminus.json');
const terminusData = JSON.parse(fs_1.default.readFileSync(terminusDataPath, 'utf8'));
/**
 * Register custom fonts for e-ink optimized rendering
 */
function registerFonts() {
    const fontsDir = path_1.default.join(__dirname, 'fonts');
    // Try Noto Sans JP first (easier to download)
    const boldFont = path_1.default.join(fontsDir, 'NotoSansJP-ExtraBold.ttf');
    const fontFamily = 'Noto Sans JP';
    try {
        if (fs_1.default.existsSync(boldFont)) {
            (0, canvas_1.registerFont)(boldFont, { family: fontFamily, weight: 'ExtraBold' });
            console.log(`[INFO] Registered font: ${fontFamily}`);
        }
        return true;
    }
    catch (e) {
        const error = e;
        console.warn('[WARN] Failed to register fonts:', error.message);
        console.warn('[WARN] Run: node scripts/rpi-eink/fonts/setup-fonts.js');
        return false;
    }
}
/**
 * Get font name based on whether custom fonts are loaded
 */
function getFontName(useCustomFonts) {
    if (!useCustomFonts)
        return 'sans-serif';
    return 'Noto Sans JP';
}
/**
 * Get monospace font name
 */
function getMonoFontName(useCustomFonts) {
    // Even with custom fonts, use monospace for times (better alignment)
    return 'monospace';
}
/**
 * Load configuration from defaults.json
 */
function loadConfig() {
    const configPath = path_1.default.join(__dirname, '../../config.json');
    if (fs_1.default.existsSync(configPath)) {
        try {
            const content = fs_1.default.readFileSync(configPath, 'utf8');
            return JSON.parse(content);
        }
        catch (e) {
            const error = e;
            console.warn('[WARN] Failed to load config.json:', error.message);
        }
    }
    const configPath2 = path_1.default.join(__dirname, '../../defaults.json');
    if (fs_1.default.existsSync(configPath2)) {
        try {
            const content = fs_1.default.readFileSync(configPath2, 'utf8');
            return JSON.parse(content);
        }
        catch (e) {
            const error = e;
            console.warn('[WARN] Failed to load defaults.json:', error.message);
        }
    }
    return {};
}
/**
 * Get train type name and colors
 */
function getTrainTypeInfo(trainTypeUri) {
    if (!trainTypeUri)
        return { name: '普通', bgColor: '#FFFFFF', textColor: '#000000', strokeColor: '#000000' };
    const parts = trainTypeUri.split('.');
    const shortName = parts[parts.length - 1] || '';
    // Common mappings with colors
    const typeMap = {
        Local: { name: '普通', bgColor: '#FFFFFF', textColor: '#000000', strokeColor: '#000000' },
        Express: { name: '急行', bgColor: '#FF0000', textColor: '#ffffffff', strokeColor: '#ffffffff' },
        LimitedExpress: {
            name: '特急',
            bgColor: '#FFFF00',
            textColor: '#000000',
            strokeColor: '#FFFFFF',
        },
        'F-Liner': {
            name: 'F特急',
            bgColor: '#FFFF00',
            textColor: '#000000',
            strokeColor: '#FFFFFF',
        },
        Rapid: { name: '快速', bgColor: '#FFFF00', textColor: '#000000', strokeColor: '#FFFFFF' },
        SemiExpress: { name: '準急', bgColor: '#FFFF00', textColor: '#000000', strokeColor: '#FFFFFF' },
        Commuter: { name: '通勤', bgColor: '#FFFF00', textColor: '#000000', strokeColor: '#FFFFFF' },
        CommuterLimitedExpress: {
            name: '通特',
            bgColor: '#FFFF00',
            textColor: '#000000',
            strokeColor: '#FFFFFF',
        },
        CommuterExpress: {
            name: '通急',
            bgColor: '#FFFF00',
            textColor: '#000000',
            strokeColor: '#FFFFFF',
        },
    };
    return (typeMap[shortName] || {
        name: shortName || '普通',
        bgColor: '#FFFFFF',
        textColor: '#000000',
        strokeColor: '#000000',
    });
}
/**
 * Build a cache of station URIs to Japanese names
 */
async function buildStationNameCache(departures, apiKey, apiBaseUrl) {
    const cache = new Map();
    // Collect all destination URIs - using collectDestinationUris won't work directly
    // because our DepartureInfo type differs from StationTimetableEntry
    const allUris = new Set();
    for (const dep of departures) {
        const dests = dep.destination;
        if (Array.isArray(dests)) {
            for (const d of dests) {
                if (typeof d === 'string') {
                    allUris.add(d);
                }
                else if (d && d['owl:sameAs']) {
                    allUris.add(d['owl:sameAs']);
                }
            }
        }
        else if (typeof dests === 'string') {
            allUris.add(dests);
        }
    }
    const uriArray = Array.from(allUris);
    if (uriArray.length === 0)
        return cache;
    // Fetch station data
    const stations = await (0, api_js_1.fetchStationsByUris)(uriArray, apiKey, apiBaseUrl);
    // Populate cache
    for (const station of stations) {
        const uri = station['owl:sameAs'] || station['@id'];
        const name = (0, utils_js_1.getJapaneseText)(station['dc:title'] || station['odpt:stationTitle']);
        if (uri && name) {
            cache.set(uri, name);
        }
    }
    return cache;
}
/**
 * Get station name from destination array using cache
 */
function getDestinationName(destinations, stationNameCache) {
    if (!destinations || destinations.length === 0)
        return '不明';
    const dest = destinations[destinations.length - 1];
    if (typeof dest === 'string') {
        // Look up in cache first
        if (stationNameCache && stationNameCache.has(dest)) {
            return stationNameCache.get(dest);
        }
        // Fallback: Extract station name from URI like "odpt.Station:Tokyu.Toyoko.Yokohama"
        const parts = dest.split('.');
        return parts[parts.length - 1] || '不明';
    }
    return (0, utils_js_1.getJapaneseText)(dest['dc:title'] || dest['odpt:stationTitle']) || '不明';
}
/**
 * Draw the departure board to canvas
 */
function drawBoard(canvas, ctx, data, useCustomFonts = false) {
    const { width, height, stationName, railwayName, currentTime, inbound, outbound, stationNameCache, } = data;
    const fontName = getFontName(useCustomFonts);
    const monoFont = getMonoFontName(useCustomFonts);
    console.log(`[FONT] useCustomFonts=${useCustomFonts}`);
    console.log(`[FONT] fontName="${fontName}", monoFont="${monoFont}"`);
    // Background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);
    // Header
    const headerHeight = 80;
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold 32px ${fontName}`;
    ctx.fillText(stationName, 20, 45);
    ctx.font = `20px ${fontName}`;
    ctx.fillText(railwayName, 20, 70);
    // Current time (top right)
    ctx.font = `bold 36px ${monoFont}`;
    const timeWidth = ctx.measureText(currentTime).width;
    ctx.fillText(currentTime, width - timeWidth - 20, 50);
    // Divider line
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, headerHeight);
    ctx.lineTo(width, headerHeight);
    ctx.stroke();
    // White background for content area (below header)
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, headerHeight, width, height - headerHeight);
    // Two-column layout
    const columnWidth = width / 2;
    const contentY = headerHeight + 10;
    // Draw direction column
    function drawDirection(x, directionName, departures, cache) {
        ctx.fillStyle = '#000000'; // Black text on white background
        ctx.font = `bold 48px ${fontName}`;
        const titleY = contentY + 36;
        const titleText = `${directionName}行き`;
        const titleWidth = ctx.measureText(titleText).width;
        ctx.fillText(titleText, x + (columnWidth - titleWidth) / 2, titleY);
        // Draw underline (black)
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + 20, titleY + 10);
        ctx.lineTo(x + columnWidth - 20, titleY + 10);
        ctx.stroke();
        let y = titleY + 20;
        if (departures.length === 0) {
            ctx.font = `24px ${fontName}`;
            ctx.fillStyle = '#666666';
            ctx.fillText('データなし', x + 30, y + 30);
            return;
        }
        // Draw each departure (2-row layout: time on left, type+dest stacked on right)
        for (let i = 0; i < departures.length; i++) {
            const dep = departures[i];
            const rowHeight = 90; // Each departure takes 2 rows worth of space
            y += rowHeight;
            if (y > height - 20)
                break; // Don't overflow
            // Train type affect time and train type colors.
            const trainTypeInfo = getTrainTypeInfo(dep.trainType);
            // Left side: Time (large, centered vertically in 2-row space)
            const timeX = x + 20;
            const timeY = y - 10; // Center vertically in the 2-row block
            // Measure time text to get background size
            ctx.font = `bold 72px ${monoFont}`; // Much larger time
            const timeMetrics = ctx.measureText(dep.time);
            const timeWidth = timeMetrics.width + 12; // Add padding
            const timeHeight = 64;
            const timeRectX = timeX - 6;
            const timeRectY = timeY - timeHeight + 6;
            // Draw time background with train type color
            ctx.fillStyle = trainTypeInfo.bgColor;
            ctx.fillRect(timeRectX, timeRectY, timeWidth, timeHeight);
            // Draw time text
            ctx.fillStyle = trainTypeInfo.textColor;
            ctx.fillText(dep.time, timeX, timeY);
            // Right side: right-justified within the column
            const rightEdge = x + columnWidth - 20; // Right margin
            // Top row: Train type with colored background (right-justified)
            const typeY = y - 45; // Top of the 2-row block
            // Measure text to get background size
            ctx.font = `bold 28px ${fontName}`;
            const typeMetrics = ctx.measureText(trainTypeInfo.name);
            const typeWidth = typeMetrics.width + 12; // Add padding
            const typeHeight = 32;
            // Position from right edge
            const rectX = rightEdge - typeWidth;
            const rectY = typeY - typeHeight + 5;
            const typeX = rectX + 6; // Text starts after left padding
            // Draw white border (stroke)
            ctx.strokeStyle = trainTypeInfo.strokeColor;
            ctx.lineWidth = 4;
            ctx.strokeRect(rectX, rectY, typeWidth, typeHeight);
            // Draw background rectangle
            ctx.fillStyle = trainTypeInfo.bgColor;
            ctx.fillRect(rectX, rectY, typeWidth, typeHeight);
            // Draw train type text
            ctx.fillStyle = trainTypeInfo.textColor;
            ctx.fillText(trainTypeInfo.name, typeX, typeY);
            // Bottom row: Destination (right-justified)
            const dest = getDestinationName(dep.destination, cache);
            const destY = y - 5; // Bottom of the 2-row block
            ctx.fillStyle = '#000000'; // Black text on white background
            ctx.font = `bold 32px ${fontName}`;
            const destWidth = ctx.measureText(dest).width;
            const destX = rightEdge - destWidth;
            ctx.fillText(dest, destX, destY);
            if (i < departures.length - 1) {
                // Draw separator line below this departure
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(x + 20, y + 7);
                ctx.lineTo(x + columnWidth - 20, y + 7);
                ctx.stroke();
            }
        }
    }
    // Draw both directions
    drawDirection(0, inbound.name, inbound.departures, stationNameCache);
    // Vertical divider (black)
    ctx.strokeStyle = '#000000';
    ctx.beginPath();
    ctx.moveTo(columnWidth, headerHeight);
    ctx.lineTo(columnWidth, height);
    ctx.stroke();
    drawDirection(columnWidth, outbound.name, outbound.departures, stationNameCache);
}
/**
 * Convert StationTimetableEntry to DepartureInfo
 */
function convertToDepartureInfo(timetables, directionUri, nowMinutes, limit = 5) {
    const allDepartures = [];
    for (const tt of timetables) {
        // Check if this timetable matches the requested direction
        if (tt['odpt:railDirection'] !== directionUri) {
            continue;
        }
        const entries = tt['odpt:stationTimetableObject'] || [];
        for (const entry of entries) {
            const depTime = entry['odpt:departureTime'];
            if (depTime) {
                const depMinutes = (0, utils_js_1.timeToMinutes)(depTime);
                let minutesUntil = depMinutes - nowMinutes;
                if (minutesUntil < 0)
                    minutesUntil += 1440;
                allDepartures.push({
                    time: depTime,
                    minutesUntil,
                    destination: (entry['odpt:destinationStation'] || []),
                    trainType: entry['odpt:trainType'] || '',
                    trainNumber: entry['odpt:trainNumber'] || '',
                });
            }
        }
    }
    // Sort by minutes until departure and take first N
    allDepartures.sort((a, b) => a.minutesUntil - b.minutesUntil);
    return allDepartures.slice(0, limit);
}
/**
 * Main rendering function
 */
async function renderToImage(outputPath, width, height, configOverride = {}) {
    console.log(`[RENDER] Starting render to ${outputPath} (${width}x${height})`);
    // Register custom fonts if available
    const useCustomFonts = registerFonts();
    // Load configuration
    const defaultConfig = loadConfig();
    const config = { ...defaultConfig, ...configOverride };
    const apiKey = config.API_KEY || process.env.ODPT_API_KEY || null;
    const apiBaseUrl = config.API_BASE_URL || 'https://odpt-api-proxy.trainboard-odpt-proxy.workers.dev/';
    const railwayUri = config.DEFAULT_RAILWAY || 'odpt.Railway:Tokyu.Toyoko';
    const stationName = config.DEFAULT_STATION_NAME || '武蔵小杉';
    console.log(`[CONFIG] Railway: ${railwayUri}`);
    console.log(`[CONFIG] Station: ${stationName}`);
    console.log(`[CONFIG] API Base: ${apiBaseUrl}`);
    // Fetch railway data
    const railway = await (0, api_js_1.fetchRailwayByUri)(railwayUri, apiKey, apiBaseUrl);
    if (!railway) {
        throw new Error('Failed to fetch railway data');
    }
    const railwayName = (0, utils_js_1.getJapaneseText)(railway['dc:title'] || railway['odpt:railwayTitle']);
    // Note: ODPT's ascending/descending is OPPOSITE of typical inbound/outbound convention
    // Ascending (上り) goes toward terminus, Descending (下り) goes away from terminus
    // But for display, we swap them to match user expectations (same as web version)
    const inboundDirUri = railway['odpt:descendingRailDirection'];
    const outboundDirUri = railway['odpt:ascendingRailDirection'];
    // Find station in stationOrder
    const stationOrder = railway['odpt:stationOrder'] || [];
    let stationUri = null;
    for (const station of stationOrder) {
        const sName = (0, utils_js_1.getJapaneseText)(station['odpt:stationTitle']);
        if (sName.includes(stationName) || stationName.includes(sName)) {
            stationUri = station['odpt:station'] || null;
            break;
        }
    }
    if (!stationUri) {
        throw new Error(`Station "${stationName}" not found in railway ${railwayUri}. Available stations: ${stationOrder.map((s) => (0, utils_js_1.getJapaneseText)(s['odpt:stationTitle'])).join(', ')}`);
    }
    console.log(`[STATION] Found: ${stationUri}`);
    // Fetch timetables
    const timetables = await (0, api_js_1.fetchStationTimetable)(stationUri, apiKey, apiBaseUrl, railwayUri);
    // Get current time and departures
    const now = new Date();
    const currentTime = (0, utils_js_1.formatTimeHHMM)(now);
    const currentTimeMessage = `Last Updated: ${currentTime}`;
    const nowMinutes = (0, utils_js_1.timeToMinutes)(currentTime);
    const inboundDepartures = convertToDepartureInfo(timetables, inboundDirUri || '', nowMinutes);
    const outboundDepartures = convertToDepartureInfo(timetables, outboundDirUri || '', nowMinutes);
    // Build station name cache for destination display
    const allDepartures = [...inboundDepartures, ...outboundDepartures];
    const stationNameCache = await buildStationNameCache(allDepartures, apiKey, apiBaseUrl);
    // Get direction names from terminus data
    let inboundName = '上り';
    let outboundName = '下り';
    const terminus = terminusData[railwayUri];
    if (terminus) {
        inboundName = terminus.inbound;
        outboundName = terminus.outbound;
    }
    else if (inboundDirUri || outboundDirUri) {
        // Fallback to URI parsing if no terminus data
        if (inboundDirUri) {
            const parts = inboundDirUri.split('.');
            inboundName = parts[parts.length - 1] || '上り';
        }
        if (outboundDirUri) {
            const parts = outboundDirUri.split('.');
            outboundName = parts[parts.length - 1] || '下り';
        }
    }
    console.log(`[DATA] Inbound: ${inboundDepartures.length} departures`);
    console.log(`[DATA] Outbound: ${outboundDepartures.length} departures`);
    // Create canvas and draw
    const canvas = (0, canvas_1.createCanvas)(width, height);
    const ctx = canvas.getContext('2d');
    drawBoard(canvas, ctx, {
        width,
        height,
        stationName,
        railwayName,
        currentTime: currentTimeMessage,
        inbound: { name: inboundName, departures: inboundDepartures },
        outbound: { name: outboundName, departures: outboundDepartures },
        stationNameCache,
    }, useCustomFonts);
    // Save to file
    const buffer = canvas.toBuffer('image/png');
    fs_1.default.writeFileSync(outputPath, buffer);
    console.log(`[SUCCESS] Image saved to ${outputPath} (${buffer.length} bytes)`);
}
/**
 * CLI entry point
 */
async function main() {
    const outputPath = process.argv[2] || 'trainboard.png';
    const width = parseInt(process.argv[3] || '960', 10);
    const height = parseInt(process.argv[4] || '640', 10);
    const configFile = process.argv[5];
    let configOverride = {};
    if (configFile && fs_1.default.existsSync(configFile)) {
        try {
            configOverride = JSON.parse(fs_1.default.readFileSync(configFile, 'utf8'));
        }
        catch (e) {
            const error = e;
            console.warn(`[WARN] Failed to load config file ${configFile}:`, error.message);
        }
    }
    try {
        await renderToImage(outputPath, width, height, configOverride);
        process.exit(0);
    }
    catch (error) {
        const err = error;
        console.error('[ERROR]', err.message);
        if (err.stack) {
            console.error(err.stack);
        }
        process.exit(1);
    }
}
// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

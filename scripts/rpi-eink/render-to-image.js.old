#!/usr/bin/env node
/**
 * render-to-image.js
 * Server-side renderer for trainboard departure board
 * Generates PNG images without using a browser (faster on Raspberry Pi)
 *
 * Usage: node render-to-image.js <outputPath> [width] [height] [configFile]
 *
 * Performance: ~10x faster than Chromium on Raspberry Pi
 * Memory: ~50MB vs ~500MB for browser-based rendering
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Canvas library for server-side rendering
let Canvas;
try {
  Canvas = require('canvas');
} catch (e) {
  console.error('[ERROR] canvas module not found. Install it with: npm install canvas');
  process.exit(1);
}

const { createCanvas, registerFont } = Canvas;

/**
 * Register custom fonts for e-ink optimized rendering
 */
function registerFonts() {
  const fontsDir = path.join(__dirname, 'fonts');

  // Try Noto Sans JP first (easier to download)
  let boldFont = path.join(fontsDir, 'NotoSansJP-ExtraBold.ttf');
  let fontFamily = 'Noto Sans JP';

  try {
    if (fs.existsSync(boldFont)) {
      registerFont(boldFont, { family: `${fontFamily}`, weight: 'ExtraBold' });
      console.log(`[INFO] Registered font: ${fontFamily}`);
    }
    return true;
  } catch (e) {
    console.warn('[WARN] Failed to register fonts:', e.message);
    console.warn('[WARN] Run: node scripts/rpi-eink/fonts/setup-fonts.js');
    return false;
  }
}

/**
 * Get font name based on whether custom fonts are loaded
 */
function getFontName(useCustomFonts) {
  if (!useCustomFonts) return 'sans-serif';
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
  const configPath = path.join(__dirname, '../../defaults.json');
  if (fs.existsSync(configPath)) {
    try {
      const content = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(content);
    } catch (e) {
      console.warn('[WARN] Failed to load defaults.json:', e.message);
    }
  }
  return {};
}

/**
 * Make HTTP/HTTPS request
 */
function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    client
      .get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              reject(new Error(`Failed to parse JSON: ${e.message}`));
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          }
        });
      })
      .on('error', reject);
  });
}

/**
 * Get Japanese text from ODPT multilingual field
 */
function getJapaneseText(field) {
  if (!field) return '';
  if (typeof field === 'string') return field;
  if (field.ja) return field.ja;
  if (field.en) return field.en;
  return String(field);
}

/**
 * Convert time string to minutes since midnight
 */
function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Format current time as HH:MM
 */
function formatTimeHHMM(date) {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Calculate minutes until departure
 */
function getMinutesUntil(departureTime) {
  const now = new Date();
  const nowMinutes = timeToMinutes(formatTimeHHMM(now));
  const depMinutes = timeToMinutes(departureTime);

  let diff = depMinutes - nowMinutes;
  if (diff < 0) diff += 1440; // Next day

  return diff;
}

/**
 * Fetch data from ODPT API
 */
async function fetchFromAPI(endpoint, apiKey, apiBaseUrl) {
  let url = `${apiBaseUrl}${endpoint}`;

  // Add API key if provided and not using proxy mode
  if (apiKey && !apiBaseUrl.includes('proxy')) {
    const separator = url.includes('?') ? '&' : '?';
    url += `${separator}acl:consumerKey=${encodeURIComponent(apiKey)}`;
  }

  console.log(`[API] Fetching: ${endpoint}`);
  return makeRequest(url);
}

/**
 * Fetch railway metadata
 */
async function fetchRailway(railwayUri, apiKey, apiBaseUrl) {
  const railways = await fetchFromAPI(
    `odpt:Railway?owl:sameAs=${encodeURIComponent(railwayUri)}`,
    apiKey,
    apiBaseUrl,
  );
  return railways && railways.length > 0 ? railways[0] : null;
}

/**
 * Fetch station timetable
 */
async function fetchStationTimetable(stationUri, railwayUri, apiKey, apiBaseUrl) {
  const now = new Date();
  const day = now.getDay();
  const isWeekday = day >= 1 && day <= 5;
  const isSaturday = day === 6;

  let calendarType = isWeekday ? 'Weekday' : isSaturday ? 'Saturday' : 'SundayHoliday';

  const timetables = await fetchFromAPI(
    `odpt:StationTimetable?odpt:station=${encodeURIComponent(stationUri)}&odpt:railway=${encodeURIComponent(railwayUri)}&odpt:calendar=odpt.Calendar:${calendarType}`,
    apiKey,
    apiBaseUrl,
  );

  return timetables || [];
}

/**
 * Get upcoming departures for a direction
 */
function getUpcomingDepartures(timetables, directionUri, nowMinutes, limit = 5) {
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
        const depMinutes = timeToMinutes(depTime);
        let minutesUntil = depMinutes - nowMinutes;
        if (minutesUntil < 0) minutesUntil += 1440;

        allDepartures.push({
          time: depTime,
          minutesUntil,
          destination: entry['odpt:destinationStation'] || [],
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
 * Fetch station metadata by URIs
 */
async function fetchStationsByUris(stationUris, apiKey, apiBaseUrl) {
  if (!stationUris || stationUris.length === 0) return [];

  const stations = [];

  // Fetch stations individually to avoid proxy issues with bulk queries
  for (const uri of stationUris) {
    try {
      const endpoint = `odpt:Station?owl:sameAs=${encodeURIComponent(uri)}`;
      const result = await fetchFromAPI(endpoint, apiKey, apiBaseUrl);
      if (result && result.length > 0) {
        stations.push(...result);
      }
    } catch (error) {
      console.warn(`[WARN] Failed to fetch station ${uri}:`, error.message);
    }
  }

  return stations;
}

/**
 * Collect all unique destination station URIs from departures
 */
function collectDestinationUris(departures) {
  const uris = new Set();
  for (const dep of departures) {
    const dests = dep.destination;
    if (Array.isArray(dests)) {
      for (const d of dests) {
        if (typeof d === 'string') {
          uris.add(d);
        } else if (d && d['owl:sameAs']) {
          uris.add(d['owl:sameAs']);
        }
      }
    } else if (typeof dests === 'string') {
      uris.add(dests);
    }
  }
  return Array.from(uris);
}

/**
 * Build a cache of station URIs to Japanese names
 */
async function buildStationNameCache(departures, apiKey, apiBaseUrl) {
  const cache = new Map();

  // Collect all destination URIs
  const allUris = collectDestinationUris(departures);
  if (allUris.length === 0) return cache;

  // Fetch station data
  const stations = await fetchStationsByUris(allUris, apiKey, apiBaseUrl);

  // Populate cache
  for (const station of stations) {
    const uri = station['owl:sameAs'] || station['@id'];
    const name = getJapaneseText(station['dc:title'] || station['odpt:stationTitle']);
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
  if (!destinations || destinations.length === 0) return '不明';
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

  return getJapaneseText(dest['dc:title'] || dest['odpt:stationTitle']) || '不明';
}

/**
 * Get train type name
 */
function getTrainTypeName(trainTypeUri) {
  if (!trainTypeUri) return '普通';
  const parts = trainTypeUri.split('.');
  const shortName = parts[parts.length - 1] || '';

  // Common mappings
  const typeMap = {
    Local: '普通',
    Express: '急行',
    LimitedExpress: '特急',
    Rapid: '快速',
    SemiExpress: '準急',
    Commuter: '通勤',
    CommuterLimitedExpress: '通勤特急',
    CommuterExpress: '通勤急行',
  };

  return typeMap[shortName] || shortName || '普通';
}

/**
 * Draw the departure board to canvas
 */
function drawBoard(canvas, ctx, data, useCustomFonts = false) {
  const {
    width,
    height,
    stationName,
    railwayName,
    currentTime,
    inbound,
    outbound,
    stationNameCache,
  } = data;

  const fontName = getFontName(useCustomFonts);
  const monoFont = getMonoFontName(useCustomFonts);
  // Log font selection for debugging
  const fontsDir = path.join(__dirname, 'fonts');
  const notoRegular = path.join(fontsDir, 'NotoSansJP-Regular.ttf');
  const notoBold = path.join(fontsDir, 'NotoSansJP-Bold.ttf');
  const cjkRegular = path.join(fontsDir, 'NotoSansCJKjp-Regular.otf');
  const cjkBold = path.join(fontsDir, 'NotoSansCJKjp-Bold.otf');

  console.log(`[FONT] useCustomFonts=${useCustomFonts}`);
  console.log(`[FONT] fontName="${fontName}", monoFont="${monoFont}"`);

  if (useCustomFonts) {
    const regularFound = fs.existsSync(notoRegular) || fs.existsSync(cjkRegular);
    const boldFound = fs.existsSync(notoBold) || fs.existsSync(cjkBold);

    console.log(
      `[FONT] Regular file: ${
        fs.existsSync(notoRegular) ? notoRegular : fs.existsSync(cjkRegular) ? cjkRegular : '(none)'
      }`,
    );
    console.log(
      `[FONT] Bold file: ${
        fs.existsSync(notoBold) ? notoBold : fs.existsSync(cjkBold) ? cjkBold : '(none)'
      }`,
    );
    console.log(`[FONT] Files present - regular:${regularFound} bold:${boldFound}`);

    if (!regularFound || !boldFound) {
      console.warn(
        '[FONT] Custom fonts expected but missing. Rendering will use fallback system fonts.',
      );
    }
  } else {
    console.log('[FONT] Using system fallback fonts (sans-serif / monospace).');
  }

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

  // Two-column layout
  const columnWidth = width / 2;
  const contentY = headerHeight + 10;

  // Draw direction column
  function drawDirection(x, directionName, departures, stationNameCache) {
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold 30px ${fontName}`;
    const titleY = contentY + 35;
    const titleText = `${directionName}行き`;
    const titleWidth = ctx.measureText(titleText).width;
    ctx.fillText(titleText, x + (columnWidth - titleWidth) / 2, titleY);

    // Draw underline
    ctx.beginPath();
    ctx.moveTo(x + 20, titleY + 5);
    ctx.lineTo(x + columnWidth - 20, titleY + 5);
    ctx.stroke();

    let y = titleY + 30;

    if (departures.length === 0) {
      ctx.font = `24px ${fontName}`;
      ctx.fillStyle = '#666666';
      ctx.fillText('データなし', x + 30, y + 30);
      return;
    }

    // Draw each departure
    for (const dep of departures) {
      const rowHeight = 50;
      y += rowHeight;

      if (y > height - 20) break; // Don't overflow

      // Time
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `bold 44px ${monoFont}`;
      ctx.fillText(dep.time, x + 20, y);

      // Train type
      const trainType = getTrainTypeName(dep.trainType);
      ctx.font = `bold 32px ${fontName}`;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(trainType, x + 180, y);

      // Destination
      const dest = getDestinationName(dep.destination, stationNameCache);
      ctx.font = `bold 32px ${fontName}`;
      const destX = x + 260;
      if (destX + 10 < x + columnWidth - 10) {
        ctx.fillText(dest, destX, y);
      }
    }
  }

  // Draw both directions
  drawDirection(0, inbound.name, inbound.departures, stationNameCache);

  // Vertical divider
  ctx.beginPath();
  ctx.moveTo(columnWidth, headerHeight);
  ctx.lineTo(columnWidth, height);
  ctx.stroke();

  drawDirection(columnWidth, outbound.name, outbound.departures, stationNameCache);
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
  const apiBaseUrl =
    config.API_BASE_URL || 'https://odpt-api-proxy.trainboard-odpt-proxy.workers.dev/';
  const railwayUri = config.DEFAULT_RAILWAY || 'odpt.Railway:Tokyu.Toyoko';
  const stationName = config.DEFAULT_STATION_NAME || '武蔵小杉';

  console.log(`[CONFIG] Railway: ${railwayUri}`);
  console.log(`[CONFIG] Station: ${stationName}`);
  console.log(`[CONFIG] API Base: ${apiBaseUrl}`);

  // Fetch railway data
  const railway = await fetchRailway(railwayUri, apiKey, apiBaseUrl);
  if (!railway) {
    throw new Error('Failed to fetch railway data');
  }

  const railwayName = getJapaneseText(railway['dc:title'] || railway['odpt:railwayTitle']);
  const inboundDirUri = railway['odpt:ascendingRailDirection'];
  const outboundDirUri = railway['odpt:descendingRailDirection'];

  // Find station in stationOrder
  const stationOrder = railway['odpt:stationOrder'] || [];
  let stationUri = null;
  for (const station of stationOrder) {
    const sName = getJapaneseText(station['odpt:stationTitle']);
    if (sName.includes(stationName) || stationName.includes(sName)) {
      stationUri = station['odpt:station'];
      break;
    }
  }

  if (!stationUri) {
    throw new Error(
      `Station "${stationName}" not found in railway ${railwayUri}. Available stations: ${stationOrder.map((s) => getJapaneseText(s['odpt:stationTitle'])).join(', ')}`,
    );
  }

  console.log(`[STATION] Found: ${stationUri}`);

  // Fetch timetables
  const timetables = await fetchStationTimetable(stationUri, railwayUri, apiKey, apiBaseUrl);

  // Get current time and departures
  const now = new Date();
  const currentTime = formatTimeHHMM(now);
  const nowMinutes = timeToMinutes(currentTime);

  const inboundDepartures = getUpcomingDepartures(timetables, inboundDirUri, nowMinutes);
  const outboundDepartures = getUpcomingDepartures(timetables, outboundDirUri, nowMinutes);

  // Build station name cache for destination display
  const allDepartures = [...inboundDepartures, ...outboundDepartures];
  const stationNameCache = await buildStationNameCache(allDepartures, apiKey, apiBaseUrl);

  // Get direction names
  let inboundName = '上り';
  let outboundName = '下り';

  if (inboundDirUri) {
    const parts = inboundDirUri.split('.');
    inboundName = parts[parts.length - 1] || '上り';
  }
  if (outboundDirUri) {
    const parts = outboundDirUri.split('.');
    outboundName = parts[parts.length - 1] || '下り';
  }

  console.log(`[DATA] Inbound: ${inboundDepartures.length} departures`);
  console.log(`[DATA] Outbound: ${outboundDepartures.length} departures`);

  // Create canvas and draw
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  drawBoard(
    canvas,
    ctx,
    {
      width,
      height,
      stationName,
      railwayName,
      currentTime,
      inbound: { name: inboundName, departures: inboundDepartures },
      outbound: { name: outboundName, departures: outboundDepartures },
      stationNameCache,
    },
    useCustomFonts,
  );

  // Save to file
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outputPath, buffer);

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
  if (configFile && fs.existsSync(configFile)) {
    try {
      configOverride = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    } catch (e) {
      console.warn(`[WARN] Failed to load config file ${configFile}:`, e.message);
    }
  }

  try {
    await renderToImage(outputPath, width, height, configOverride);
    process.exit(0);
  } catch (error) {
    console.error('[ERROR]', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { renderToImage };

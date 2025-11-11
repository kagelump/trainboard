#!/usr/bin/env node
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

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createCanvas, registerFont } from 'canvas';
import type { Canvas as CanvasType, CanvasRenderingContext2D } from 'canvas';

// Import existing utilities from src
import {
  getJapaneseText,
  timeToMinutes,
  formatTimeHHMM,
  getUpcomingDepartures,
  collectDestinationUris,
} from '../../src/lib/utils.js';

import {
  fetchRailwayByUri,
  fetchStationTimetable,
  fetchStationsByUris,
  calendarURI,
} from '../../src/odpt/api.js';

import type {
  OdptRailway,
  OdptStationTimetable,
  StationTimetableEntry,
  OdptStation,
} from '../../src/odpt/types.js';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load terminus data
const terminusDataPath = path.join(__dirname, '../../src/odpt/data/terminus.json');
const terminusData: Record<string, { inbound: string; outbound: string }> = JSON.parse(
  fs.readFileSync(terminusDataPath, 'utf8'),
);

/**
 * Configuration interface
 */
interface Config {
  API_KEY?: string | null;
  API_BASE_URL?: string;
  DEFAULT_RAILWAY?: string;
  DEFAULT_STATION_NAME?: string;
}

/**
 * Board data interface
 */
interface BoardData {
  width: number;
  height: number;
  stationName: string;
  railwayName: string;
  currentTime: string;
  inbound: DirectionData;
  outbound: DirectionData;
  stationNameCache: Map<string, string>;
}

/**
 * Direction data interface
 */
interface DirectionData {
  name: string;
  departures: DepartureInfo[];
}

/**
 * Departure info interface
 */
interface DepartureInfo {
  time: string;
  minutesUntil: number;
  destination: string[] | Array<{ 'dc:title'?: string; 'owl:sameAs'?: string }>;
  trainType: string;
  trainNumber: string;
}

/**
 * Register custom fonts for e-ink optimized rendering
 */
function registerFonts(): boolean {
  const fontsDir = path.join(__dirname, 'fonts');

  // Try Noto Sans JP first (easier to download)
  const boldFont = path.join(fontsDir, 'NotoSansJP-ExtraBold.ttf');
  const fontFamily = 'Noto Sans JP';

  try {
    if (fs.existsSync(boldFont)) {
      registerFont(boldFont, { family: fontFamily, weight: 'ExtraBold' });
      console.log(`[INFO] Registered font: ${fontFamily}`);
    }
    return true;
  } catch (e) {
    const error = e as Error;
    console.warn('[WARN] Failed to register fonts:', error.message);
    console.warn('[WARN] Run: node scripts/rpi-eink/fonts/setup-fonts.js');
    return false;
  }
}

/**
 * Get font name based on whether custom fonts are loaded
 */
function getFontName(useCustomFonts: boolean): string {
  if (!useCustomFonts) return 'sans-serif';
  return 'Noto Sans JP';
}

/**
 * Get monospace font name
 */
function getMonoFontName(useCustomFonts: boolean): string {
  // Even with custom fonts, use monospace for times (better alignment)
  return 'monospace';
}

/**
 * Load configuration from defaults.json
 */
function loadConfig(): Config {
  const configPath = path.join(__dirname, '../../config.json');
  if (fs.existsSync(configPath)) {
    try {
      const content = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(content) as Config;
    } catch (e) {
      const error = e as Error;
      console.warn('[WARN] Failed to load config.json:', error.message);
    }
  }
  const configPath2 = path.join(__dirname, '../../defaults.json');
  if (fs.existsSync(configPath2)) {
    try {
      const content = fs.readFileSync(configPath2, 'utf8');
      return JSON.parse(content) as Config;
    } catch (e) {
      const error = e as Error;
      console.warn('[WARN] Failed to load defaults.json:', error.message);
    }
  }
  return {};
}

/**
 * Get train type name
 */
function getTrainTypeName(trainTypeUri: string): string {
  if (!trainTypeUri) return '普通';
  const parts = trainTypeUri.split('.');
  const shortName = parts[parts.length - 1] || '';

  // Common mappings
  const typeMap: Record<string, string> = {
    Local: '普通',
    Express: '急行',
    LimitedExpress: '特急',
    Rapid: '快速',
    SemiExpress: '準急',
    Commuter: '通勤',
    CommuterLimitedExpress: '通特',
    CommuterExpress: '通急',
  };

  return typeMap[shortName] || shortName || '普通';
}

/**
 * Build a cache of station URIs to Japanese names
 */
async function buildStationNameCache(
  departures: DepartureInfo[],
  apiKey: string | null,
  apiBaseUrl: string,
): Promise<Map<string, string>> {
  const cache = new Map<string, string>();

  // Collect all destination URIs - using collectDestinationUris won't work directly
  // because our DepartureInfo type differs from StationTimetableEntry
  const allUris = new Set<string>();
  for (const dep of departures) {
    const dests = dep.destination;
    if (Array.isArray(dests)) {
      for (const d of dests) {
        if (typeof d === 'string') {
          allUris.add(d);
        } else if (d && d['owl:sameAs']) {
          allUris.add(d['owl:sameAs']);
        }
      }
    } else if (typeof dests === 'string') {
      allUris.add(dests);
    }
  }

  const uriArray = Array.from(allUris);
  if (uriArray.length === 0) return cache;

  // Fetch station data
  const stations = await fetchStationsByUris(uriArray, apiKey, apiBaseUrl);

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
function getDestinationName(
  destinations: string[] | Array<{ 'dc:title'?: string; 'owl:sameAs'?: string }>,
  stationNameCache: Map<string, string>,
): string {
  if (!destinations || destinations.length === 0) return '不明';
  const dest = destinations[destinations.length - 1];

  if (typeof dest === 'string') {
    // Look up in cache first
    if (stationNameCache && stationNameCache.has(dest)) {
      return stationNameCache.get(dest)!;
    }
    // Fallback: Extract station name from URI like "odpt.Station:Tokyu.Toyoko.Yokohama"
    const parts = dest.split('.');
    return parts[parts.length - 1] || '不明';
  }

  return getJapaneseText(dest['dc:title'] || (dest as any)['odpt:stationTitle']) || '不明';
}

/**
 * Draw the departure board to canvas
 */
function drawBoard(
  canvas: CanvasType,
  ctx: CanvasRenderingContext2D,
  data: BoardData,
  useCustomFonts = false,
): void {
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

  // Two-column layout
  const columnWidth = width / 2;
  const contentY = headerHeight + 10;

  // Draw direction column
  function drawDirection(
    x: number,
    directionName: string,
    departures: DepartureInfo[],
    cache: Map<string, string>,
  ): void {
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
      const dest = getDestinationName(dep.destination, cache);
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
 * Convert StationTimetableEntry to DepartureInfo
 */
function convertToDepartureInfo(
  timetables: OdptStationTimetable[],
  directionUri: string,
  nowMinutes: number,
  limit = 5,
): DepartureInfo[] {
  const allDepartures: DepartureInfo[] = [];

  for (const tt of timetables) {
    // Check if this timetable matches the requested direction
    if ((tt as any)['odpt:railDirection'] !== directionUri) {
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
          destination: (entry['odpt:destinationStation'] || []) as any,
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
async function renderToImage(
  outputPath: string,
  width: number,
  height: number,
  configOverride: Config = {},
): Promise<void> {
  console.log(`[RENDER] Starting render to ${outputPath} (${width}x${height})`);

  // Register custom fonts if available
  const useCustomFonts = registerFonts();

  // Load configuration
  const defaultConfig = loadConfig();
  const config: Config = { ...defaultConfig, ...configOverride };

  const apiKey = config.API_KEY || process.env.ODPT_API_KEY || null;
  const apiBaseUrl =
    config.API_BASE_URL || 'https://odpt-api-proxy.trainboard-odpt-proxy.workers.dev/';
  const railwayUri = config.DEFAULT_RAILWAY || 'odpt.Railway:Tokyu.Toyoko';
  const stationName = config.DEFAULT_STATION_NAME || '武蔵小杉';

  console.log(`[CONFIG] Railway: ${railwayUri}`);
  console.log(`[CONFIG] Station: ${stationName}`);
  console.log(`[CONFIG] API Base: ${apiBaseUrl}`);

  // Fetch railway data
  const railway = await fetchRailwayByUri(railwayUri, apiKey, apiBaseUrl);
  if (!railway) {
    throw new Error('Failed to fetch railway data');
  }

  const railwayName = getJapaneseText(railway['dc:title'] || railway['odpt:railwayTitle']);
  const inboundDirUri = railway['odpt:ascendingRailDirection'];
  const outboundDirUri = railway['odpt:descendingRailDirection'];

  // Find station in stationOrder
  const stationOrder = railway['odpt:stationOrder'] || [];
  let stationUri: string | null = null;
  for (const station of stationOrder) {
    const sName = getJapaneseText(station['odpt:stationTitle']);
    if (sName.includes(stationName) || stationName.includes(sName)) {
      stationUri = station['odpt:station'] || null;
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
  const timetables = await fetchStationTimetable(stationUri, apiKey, apiBaseUrl, railwayUri);

  // Get current time and departures
  const now = new Date();
  const currentTime = `Last Updated: ${formatTimeHHMM(now)}`;
  const nowMinutes = timeToMinutes(currentTime);

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
  } else if (inboundDirUri || outboundDirUri) {
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
async function main(): Promise<void> {
  const outputPath = process.argv[2] || 'trainboard.png';
  const width = parseInt(process.argv[3] || '960', 10);
  const height = parseInt(process.argv[4] || '640', 10);
  const configFile = process.argv[5];

  let configOverride: Config = {};
  if (configFile && fs.existsSync(configFile)) {
    try {
      configOverride = JSON.parse(fs.readFileSync(configFile, 'utf8')) as Config;
    } catch (e) {
      const error = e as Error;
      console.warn(`[WARN] Failed to load config file ${configFile}:`, error.message);
    }
  }

  try {
    await renderToImage(outputPath, width, height, configOverride);
    process.exit(0);
  } catch (error) {
    const err = error as Error;
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

export { renderToImage };

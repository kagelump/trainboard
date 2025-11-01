// src/trainboard.ts
// TypeScript rewrite of trainboard.js

type StationConfig = {
  name: string;
  uri: string;
};

type TrainTypeMapEntry = {
  name: string;
  class: string;
};

type RailwayConfig = {
  uri: string;
  name: string;
  operator: string;
};

// timetable entry types are defined in src/types.ts (StationTimetableEntry)

import {
  fetchStationTimetable,
  fetchStatus,
  fetchStationsByUris,
  fetchStationsList,
  fetchRailways,
  fetchRailwayByUri,
  fetchRailDirections,
  fetchTrainTypes,
} from './api';
import type {
  OdptStation,
  OdptStationTimetable,
  StationTimetableEntry,
  OdptRailway,
  OdptRailDirection,
  OdptTrainType,
} from './types';
import {
  getJapaneseText,
  timeToMinutes,
  getUpcomingDepartures,
  collectDestinationUris,
  formatTimeHHMM,
} from './utils';
import { SimpleCache } from './cache';
import {
  setStationHeader,
  setLoadingState,
  setDirectionHeaders,
  renderDirection as uiRenderDirection,
  updateClock as uiUpdateClock,
  chooseInitialStation,
  chooseInitialRailway,
  setupStationModal as uiSetupStationModal,
  setupRailwayModal as uiSetupRailwayModal,
  setupApiKeyModal as uiSetupApiKeyModal,
  openStationModal as uiOpenStationModal,
  openApiModal as uiOpenApiModal,
  showStatus as uiShowStatus,
  clearStatus as uiClearStatus,
  startMinutesUpdater as uiStartMinutesUpdater,
  setPageTitle as uiSetPageTitle,
  STORAGE_KEY_API_KEY,
} from './ui';
import { injectTrainTypeStyles, getTrainTypeCssClass } from './trainTypeStyles';

// --- 1. CONFIGURATION AND CONSTANTS ---
let ODPT_API_KEY: string | null = null; // loaded from ./config.json at runtime
// These have sensible defaults but can be overridden via ./config.json
let API_BASE_URL = 'https://api-challenge.odpt.org/api/v4/';
let DEFAULT_RAILWAY = 'odpt.Railway:Tokyu.Toyoko';

// Polling intervals (milliseconds)
const TIMETABLE_REFRESH_INTERVAL_MS = 150_000; // 2.5 minutes
const STATUS_REFRESH_INTERVAL_MS = 300_000; // 5 minutes
const MINUTES_UPDATE_INTERVAL_MS = 15_000; // 15 seconds
const CLOCK_UPDATE_INTERVAL_MS = 1_000; // 1 second

// Dynamic values loaded from ODPT API based on selected railway
let RAILWAY_CONFIGS: RailwayConfig[] = [];
let currentRailway: OdptRailway | null = null;
let INBOUND_DIRECTION_URI: string | null = null;
let OUTBOUND_DIRECTION_URI: string | null = null;
let INBOUND_FRIENDLY_NAME_JA = '渋谷・副都心線方面'; // fallback
let OUTBOUND_FRIENDLY_NAME_JA = '横浜・元町中華街方面'; // fallback

const TRAIN_TYPE_MAP: Record<string, TrainTypeMapEntry> = {};

// Direction name cache
const directionNameCache = new Map<string, string>();

let STATION_CONFIGS: StationConfig[] = [];
let DEFAULT_STATION_NAME = '武蔵小杉 (TY11)';
let currentConfig: {
  railwayUri: string | null;
  stationUri: string | null;
  stationName: string | null;
} = {
  railwayUri: null,
  stationUri: null,
  stationName: null,
};

let timetableIntervalId: number | undefined;
let statusIntervalId: number | undefined;

// Cache for station display names keyed by station URI
const stationNameCache = new SimpleCache<string>(500);

// --- Utilities ---
// Lightweight helpers are in `src/utils.ts` (imported above)

function getTodayCalendarURI(): string {
  const day = new Date().getDay();
  if (day >= 1 && day <= 5) return 'odpt.Calendar:Weekday';
  return 'odpt.Calendar:SaturdayHoliday';
}

async function loadDirectionNames(apiKey: string, apiBaseUrl: string): Promise<void> {
  try {
    const directions = await fetchRailDirections(apiKey, apiBaseUrl);
    for (const dir of directions) {
      const uri = dir['owl:sameAs'] || dir['@id'];
      const name = getJapaneseText(dir['dc:title']);
      if (uri && typeof uri === 'string') {
        directionNameCache.set(uri, name);
      }
    }
  } catch (err) {
    console.warn('Failed to load direction names:', err);
  }
}

async function loadTrainTypes(apiKey: string, apiBaseUrl: string): Promise<void> {
  try {
    const trainTypes = await fetchTrainTypes(apiKey, apiBaseUrl);

    for (const tt of trainTypes) {
      const uri = tt['owl:sameAs'] || tt['@id'];

      // Skip entries without a valid URI
      if (!uri || typeof uri !== 'string') {
        continue;
      }

      const name = getJapaneseText(tt['dc:title']);

      // Skip entries without a name
      if (!name) {
        continue;
      }

      const cssClass = getTrainTypeCssClass(uri);
      TRAIN_TYPE_MAP[uri] = { name, class: cssClass };
    }

    console.log(`Loaded ${Object.keys(TRAIN_TYPE_MAP).length} train types`);
  } catch (err) {
    console.warn('Failed to load train types:', err);
  }
}

async function loadRailwayMetadata(
  railwayUri: string,
  apiKey: string,
  apiBaseUrl: string,
): Promise<void> {
  try {
    const railway = await fetchRailwayByUri(railwayUri, apiKey, apiBaseUrl);
    if (!railway) {
      console.warn('Railway not found:', railwayUri);
      return;
    }
    currentRailway = railway;

    // Set direction URIs from railway metadata
    INBOUND_DIRECTION_URI = railway['odpt:ascendingRailDirection'] || 'odpt.RailDirection:Inbound';
    OUTBOUND_DIRECTION_URI =
      railway['odpt:descendingRailDirection'] || 'odpt.RailDirection:Outbound';

    // Set friendly direction names
    if (INBOUND_DIRECTION_URI && directionNameCache.has(INBOUND_DIRECTION_URI)) {
      INBOUND_FRIENDLY_NAME_JA =
        directionNameCache.get(INBOUND_DIRECTION_URI) || INBOUND_FRIENDLY_NAME_JA;
    }
    if (OUTBOUND_DIRECTION_URI && directionNameCache.has(OUTBOUND_DIRECTION_URI)) {
      OUTBOUND_FRIENDLY_NAME_JA =
        directionNameCache.get(OUTBOUND_DIRECTION_URI) || OUTBOUND_FRIENDLY_NAME_JA;
    }

    // Update page title
    const railwayName = getJapaneseText(railway['dc:title'] || railway['odpt:railwayTitle']);
    uiSetPageTitle(`${railwayName} 発車案内板`);
  } catch (err) {
    console.warn('Failed to load railway metadata:', err);
  }
}

// --- UI rendering ---
function safeGetElement(id: string): HTMLElement | null {
  return document.getElementById(id);
}

/**
 * Given arrays of departures, ensure we have display names for all destination
 * station URIs. Uses the global `stationNameCache` and fetches missing stations
 * from the ODPT `odpt:Station` endpoint in one batch call where possible.
 */
async function ensureStationNamesForDepartures(
  ...departureLists: StationTimetableEntry[][]
): Promise<void> {
  if (!ODPT_API_KEY) return;
  const uris = collectDestinationUris(...departureLists);
  const missing = Array.from(uris).filter((u) => !stationNameCache.has(u));
  if (missing.length === 0) return;
  try {
    const data = await fetchStationsByUris(missing, String(ODPT_API_KEY), API_BASE_URL);
    for (const station of data) {
      const uri = station['owl:sameAs'] || station['@id'] || station['id'];
      const name = getJapaneseText(
        station['dc:title'] || station['odpt:stationTitle'] || station['title'],
      );
      if (uri && typeof uri === 'string') stationNameCache.set(uri, name);
    }
    for (const u of missing) {
      if (!stationNameCache.has(u)) stationNameCache.set(u, u);
    }
  } catch (err) {
    console.warn('Failed to fetch station names for destinations:', err);
  }
}

async function renderBoard(): Promise<void> {
  if (!ODPT_API_KEY) {
    const inbound = document.getElementById('departures-inbound');
    const outbound = document.getElementById('departures-outbound');
    if (inbound)
      inbound.innerHTML = `<p class="text-center text-red-500 text-2xl pt-8">エラー: config.json に ODPT_API_KEY を設定してください。</p>`;
    if (outbound)
      outbound.innerHTML = `<p class="text-center text-red-500 text-2xl pt-8">エラー: config.json に ODPT_API_KEY を設定してください。</p>`;
    return;
  }

  if (typeof timetableIntervalId !== 'undefined') clearInterval(timetableIntervalId);
  if (typeof statusIntervalId !== 'undefined') clearInterval(statusIntervalId);

  const stationConfig = STATION_CONFIGS.find((c) => c.uri === currentConfig.stationUri);
  if (!stationConfig || !currentConfig.railwayUri) {
    const hdr = safeGetElement('station-header');
    if (hdr) hdr.textContent = 'エラー: 駅または路線が選択されていません';
    return;
  }

  setStationHeader(stationConfig.name);
  setLoadingState();
  setDirectionHeaders(INBOUND_FRIENDLY_NAME_JA, OUTBOUND_FRIENDLY_NAME_JA);

  let allDepartures: OdptStationTimetable[] = [];
  try {
    allDepartures = await fetchStationTimetable(
      stationConfig.uri,
      String(ODPT_API_KEY),
      API_BASE_URL,
      currentConfig.railwayUri,
    );
  } catch (err) {
    console.error('Failed to fetch timetable:', err);
    uiShowStatus('API エラーが発生しました。API キーを確認してください。', 'error');
    uiOpenApiModal();
    return;
  }
  const now = new Date();
  const nowMinutes = timeToMinutes(formatTimeHHMM(now));
  // Helper: get upcoming departures for a given direction from the
  // StationTimetable response. Use find + optional chaining so we don't
  // assume the array shape is always present, and guard the departureTime
  // to be a string before converting.
  const inboundTrains = getUpcomingDepartures(
    allDepartures,
    INBOUND_DIRECTION_URI || 'odpt.RailDirection:Inbound',
    nowMinutes,
  );
  const outboundTrains = getUpcomingDepartures(
    allDepartures,
    OUTBOUND_DIRECTION_URI || 'odpt.RailDirection:Outbound',
    nowMinutes,
  );

  // Ensure we have readable station names for destinations before rendering
  await ensureStationNamesForDepartures(inboundTrains, outboundTrains);

  uiRenderDirection('inbound', inboundTrains, stationNameCache, TRAIN_TYPE_MAP);
  uiRenderDirection('outbound', outboundTrains, stationNameCache, TRAIN_TYPE_MAP);
  // Start the minutes-away updater which refreshes the "minutes" column
  // independently of API fetches. This is safe to call multiple times
  // because the UI module will clear any existing interval before starting.
  uiStartMinutesUpdater();

  try {
    if (currentConfig.railwayUri) {
      await fetchStatus(String(ODPT_API_KEY), API_BASE_URL, currentConfig.railwayUri);
      uiClearStatus();
    }
  } catch (err) {
    console.warn('Failed to fetch status:', err);
    uiShowStatus('運行情報取得でエラーが発生しました。API キーを確認してください。', 'warn');
  }

  timetableIntervalId = window.setInterval(async () => {
    let deps: OdptStationTimetable[] = [];
    try {
      deps = await fetchStationTimetable(
        stationConfig.uri,
        String(ODPT_API_KEY),
        API_BASE_URL,
        currentConfig.railwayUri!,
      );
    } catch (err) {
      console.error('Periodic timetable fetch failed:', err);
      uiShowStatus('定期更新の取得中にエラーが発生しました。API キーを確認してください。', 'warn');
      uiOpenApiModal();
      return;
    }
    const now2 = new Date();
    const nowMins = timeToMinutes(formatTimeHHMM(now2));
    const inT = getUpcomingDepartures(
      deps as OdptStationTimetable[],
      INBOUND_DIRECTION_URI || 'odpt.RailDirection:Inbound',
      nowMins,
    );
    const outT = getUpcomingDepartures(
      deps as OdptStationTimetable[],
      OUTBOUND_DIRECTION_URI || 'odpt.RailDirection:Outbound',
      nowMins,
    );
    // Refresh cached names for any new destinations, then render
    await ensureStationNamesForDepartures(inT, outT);
    uiRenderDirection('inbound', inT, stationNameCache, TRAIN_TYPE_MAP);
    uiRenderDirection('outbound', outT, stationNameCache, TRAIN_TYPE_MAP);
    // restart/update the minutes-away updater after re-render
    uiStartMinutesUpdater();
  }, TIMETABLE_REFRESH_INTERVAL_MS);

  statusIntervalId = window.setInterval(() => {
    if (currentConfig.railwayUri) {
      fetchStatus(String(ODPT_API_KEY), API_BASE_URL, currentConfig.railwayUri);
    }
  }, STATUS_REFRESH_INTERVAL_MS);

  window.setInterval(uiUpdateClock, CLOCK_UPDATE_INTERVAL_MS);
  uiUpdateClock();
}

async function loadFromLocalConfig(): Promise<void> {
  try {
    const resp = await fetch('./config.json', { cache: 'no-store' });
    if (!resp.ok) return;
    const cfg = (await resp.json()) as {
      ODPT_API_KEY?: string;
      DEFAULT_RAILWAY?: string;
      DEFAULT_STATION_NAME?: string;
      API_BASE_URL?: string;
    };
    if (cfg?.ODPT_API_KEY) ODPT_API_KEY = cfg.ODPT_API_KEY;
    if (cfg?.DEFAULT_RAILWAY) DEFAULT_RAILWAY = cfg.DEFAULT_RAILWAY;
    if (cfg?.DEFAULT_STATION_NAME) DEFAULT_STATION_NAME = cfg.DEFAULT_STATION_NAME;
    if (cfg?.API_BASE_URL) API_BASE_URL = cfg.API_BASE_URL;
  } catch (err) {
    console.warn('Failed to load ./config.json:', err);
  }
}

async function loadLocalConfig(): Promise<void> {
  await loadFromLocalConfig();
  // Allow user-supplied API key in localStorage to override config.json
  try {
    const userKey = localStorage.getItem(STORAGE_KEY_API_KEY);
    if (userKey) {
      ODPT_API_KEY = userKey;
    }
  } catch (e) {
    // ignore localStorage access errors
  }
}

async function initializeBoard(): Promise<void> {
  try {
    await loadLocalConfig();
  } catch (e) {
    console.warn('Error loading local config:', e);
  }

  // Inject dynamic CSS styles for train types
  injectTrainTypeStyles();

  if (!ODPT_API_KEY) {
    // No API key: open the API-key modal so the user can paste one.
    uiSetupApiKeyModal(ODPT_API_KEY, (newKey) => {
      if (newKey) ODPT_API_KEY = newKey;
      initializeBoard();
    });
    uiOpenApiModal();
    return;
  }

  // Load static data (directions and train types)
  await loadDirectionNames(String(ODPT_API_KEY), API_BASE_URL);
  await loadTrainTypes(String(ODPT_API_KEY), API_BASE_URL);

  // Load available railways
  try {
    const railways = await fetchRailways(String(ODPT_API_KEY), API_BASE_URL);
    RAILWAY_CONFIGS = railways
      .filter((r) => r['@type'] === 'odpt:Railway')
      .map((railway) => {
        const railwayName = getJapaneseText(railway['dc:title'] || railway['odpt:railwayTitle']);
        const operatorUri = railway['odpt:operator'] || '';
        return {
          uri: railway['owl:sameAs'] || railway['@id'] || '',
          name: railwayName,
          operator: operatorUri,
        } as RailwayConfig;
      })
      .filter((r) => r.uri && r.name)
      .sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  } catch (err) {
    console.error('Error fetching railway list:', err);
    setStationHeader('エラー: 路線リスト取得失敗');
  }

  // Choose initial railway (read from localStorage if present)
  const selectedRailway = chooseInitialRailway(RAILWAY_CONFIGS, DEFAULT_RAILWAY);
  if (selectedRailway) {
    currentConfig.railwayUri = selectedRailway.uri;
    await loadRailwayMetadata(selectedRailway.uri, String(ODPT_API_KEY), API_BASE_URL);
  }

  // Setup railway selection modal
  uiSetupRailwayModal(RAILWAY_CONFIGS, currentConfig.railwayUri, async (newUri) => {
    currentConfig.railwayUri = newUri;
    await loadRailwayMetadata(newUri, String(ODPT_API_KEY), API_BASE_URL);
    // Reload stations for the new railway
    await loadStationsForRailway(newUri);
    // Reset station selection
    const selected = chooseInitialStation(STATION_CONFIGS, DEFAULT_STATION_NAME);
    if (selected)
      currentConfig = { ...currentConfig, stationUri: selected.uri, stationName: selected.name };
    // Update station modal with new stations
    uiSetupStationModal(STATION_CONFIGS, currentConfig.stationUri, (newStationUri) => {
      const found = STATION_CONFIGS.find((c) => c.uri === newStationUri);
      currentConfig = {
        ...currentConfig,
        stationUri: newStationUri,
        stationName: found ? found.name : null,
      };
      renderBoard();
    });
    renderBoard();
  });

  // Load stations for the selected railway
  if (currentConfig.railwayUri) {
    await loadStationsForRailway(currentConfig.railwayUri);
  }

  // choose initial station (read from localStorage if present)
  const selected = chooseInitialStation(STATION_CONFIGS, DEFAULT_STATION_NAME);
  if (selected)
    currentConfig = { ...currentConfig, stationUri: selected.uri, stationName: selected.name };

  // wire modal UI; onSave will update currentConfig and optionally replace the API key
  // setup the API key modal so users can change the key at any time
  uiSetupApiKeyModal(ODPT_API_KEY, (newKey) => {
    if (newKey) ODPT_API_KEY = newKey;
    // restart initialization now that we have an API key
    initializeBoard();
  });

  // setup the station-selection modal
  uiSetupStationModal(STATION_CONFIGS, currentConfig.stationUri, (newUri) => {
    const found = STATION_CONFIGS.find((c) => c.uri === newUri);
    currentConfig = {
      ...currentConfig,
      stationUri: newUri,
      stationName: found ? found.name : null,
    };
    renderBoard();
  });

  renderBoard();
}

async function loadStationsForRailway(railwayUri: string): Promise<void> {
  try {
    const data = await fetchStationsList(String(ODPT_API_KEY), API_BASE_URL, railwayUri);
    STATION_CONFIGS = data
      .map((station) => {
        const stationNameJa = getJapaneseText(station['dc:title'] || station['odpt:stationTitle']);
        const stationCode = station['odpt:stationCode'] || '';
        return {
          name: stationCode ? `${stationNameJa} (${stationCode})` : stationNameJa,
          uri: station['owl:sameAs'] || '',
        } as StationConfig;
      })
      .filter((s) => s.uri)
      .sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  } catch (err) {
    console.error('Error fetching station list:', err);
    setStationHeader('エラー: 駅リスト取得失敗');
  }
}

// Expose to window for bootstrapping
(window as any).initializeBoard = initializeBoard;
window.onload = initializeBoard;

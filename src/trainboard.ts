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

// timetable entry types are defined in src/types.ts (StationTimetableEntry)

import { fetchStationTimetable, fetchStatus, fetchStationsByUris, fetchStationsList } from './api';
import type { OdptStation, OdptStationTimetable, StationTimetableEntry } from './types';
import {
  getJapaneseText,
  timeToMinutes,
  getUpcomingDepartures,
  collectDestinationUris,
} from './utils';
import { SimpleCache } from './cache';
import {
  setStationHeader,
  setLoadingState,
  setDirectionHeaders,
  renderDirection as uiRenderDirection,
  updateClock as uiUpdateClock,
  chooseInitialStation,
  setupStationModal as uiSetupStationModal,
  setupApiKeyModal as uiSetupApiKeyModal,
  openStationModal as uiOpenStationModal,
  openApiModal as uiOpenApiModal,
  showStatus as uiShowStatus,
  clearStatus as uiClearStatus,
} from './ui';

// --- 1. CONFIGURATION AND CONSTANTS ---
let ODPT_API_KEY: string | null = null; // loaded from ./config.json at runtime
// These have sensible defaults but can be overridden via ./config.json
let API_BASE_URL = 'https://api-challenge.odpt.org/api/v4/';
const TOKYU_TOYOKO_LINE_URI = 'odpt.Railway:Tokyu.Toyoko';
const INBOUND_DIRECTION_URI = 'odpt.RailDirection:Inbound';
const OUTBOUND_DIRECTION_URI = 'odpt.RailDirection:Outbound';
const INBOUND_FRIENDLY_NAME_JA = '渋谷・副都心線方面';
const OUTBOUND_FRIENDLY_NAME_JA = '横浜・元町中華街方面';

const TRAIN_TYPE_MAP: Record<string, TrainTypeMapEntry> = {
  'odpt.TrainType:Tokyu.Local': { name: '各停', class: 'type-LOC' },
  'odpt.TrainType:Tokyu.Express': { name: '急行', class: 'type-EXP' },
  'odpt.TrainType:Tokyu.CommuterExpress': { name: '通勤急行', class: 'type-CEXP' },
  'odpt.TrainType:Tokyu.LimitedExpress': { name: '特急', class: 'type-LE' },
  'odpt.TrainType:Tokyu.CommuterLimitedExpress': { name: '通勤特急', class: 'type-CLE' },
  'odpt.TrainType:Local': { name: '各停', class: 'type-LOC' },
  'odpt.TrainType:Express': { name: '急行', class: 'type-EXP' },
  'odpt.TrainType:LimitedExpress': { name: '特急', class: 'type-LE' },
};

let STATION_CONFIGS: StationConfig[] = [];
let DEFAULT_STATION_NAME = '武蔵小杉 (TY11)';
let currentConfig: { stationUri: string | null; stationName: string | null } = {
  stationUri: null,
  stationName: null,
};

let timetableIntervalId: number | undefined;
let statusIntervalId: number | undefined;

// Cache for station display names keyed by station URI
const stationNameCache = new SimpleCache<string>(500);
// Ensure settings button always opens the modal (fallback if setupModal
// hasn't yet been called because station list is still loading).
function attachSettingsButtonFallback(): void {
  const btn = document.getElementById('settings-button');
  if (!btn) return;
  btn.addEventListener('click', () => {
    try {
      // pre-fill API key input if available
      const apiKeyInput = document.getElementById('api-key-input') as HTMLInputElement | null;
      const stored = (() => {
        try {
          return localStorage.getItem('t2board_api_key');
        } catch (e) {
          return null;
        }
      })();
      if (apiKeyInput) apiKeyInput.value = ODPT_API_KEY || stored || '';
    } catch (e) {
      // ignore DOM/localStorage errors
    }
    uiOpenStationModal();
  });
}

// attach fallback immediately so UI responds even while fetching station list
attachSettingsButtonFallback();

// --- Utilities ---
// Lightweight helpers are in `src/utils.ts` (imported above)

function getTodayCalendarURI(): string {
  const day = new Date().getDay();
  if (day >= 1 && day <= 5) return 'odpt.Calendar:Weekday';
  return 'odpt.Calendar:SaturdayHoliday';
}

// --- Data fetching ---
async function fetchRailwayStations(): Promise<void> {
  // deprecated: implementation moved to src/api.ts; call fetchStationsList in initializeBoard
}

// fetchStationTimetable implementation moved to src/api.ts

// fetchStatus implementation moved to src/api.ts

// --- UI rendering ---
function safeGetElement(id: string): HTMLElement | null {
  return document.getElementById(id);
}

// getUpcomingDepartures is provided by src/utils.ts

/**
 * Collect destination station URIs from one or more TimetableObject arrays.
 * Returns a Set of URIs (strings). Handles destination entries that are
 * either plain URIs (string) or objects containing `owl:sameAs`.
 */
// collectDestinationUris is provided by src/utils.ts

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
  if (!stationConfig) {
    const hdr = safeGetElement('station-header');
    if (hdr) hdr.textContent = 'エラー: 駅が選択されていません';
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
    );
  } catch (err) {
    console.error('Failed to fetch timetable:', err);
    uiShowStatus('API エラーが発生しました。API キーを確認してください。', 'error');
    uiOpenApiModal();
    return;
  }
  const now = new Date();
  const nowMinutes = timeToMinutes(
    `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
  );
  // Helper: get upcoming departures for a given direction from the
  // StationTimetable response. Use find + optional chaining so we don't
  // assume the array shape is always present, and guard the departureTime
  // to be a string before converting.
  const inboundTrains = getUpcomingDepartures(allDepartures, INBOUND_DIRECTION_URI, nowMinutes);
  const outboundTrains = getUpcomingDepartures(allDepartures, OUTBOUND_DIRECTION_URI, nowMinutes);

  // Ensure we have readable station names for destinations before rendering
  await ensureStationNamesForDepartures(inboundTrains, outboundTrains);

  uiRenderDirection('inbound', inboundTrains, stationNameCache, TRAIN_TYPE_MAP);
  uiRenderDirection('outbound', outboundTrains, stationNameCache, TRAIN_TYPE_MAP);
  try {
    await fetchStatus(String(ODPT_API_KEY), API_BASE_URL);
    uiClearStatus();
  } catch (err) {
    console.warn('Failed to fetch status:', err);
    uiShowStatus('運行情報取得でエラーが発生しました。API キーを確認してください。', 'warn');
  }

  timetableIntervalId = window.setInterval(async () => {
    let deps: OdptStationTimetable[] = [];
    try {
      deps = await fetchStationTimetable(stationConfig.uri, String(ODPT_API_KEY), API_BASE_URL);
    } catch (err) {
      console.error('Periodic timetable fetch failed:', err);
      uiShowStatus('定期更新の取得中にエラーが発生しました。API キーを確認してください。', 'warn');
      uiOpenApiModal();
      return;
    }
    const now2 = new Date();
    const nowMins = timeToMinutes(
      `${String(now2.getHours()).padStart(2, '0')}:${String(now2.getMinutes()).padStart(2, '0')}`,
    );
    const inT = getUpcomingDepartures(
      deps as OdptStationTimetable[],
      INBOUND_DIRECTION_URI,
      nowMins,
    );
    const outT = getUpcomingDepartures(
      deps as OdptStationTimetable[],
      OUTBOUND_DIRECTION_URI,
      nowMins,
    );
    // Refresh cached names for any new destinations, then render
    await ensureStationNamesForDepartures(inT, outT);
    uiRenderDirection('inbound', inT, stationNameCache, TRAIN_TYPE_MAP);
    uiRenderDirection('outbound', outT, stationNameCache, TRAIN_TYPE_MAP);
  }, 150_000);

  statusIntervalId = window.setInterval(
    () => fetchStatus(String(ODPT_API_KEY), API_BASE_URL),
    300_000,
  );

  window.setInterval(uiUpdateClock, 1000);
  uiUpdateClock();
}

async function loadLocalConfig(): Promise<void> {
  try {
    const resp = await fetch('./config.json', { cache: 'no-store' });
    if (!resp.ok) return;
    const cfg = (await resp.json()) as {
      ODPT_API_KEY?: string;
      DEFAULT_STATION_NAME?: string;
      API_BASE_URL?: string;
    };
    if (cfg?.ODPT_API_KEY) ODPT_API_KEY = cfg.ODPT_API_KEY;
    if (cfg?.DEFAULT_STATION_NAME) DEFAULT_STATION_NAME = cfg.DEFAULT_STATION_NAME;
    if (cfg?.API_BASE_URL) API_BASE_URL = cfg.API_BASE_URL;
  } catch (err) {
    console.warn('Failed to load ./config.json:', err);
  }
  // Allow user-supplied API key in localStorage to override config.json
  try {
    const userKey = localStorage.getItem('t2board_api_key');
    if (userKey) {
      ODPT_API_KEY = userKey;
    }
  } catch (e) {
    // ignore localStorage access errors
  }
}

async function initializeBoard(): Promise<void> {
  await loadLocalConfig();
  if (!ODPT_API_KEY) {
    // No API key: open the API-key modal so the user can paste one.
    uiSetupApiKeyModal(ODPT_API_KEY, (newKey) => {
      if (newKey) ODPT_API_KEY = newKey;
      initializeBoard();
    });
    uiOpenApiModal();
    return;
  }

  try {
    const data = await fetchStationsList(String(ODPT_API_KEY), API_BASE_URL, TOKYU_TOYOKO_LINE_URI);
    STATION_CONFIGS = data
      .map((station) => {
        const stationNameJa = station['dc:title'] as string;
        const stationCode = station['odpt:stationCode'] || '';
        return {
          name: `${stationNameJa} (${stationCode})`,
          uri: station['owl:sameAs'],
        } as StationConfig;
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  } catch (err) {
    console.error('Error fetching station list:', err);
    setStationHeader('エラー: 駅リスト取得失敗');
  }
  // choose initial station (read from localStorage if present)
  const selected = chooseInitialStation(STATION_CONFIGS, DEFAULT_STATION_NAME);
  if (selected) currentConfig = { stationUri: selected.uri, stationName: selected.name };

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
    currentConfig = { stationUri: newUri, stationName: found ? found.name : null };
    renderBoard();
  });

  renderBoard();
}

// Expose to window for bootstrapping
(window as any).initializeBoard = initializeBoard;
window.onload = initializeBoard;

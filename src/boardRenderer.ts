// src/boardRenderer.ts
// Board rendering and refresh logic

import { fetchStationTimetable, fetchStatus } from './api';
import type { OdptStationTimetable } from './types';
import { timeToMinutes, formatTimeHHMM, safeGetElement } from './utils';
import { getUpcomingDepartures } from './utils';
import {
  setStationHeader,
  setLoadingState,
  setDirectionHeaders,
  renderDirection as uiRenderDirection,
  updateClock as uiUpdateClock,
  showStatus as uiShowStatus,
  clearStatus as uiClearStatus,
  startMinutesUpdater as uiStartMinutesUpdater,
  openApiModal as uiOpenApiModal,
  STORAGE_KEY_RAILWAY_URI,
  STORAGE_KEY_STATION_URI,
} from './ui';
import {
  type StationConfig,
  TRAIN_TYPE_MAP,
  stationNameCache,
  getInboundDirectionUri,
  getOutboundDirectionUri,
  getInboundFriendlyName,
  getOutboundFriendlyName,
  getStationConfigs,
  ensureStationNamesForDepartures,
} from './dataLoaders';
import {
  getApiKey,
  getApiBaseUrl,
  TIMETABLE_REFRESH_INTERVAL_MS,
  STATUS_REFRESH_INTERVAL_MS,
  CLOCK_UPDATE_INTERVAL_MS,
} from './config';

// --- State ---
export let currentConfig: {
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

// --- Getters/Setters ---
export function getCurrentConfig() {
  return currentConfig;
}

export function setCurrentConfig(config: typeof currentConfig): void {
  currentConfig = config;
}

/**
 * Validates that all prerequisites for rendering the board are met.
 * @returns StationConfig if valid, null otherwise (with error UI shown)
 */
function validateBoardPrerequisites(): StationConfig | null {
  const apiKey = getApiKey();

  if (!apiKey) {
    const inbound = document.getElementById('departures-inbound');
    const outbound = document.getElementById('departures-outbound');
    const errorMsg = `<p class="text-center text-red-500 text-2xl pt-8">エラー: config.json に ODPT_API_KEY を設定してください。</p>`;
    if (inbound) inbound.innerHTML = errorMsg;
    if (outbound) outbound.innerHTML = errorMsg;
    return null;
  }

  const stationConfigs = getStationConfigs();
  const stationConfig = stationConfigs.find((c) => c.uri === currentConfig.stationUri);
  if (!stationConfig || !currentConfig.railwayUri) {
    const hdr = safeGetElement('station-header');
    if (hdr) hdr.textContent = 'エラー: 駅または路線が選択されていません';
    return null;
  }

  return stationConfig;
}

/**
 * Fetches timetable data and renders it to the UI.
 * @param stationUri The station URI to fetch timetable for
 * @returns true if successful, false if error occurred
 */
async function fetchAndRenderTimetableData(stationUri: string): Promise<boolean> {
  const apiKey = getApiKey();
  if (!apiKey) return false;

  let allDepartures: OdptStationTimetable[] = [];
  try {
    allDepartures = await fetchStationTimetable(
      stationUri,
      apiKey,
      getApiBaseUrl(),
      currentConfig.railwayUri!,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Failed to fetch timetable:', message);
    uiShowStatus('API エラーが発生しました。API キーを確認してください。', 'error');
    uiOpenApiModal();
    return false;
  }

  const now = new Date();
  const nowMinutes = timeToMinutes(formatTimeHHMM(now));

  const inboundTrains = getUpcomingDepartures(allDepartures, getInboundDirectionUri(), nowMinutes);
  const outboundTrains = getUpcomingDepartures(
    allDepartures,
    getOutboundDirectionUri(),
    nowMinutes,
  );

  // Ensure we have readable station names for destinations before rendering
  await ensureStationNamesForDepartures(apiKey, getApiBaseUrl(), inboundTrains, outboundTrains);

  uiRenderDirection('inbound', inboundTrains, stationNameCache, TRAIN_TYPE_MAP);
  uiRenderDirection('outbound', outboundTrains, stationNameCache, TRAIN_TYPE_MAP);
  uiStartMinutesUpdater();

  return true;
}

/**
 * Fetches and displays railway operation status.
 */
async function updateRailwayStatus(): Promise<void> {
  const apiKey = getApiKey();
  if (!apiKey) return;

  try {
    if (currentConfig.railwayUri) {
      await fetchStatus(apiKey, getApiBaseUrl(), currentConfig.railwayUri);
      uiClearStatus();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('Failed to fetch status:', message);
    uiShowStatus('運行情報取得でエラーが発生しました。API キーを確認してください。', 'warn');
  }
}

/**
 * Sets up periodic refresh intervals for timetable and status updates.
 * @param stationUri The station URI to refresh timetable for
 */
function setupPeriodicRefreshIntervals(stationUri: string): void {
  // Clear existing intervals
  if (typeof timetableIntervalId !== 'undefined') clearInterval(timetableIntervalId);
  if (typeof statusIntervalId !== 'undefined') clearInterval(statusIntervalId);

  // Timetable refresh interval - always read the current station URI from config
  timetableIntervalId = window.setInterval(async () => {
    // Reload from localStorage to get the latest station URI
    try {
      const savedStationUri = localStorage.getItem(STORAGE_KEY_STATION_URI);
      if (savedStationUri) {
        await fetchAndRenderTimetableData(savedStationUri);
      } else {
        await fetchAndRenderTimetableData(currentConfig.stationUri!);
      }
    } catch (error) {
      // Fallback to in-memory config if localStorage fails
      if (currentConfig.stationUri) {
        await fetchAndRenderTimetableData(currentConfig.stationUri);
      }
    }
  }, TIMETABLE_REFRESH_INTERVAL_MS);

  // Status refresh interval - always read the current railway URI from config
  statusIntervalId = window.setInterval(async () => {
    const apiKey = getApiKey();
    if (!apiKey) return;

    // Reload from localStorage to get the latest railway URI
    try {
      const savedRailwayUri = localStorage.getItem(STORAGE_KEY_RAILWAY_URI);
      const railwayUri = savedRailwayUri || currentConfig.railwayUri;
      if (railwayUri) {
        await fetchStatus(apiKey, getApiBaseUrl(), railwayUri);
      }
    } catch (error) {
      // Fallback to in-memory config if localStorage fails
      if (currentConfig.railwayUri) {
        await fetchStatus(apiKey, getApiBaseUrl(), currentConfig.railwayUri);
      }
    }
  }, STATUS_REFRESH_INTERVAL_MS);

  // Clock update interval
  window.setInterval(uiUpdateClock, CLOCK_UPDATE_INTERVAL_MS);
  uiUpdateClock();
}

/**
 * Main board rendering orchestrator.
 * Validates prerequisites, fetches data, renders UI, and sets up periodic updates.
 */
export async function renderBoard(): Promise<void> {
  // Step 0: Reload current railway and station from localStorage to ensure we have fresh data
  try {
    const savedRailwayUri = localStorage.getItem(STORAGE_KEY_RAILWAY_URI);
    const savedStationUri = localStorage.getItem(STORAGE_KEY_STATION_URI);
    if (savedRailwayUri) {
      currentConfig.railwayUri = savedRailwayUri;
    }
    if (savedStationUri) {
      currentConfig.stationUri = savedStationUri;
      // Update station name from the configs
      const stationConfigs = getStationConfigs();
      const found = stationConfigs.find((c) => c.uri === savedStationUri);
      if (found) {
        currentConfig.stationName = found.name;
      }
    }
  } catch (error) {
    // localStorage might not be available
    console.warn('Failed to load config from localStorage:', error);
  }

  // Step 1: Validate prerequisites
  const stationConfig = validateBoardPrerequisites();
  if (!stationConfig) return;

  // Step 2: Set initial UI state
  setStationHeader(stationConfig.name);
  setLoadingState();
  setDirectionHeaders(getInboundFriendlyName(), getOutboundFriendlyName());

  // Step 3: Fetch and render initial timetable data
  const success = await fetchAndRenderTimetableData(stationConfig.uri);
  if (!success) return;

  // Step 4: Update railway operation status
  await updateRailwayStatus();

  // Step 5: Set up periodic refresh intervals
  setupPeriodicRefreshIntervals(stationConfig.uri);
}

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
import { getApiKey, getApiBaseUrl } from './config';
import { visibilityManager } from './visibilityManager';
import { tickManager, TickType, type TickEvent } from './tickManager';

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

let majorTickCallback: ((event: TickEvent) => void) | null = null;
let minorTickCallback: ((event: TickEvent) => void) | null = null;
let visibilityCallback: ((isVisible: boolean) => void) | null = null;

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

  let allDepartures: OdptStationTimetable[] = [];
  try {
    allDepartures = await fetchStationTimetable(
      stationUri,
      apiKey,
      getApiBaseUrl(),
      currentConfig.railwayUri!,
    );
  } catch (error) {
    console.error('Failed to fetch timetable:', error);
    // If we're using a proxy and intentionally have no API key, don't prompt
    // the user to enter a key (the proxy is expected to handle requests).
    const apiKey = getApiKey();
    const apiBaseUrl = getApiBaseUrl();
    const needsKeyMessage =
      apiKey === null && apiBaseUrl.includes('proxy') ? '' : ' API キーを確認してください。';
    uiShowStatus(`API エラーが発生しました。${needsKeyMessage}`.trim(), 'error');
    // Open the API-key modal unless we're in proxy mode with no key
    if (!(apiKey === null && apiBaseUrl.includes('proxy'))) {
      uiOpenApiModal();
    }
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

  // Pass the full departures lists to the UI; the DeparturesList component
  // will handle display limit, caching, and replacements itself.
  uiRenderDirection('inbound', inboundTrains, stationNameCache, TRAIN_TYPE_MAP, {
    autoUpdate: true,
  });
  uiRenderDirection('outbound', outboundTrains, stationNameCache, TRAIN_TYPE_MAP, {
    autoUpdate: true,
  });

  return true;
}

/**
 * Fetches and displays railway operation status.
 */
async function updateRailwayStatus(): Promise<void> {
  const apiKey = getApiKey();

  try {
    if (currentConfig.railwayUri) {
      await fetchStatus(apiKey, getApiBaseUrl(), currentConfig.railwayUri);
      uiClearStatus();
    }
  } catch (error) {
    console.warn('Failed to fetch status:', error);
    // If we're using a proxy and intentionally have no API key, don't prompt
    // the user to enter a key (the proxy is expected to handle requests).
    const apiKey = getApiKey();
    const apiBaseUrl = getApiBaseUrl();
    const needsKeyMessage =
      apiKey === null && apiBaseUrl.includes('proxy') ? '' : ' API キーを確認してください。';
    uiShowStatus(`運行情報取得でエラーが発生しました。${needsKeyMessage}`.trim(), 'warn');
  }
}

/**
 * Sets up tick callbacks for timetable and status updates.
 * @param stationUri The station URI to refresh timetable for
 */
function setupTickCallbacks(stationUri: string): void {
  // Remove old callbacks if they exist
  if (majorTickCallback) {
    tickManager.offMajorTick(majorTickCallback);
    majorTickCallback = null;
  }
  if (minorTickCallback) {
    tickManager.offMinorTick(minorTickCallback);
    minorTickCallback = null;
  }

  // Register major tick callback for API refreshes (timetable and status)
  majorTickCallback = async () => {
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

    // Update railway status
    const apiKey = getApiKey();
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
  };
  tickManager.onMajorTick(majorTickCallback);

  // Register minor tick callback for clock updates
  minorTickCallback = () => {
    uiUpdateClock();
  };
  tickManager.onMinorTick(minorTickCallback);

  // Update clock immediately
  uiUpdateClock();
}

/**
 * Pauses the tick manager to save CPU when page is hidden.
 */
function pauseTicks(): void {
  console.info('Pausing ticks (page hidden)');
  tickManager.stop();
}

/**
 * Resumes the tick manager when page becomes visible.
 * @param stationUri The station URI to refresh timetable for
 */
function resumeTicks(stationUri: string): void {
  console.info('Resuming ticks (page visible)');
  // Update the UI clock immediately so the display is correct as soon as
  // the page becomes visible or ticks are resumed.
  uiUpdateClock();

  tickManager.start();

  // Immediately fetch fresh data when resuming
  fetchAndRenderTimetableData(stationUri).catch(console.error);
  updateRailwayStatus().catch(console.error);
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

  // Step 4: Update railway operation status (Banner)
  await updateRailwayStatus();

  // Step 5: Set up tick callbacks for periodic updates
  setupTickCallbacks(stationConfig.uri);

  // Step 6: Start the tick manager
  tickManager.start();

  // Step 7: Initialize visibility manager to pause/resume when tab is hidden/visible
  visibilityManager.initialize();

  // Remove old visibility callback if it exists to prevent accumulation
  if (visibilityCallback) {
    visibilityManager.offVisibilityChange(visibilityCallback);
  }

  // Register new visibility callback
  visibilityCallback = (isVisible: boolean) => {
    if (isVisible) {
      resumeTicks(stationConfig.uri);
    } else {
      pauseTicks();
    }
  };
  visibilityManager.onVisibilityChange(visibilityCallback);
}

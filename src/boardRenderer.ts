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
import {
  getApiKey,
  getApiBaseUrl,
  TIMETABLE_REFRESH_INTERVAL_MS,
  STATUS_REFRESH_INTERVAL_MS,
  CLOCK_UPDATE_INTERVAL_MS,
} from './config';
import { visibilityManager } from './visibilityManager';

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
let clockIntervalId: number | undefined;
let isPaused = false;

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

  // Show the first N trains in each direction and provide the remaining trains as a cache
  const inboundInitial = inboundTrains.slice(0, 5);
  const outboundInitial = outboundTrains.slice(0, 5);
  const inboundCache = inboundTrains.slice(5);
  const outboundCache = outboundTrains.slice(5);

  uiRenderDirection('inbound', inboundInitial, stationNameCache, TRAIN_TYPE_MAP, {
    trainCache: inboundCache,
    autoUpdate: true,
  });
  uiRenderDirection('outbound', outboundInitial, stationNameCache, TRAIN_TYPE_MAP, {
    trainCache: outboundCache,
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
  clockIntervalId = window.setInterval(uiUpdateClock, CLOCK_UPDATE_INTERVAL_MS);
  uiUpdateClock();
}

/**
 * Pauses all periodic refresh intervals to save CPU when page is hidden.
 */
function pausePeriodicRefreshIntervals(): void {
  if (isPaused) return;
  
  console.info('Pausing periodic refresh intervals (page hidden)');
  
  if (typeof timetableIntervalId !== 'undefined') {
    clearInterval(timetableIntervalId);
    timetableIntervalId = undefined;
  }
  if (typeof statusIntervalId !== 'undefined') {
    clearInterval(statusIntervalId);
    statusIntervalId = undefined;
  }
  if (typeof clockIntervalId !== 'undefined') {
    clearInterval(clockIntervalId);
    clockIntervalId = undefined;
  }
  
  isPaused = true;
}

/**
 * Resumes all periodic refresh intervals when page becomes visible.
 * @param stationUri The station URI to refresh timetable for
 */
function resumePeriodicRefreshIntervals(stationUri: string): void {
  if (!isPaused) return;
  
  console.info('Resuming periodic refresh intervals (page visible)');
  isPaused = false;
  
  // Re-establish the intervals by calling the setup function
  setupPeriodicRefreshIntervals(stationUri);
  
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

  // Step 4: Update railway operation status
  await updateRailwayStatus();

  // Step 5: Set up periodic refresh intervals
  setupPeriodicRefreshIntervals(stationConfig.uri);
  
  // Step 6: Initialize visibility manager to pause/resume when tab is hidden/visible
  visibilityManager.initialize();
  visibilityManager.onVisibilityChange((isVisible) => {
    if (isVisible) {
      resumePeriodicRefreshIntervals(stationConfig.uri);
    } else {
      pausePeriodicRefreshIntervals();
    }
  });
}

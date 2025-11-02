// src/trainboard.ts
// Main entry point and orchestrator for the trainboard application

import { fetchRailways } from './api';
import type { OdptRailway } from './types';
import { getJapaneseText, safeGetElement } from './utils';
import {
  chooseInitialStation,
  chooseInitialRailway,
  setupSettingsModal as uiSetupSettingsModal,
  setupApiKeyModal as uiSetupApiKeyModal,
  openApiModal as uiOpenApiModal,
  setupLocationModal as uiSetupLocationModal,
  STORAGE_KEY_RAILWAY_URI,
  STORAGE_KEY_STATION_URI,
} from './ui';
import { injectTrainTypeStyles } from './trainTypeStyles';
import {
  loadLocalConfig,
  getApiKey,
  setApiKey,
  getApiBaseUrl,
  DEFAULT_RAILWAY,
  DEFAULT_STATION_NAME,
} from './config';
import {
  type RailwayConfig,
  loadDirectionNames,
  loadTrainTypes,
  loadRailwayMetadata,
  setRailwayConfigs,
  getRailwayConfigs,
  getStationConfigs,
} from './dataLoaders';
import { renderBoard, getCurrentConfig, setCurrentConfig } from './boardRenderer';

/**
 * Main initialization function for the trainboard application.
 * Loads configuration, sets up UI, and initializes the departure board.
 */
async function initializeBoard(): Promise<void> {
  // Load configuration from file and localStorage
  try {
    await loadLocalConfig();
  } catch (error) {
    const e = error instanceof Error ? error : new Error(String(error));
    console.warn('Error loading local config:', e.message);
  }

  // Inject dynamic CSS styles for train types
  injectTrainTypeStyles();

  // Check for API key
  if (!getApiKey()) {
    // No API key: open the API-key modal so the user can paste one.
    uiSetupApiKeyModal(getApiKey(), (newKey) => {
      if (newKey) setApiKey(newKey);
      initializeBoard();
    });
    uiOpenApiModal();
    return;
  }

  const apiKey = String(getApiKey());
  const apiBaseUrl = getApiBaseUrl();

  // Load static data (directions and train types)
  await loadDirectionNames(apiKey, apiBaseUrl);
  await loadTrainTypes(apiKey, apiBaseUrl);

  // Load available railways
  try {
    const railways = await fetchRailways(apiKey, apiBaseUrl);
    const railwayConfigs = railways
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

    setRailwayConfigs(railwayConfigs);
  } catch (error) {
    const e = error instanceof Error ? error : new Error(String(error));
    console.error('Error fetching railway list:', e.message);
    const hdr = safeGetElement('station-header');
    if (hdr) hdr.textContent = 'エラー: 路線リスト取得失敗';
  }

  // Choose initial railway (read from localStorage if present)
  const selectedRailway = chooseInitialRailway(getRailwayConfigs(), DEFAULT_RAILWAY);
  let currentConfig = getCurrentConfig();

  if (selectedRailway) {
    currentConfig.railwayUri = selectedRailway.uri;
    setCurrentConfig(currentConfig);
    // loadRailwayMetadata now also loads stations from stationOrder
    await loadRailwayMetadata(selectedRailway.uri, apiKey, apiBaseUrl);
  }

  // Choose initial station (read from localStorage if present)
  const selected = chooseInitialStation(getStationConfigs(), DEFAULT_STATION_NAME);
  if (selected) {
    currentConfig = getCurrentConfig();
    currentConfig.stationUri = selected.uri;
    currentConfig.stationName = selected.name;
    setCurrentConfig(currentConfig);
  }

  // Setup the API key modal so users can change the key at any time
  uiSetupApiKeyModal(getApiKey(), (newKey) => {
    if (newKey) setApiKey(newKey);
    // Restart initialization now that we have an API key
    initializeBoard();
  });

  // Setup the unified settings modal for both railway and station selection
  uiSetupSettingsModal(
    getRailwayConfigs(),
    getStationConfigs(),
    getCurrentConfig().railwayUri,
    getCurrentConfig().stationUri,
    async (newRailwayUri) => {
      // Railway changed - reload metadata (includes stations from stationOrder)
      let config = getCurrentConfig();
      config.railwayUri = newRailwayUri;
      setCurrentConfig(config);

      await loadRailwayMetadata(newRailwayUri, apiKey, apiBaseUrl);

      // Reset station selection to first station of new railway
      const selected = chooseInitialStation(getStationConfigs(), DEFAULT_STATION_NAME);
      if (selected) {
        config = getCurrentConfig();
        config.stationUri = selected.uri;
        config.stationName = selected.name;
        setCurrentConfig(config);
      }

      renderBoard();
    },
    (newStationUri) => {
      // Only station changed
      const found = getStationConfigs().find((c) => c.uri === newStationUri);
      const config = getCurrentConfig();
      config.stationUri = newStationUri;
      config.stationName = found ? found.name : null;
      setCurrentConfig(config);
      renderBoard();
    },
    async (newRailwayUri) => {
      // Railway selection changed in modal - load railway metadata (includes stations)
      await loadRailwayMetadata(newRailwayUri, apiKey, apiBaseUrl);
    },
  );

  // Setup the location modal for finding nearby stations
  uiSetupLocationModal(async (stationUri, railwayUri) => {
    // User selected a station from location search
    let config = getCurrentConfig();

    // Check if we need to change railway
    if (config.railwayUri !== railwayUri) {
      config.railwayUri = railwayUri;
      setCurrentConfig(config);
      localStorage.setItem(STORAGE_KEY_RAILWAY_URI, railwayUri);

      // Load metadata for the new railway
      await loadRailwayMetadata(railwayUri, apiKey, apiBaseUrl);
    }

    // Set the station
    const found = getStationConfigs().find((c) => c.uri === stationUri);
    config = getCurrentConfig();
    config.stationUri = stationUri;
    config.stationName = found ? found.name : null;
    setCurrentConfig(config);
    localStorage.setItem(STORAGE_KEY_STATION_URI, stationUri);

    // Re-render the board
    renderBoard();
  });

  // Initial board render
  renderBoard();
}

// Expose to window for bootstrapping
(window as any).initializeBoard = initializeBoard;
window.onload = initializeBoard;

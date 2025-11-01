// src/trainboard.ts
// Main entry point and orchestrator for the trainboard application

import { fetchRailways } from './api';
import type { OdptRailway } from './types';
import { getJapaneseText, safeGetElement } from './utils';
import {
  chooseInitialStation,
  chooseInitialRailway,
  setupStationModal as uiSetupStationModal,
  setupRailwayModal as uiSetupRailwayModal,
  setupApiKeyModal as uiSetupApiKeyModal,
  openApiModal as uiOpenApiModal,
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
  loadStationsForRailway,
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
  } catch (e) {
    console.warn('Error loading local config:', e);
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
  } catch (err) {
    console.error('Error fetching railway list:', err);
    const hdr = safeGetElement('station-header');
    if (hdr) hdr.textContent = 'エラー: 路線リスト取得失敗';
  }

  // Choose initial railway (read from localStorage if present)
  const selectedRailway = chooseInitialRailway(getRailwayConfigs(), DEFAULT_RAILWAY);
  let currentConfig = getCurrentConfig();

  if (selectedRailway) {
    currentConfig.railwayUri = selectedRailway.uri;
    setCurrentConfig(currentConfig);
    await loadRailwayMetadata(selectedRailway.uri, apiKey, apiBaseUrl);
  }

  // Setup railway selection modal
  uiSetupRailwayModal(getRailwayConfigs(), currentConfig.railwayUri, async (newUri) => {
    let config = getCurrentConfig();
    config.railwayUri = newUri;
    setCurrentConfig(config);

    await loadRailwayMetadata(newUri, apiKey, apiBaseUrl);
    // Reload stations for the new railway
    await loadStationsForRailway(newUri, apiKey, apiBaseUrl);

    // Reset station selection
    const selected = chooseInitialStation(getStationConfigs(), DEFAULT_STATION_NAME);
    if (selected) {
      config = getCurrentConfig();
      config.stationUri = selected.uri;
      config.stationName = selected.name;
      setCurrentConfig(config);
    }

    // Update station modal with new stations
    uiSetupStationModal(getStationConfigs(), getCurrentConfig().stationUri, (newStationUri) => {
      const found = getStationConfigs().find((c) => c.uri === newStationUri);
      const cfg = getCurrentConfig();
      cfg.stationUri = newStationUri;
      cfg.stationName = found ? found.name : null;
      setCurrentConfig(cfg);
      renderBoard();
    });
    renderBoard();
  });

  // Load stations for the selected railway
  if (currentConfig.railwayUri) {
    await loadStationsForRailway(currentConfig.railwayUri, apiKey, apiBaseUrl);
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

  // Setup the station-selection modal
  uiSetupStationModal(getStationConfigs(), getCurrentConfig().stationUri, (newUri) => {
    const found = getStationConfigs().find((c) => c.uri === newUri);
    const config = getCurrentConfig();
    config.stationUri = newUri;
    config.stationName = found ? found.name : null;
    setCurrentConfig(config);
    renderBoard();
  });

  // Initial board render
  renderBoard();
}

// Expose to window for bootstrapping
(window as any).initializeBoard = initializeBoard;
window.onload = initializeBoard;

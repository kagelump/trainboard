// src/ui.ts
import type { StationTimetableEntry } from './types';
import type { SimpleCache } from './cache';
import { formatTimeHHMM } from './utils';
import { getStationConfigs, getRailwayConfigs } from './dataLoaders';
import prefectures from './prefectures.json';
import sortedPrefectures from './sorted_prefectures.json';
import operators from './operators.json';
import { DISPLAYED_TRAINS_LIMIT } from './constants';
import './components/DeparturesList.js';
import './components/StationHeader.js';
import { TrainDepartureView } from './components/TrainDepartureView.js';
import type { DeparturesList } from './components/DeparturesList.js';
import type { StationHeader } from './components/StationHeader.js';

type StationCfg = { name: string; uri: string };
type RailwayCfg = { name: string; uri: string; operator: string };

// LocalStorage keys - exported for use in other modules
export const STORAGE_KEY_RAILWAY_URI = 't2board_railway_uri';
export const STORAGE_KEY_STATION_URI = 't2board_station_uri';
export const STORAGE_KEY_API_KEY = 't2board_api_key';
export const STORAGE_KEY_RECENT_RAILWAYS = 't2board_recent_railways';
export const STORAGE_KEY_PREFECTURE = 't2board_prefecture';

// Maximum number of recent railways to store
const MAX_RECENT_RAILWAYS = 5;

// UI update intervals (milliseconds)
export const MINUTES_UPDATE_INTERVAL_MS = 15_000; // 15 seconds

// Track whether modals have been initialized to prevent duplicate event listeners
let apiKeyModalInitialized = false;
let stationModalInitialized = false;
let railwayModalInitialized = false;
let locationModalInitialized = false;

export function setPageTitle(title: string): void {
  document.title = title;
}

export function setStationHeader(name: string | null): void {
  const el = document.querySelector('station-header') as StationHeader | null;
  if (!el) return;
  el.stationName = name || '読込中...';
}

export function setLoadingState(): void {
  const inContainer = document.getElementById('departures-inbound') as HTMLElement;
  const outContainer = document.getElementById('departures-outbound') as HTMLElement;

  // Create or get DeparturesList components
  let inList = inContainer?.querySelector('departures-list') as DeparturesList;
  let outList = outContainer?.querySelector('departures-list') as DeparturesList;

  if (!inList) {
    inList = document.createElement('departures-list') as DeparturesList;
    if (inContainer) {
      inContainer.innerHTML = '';
      inContainer.appendChild(inList);
    }
  }

  if (!outList) {
    outList = document.createElement('departures-list') as DeparturesList;
    if (outContainer) {
      outContainer.innerHTML = '';
      outContainer.appendChild(outList);
    }
  }

  if (inList) inList.loading = true;
  if (outList) outList.loading = true;
}

export function setDirectionHeaders(inHeaderText: string, outHeaderText: string): void {
  const inHeader = document.getElementById('direction-inbound-header');
  const outHeader = document.getElementById('direction-outbound-header');
  if (inHeader) inHeader.textContent = `${inHeaderText}行き`;
  if (outHeader) outHeader.textContent = `${outHeaderText}行き`;
}

export function renderDirection(
  directionId: 'inbound' | 'outbound',
  departures: StationTimetableEntry[],
  stationNameCache: SimpleCache<string>,
  trainTypeMap: Record<string, { name: string; class: string }>,
): void {
  console.log('Rendering departures for', directionId, 'with', departures.length, 'entries');
  const container = document.getElementById(`departures-${directionId}`) as HTMLElement;
  if (!container) return;

  // Create or get DeparturesList component
  let departuresList = container.querySelector('departures-list') as DeparturesList;

  if (!departuresList) {
    departuresList = document.createElement('departures-list') as DeparturesList;
    container.innerHTML = '';
    container.appendChild(departuresList);
  }

  // Convert raw entries into TrainDepartureView instances and hand those to the component
  const views = departures.map((d) => new TrainDepartureView(d, stationNameCache));
  departuresList.departures = views;
  departuresList.stationNameCache = stationNameCache;
  departuresList.trainTypeMap = trainTypeMap;
  departuresList.loading = false;
}

// (App-level minutes-updater removed — individual `departures-list` components
// manage their own minute-updating when `autoUpdateMinutes` is enabled.)

export function updateClock(): void {
  const el = document.getElementById('time-header');
  if (!el) return;
  el.textContent = formatTimeHHMM();
}

export function chooseInitialStation(
  stationConfigs: StationCfg[],
  defaultStationName: string,
): StationCfg | undefined {
  const savedUri = localStorage.getItem(STORAGE_KEY_STATION_URI);
  const defaultStation =
    stationConfigs.find((c) => c.name === defaultStationName) || stationConfigs[0];
  let selectedStation = defaultStation;
  if (savedUri) {
    const found = stationConfigs.find((c) => c.uri === savedUri);
    if (found) selectedStation = found;
  } else if (stationConfigs.length > 0) {
    selectedStation = defaultStation || stationConfigs[0];
  }
  return selectedStation;
}

/**
 * Get recently selected railway URIs from localStorage
 */
export function getRecentRailways(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_RECENT_RAILWAYS);
    if (!stored) return [];
    return JSON.parse(stored) as string[];
  } catch (e) {
    return [];
  }
}

/**
 * Add a railway URI to the recent railways list
 */
export function addRecentRailway(railwayUri: string): void {
  try {
    let recent = getRecentRailways();
    // Remove if already exists (to move to front)
    recent = recent.filter((uri) => uri !== railwayUri);
    // Add to front
    recent.unshift(railwayUri);
    // Keep only MAX_RECENT_RAILWAYS items
    recent = recent.slice(0, MAX_RECENT_RAILWAYS);
    localStorage.setItem(STORAGE_KEY_RECENT_RAILWAYS, JSON.stringify(recent));
  } catch (e) {
    console.warn('Failed to save recent railway:', e);
  }
}

export function chooseInitialRailway(
  railwayConfigs: RailwayCfg[],
  defaultRailway: string,
): RailwayCfg | undefined {
  const savedUri = localStorage.getItem(STORAGE_KEY_RAILWAY_URI);
  const defaultRailwayConfig =
    railwayConfigs.find((c) => c.uri === defaultRailway) || railwayConfigs[0];
  let selectedRailway = defaultRailwayConfig;
  if (savedUri) {
    const found = railwayConfigs.find((c) => c.uri === savedUri);
    if (found) selectedRailway = found;
  } else if (railwayConfigs.length > 0) {
    selectedRailway = defaultRailwayConfig || railwayConfigs[0];
  }
  return selectedRailway;
}
/**
 * Get a friendly operator name from the operator URI
 */
function getOperatorName(operatorUri: string): string {
  if (!operatorUri) return 'その他';
  // Extract operator name from URI like "odpt.Operator:Tokyu" -> "Tokyu"
  const parts = operatorUri.split(':');
  const name = parts.length > 1 ? parts[1] : operatorUri;
  // Prefer mapping from operators.json, fall back to the raw name
  const operatorMap = operators as Record<string, string>;
  return operatorMap[name] || name;
}

/**
 * Setup the unified settings modal that handles both railway and station selection
 */
export function setupSettingsModal(
  railwayConfigs: RailwayCfg[],
  stationConfigs: StationCfg[],
  currentRailwayUri: string | null,
  currentStationUri: string | null,
  onRailwayChange: (newUri: string) => void,
  onStationChange: (newUri: string) => void,
  onRailwaySelectChange?: (newUri: string) => Promise<void>,
): void {
  const modal = document.getElementById('config-modal');
  const railwaySelect = document.getElementById('railway-select') as HTMLSelectElement | null;
  const stationSelect = document.getElementById('station-select') as HTMLSelectElement | null;
  const prefectureSelect = document.getElementById('prefecture-select') as HTMLSelectElement | null;
  if (!modal || !railwaySelect || !stationSelect || !prefectureSelect) return;

  function populateRailwayOptions(uri: string | null, prefecture?: string | null) {
    if (!railwaySelect) return;
    let html = '';
    const recentUris = getRecentRailways();
    // Determine allowed railways based on prefecture filter
    let allowedSet: Set<string> | null = null;
    if (prefecture && (prefectures as Record<string, string[]>)[prefecture]) {
      allowedSet = new Set((prefectures as Record<string, string[]>)[prefecture]);
    }

    const recentConfigs = recentUris
      .map((u) => railwayConfigs.find((c) => c.uri === u))
      .filter((c): c is RailwayCfg => c !== undefined)
      .filter((c) => (allowedSet ? allowedSet.has(c.uri) : true));

    // Add recent railways section if there are any
    if (recentConfigs.length > 0) {
      html += '<optgroup label="最近使用した路線">';
      for (const config of recentConfigs) {
        html += `<option value="${config.uri}" ${config.uri === uri ? 'selected' : ''}>${config.name}</option>`;
      }
      html += '</optgroup>';
    }

    // Group railways by operator
    const groupedByOperator = new Map<string, RailwayCfg[]>();
    for (const config of railwayConfigs) {
      if (allowedSet && !allowedSet.has(config.uri)) continue;
      const operatorName = getOperatorName(config.operator);
      if (!groupedByOperator.has(operatorName)) {
        groupedByOperator.set(operatorName, []);
      }
      groupedByOperator.get(operatorName)!.push(config);
    }

    // Sort operators alphabetically
    const sortedOperators = Array.from(groupedByOperator.keys()).sort((a, b) =>
      a.localeCompare(b, 'ja'),
    );

    // Add grouped options
    for (const operatorName of sortedOperators) {
      const configs = groupedByOperator.get(operatorName)!;
      html += `<optgroup label="${operatorName}">`;
      for (const config of configs) {
        html += `<option value="${config.uri}" ${config.uri === uri ? 'selected' : ''}>${config.name}</option>`;
      }
      html += '</optgroup>';
    }

    railwaySelect.innerHTML = html;
  }

  function populatePrefectureOptions(selected: string | null) {
    if (!prefectureSelect) return;
    // Use explicit ordering from sorted_prefectures.json, but only include
    // prefectures that actually exist in the `prefectures` mapping.
    const available = new Set(Object.keys(prefectures as Record<string, string[]>));
    const keys = (sortedPrefectures as string[]).filter((k) => available.has(k));
    prefectureSelect.innerHTML = keys
      .map((k) => `<option value="${k}" ${k === selected ? 'selected' : ''}>${k}</option>`)
      .join('');
  }

  function populateStationOptions(uri: string | null) {
    if (!stationSelect) return;
    // Get fresh station configs instead of using stale closure variable
    const freshStationConfigs = getStationConfigs();
    stationSelect.innerHTML = freshStationConfigs
      .map(
        (config) =>
          `<option value="${config.uri}" ${config.uri === uri ? 'selected' : ''}>${config.name}</option>`,
      )
      .join('');
  }

  // Populate prefecture and other selects. Use saved prefecture or default to 東京都
  const savedPref = localStorage.getItem(STORAGE_KEY_PREFECTURE) || '東京都';
  populatePrefectureOptions(savedPref);
  populateRailwayOptions(currentRailwayUri, savedPref);
  populateStationOptions(currentStationUri);

  // Only add event listeners once
  if (!stationModalInitialized) {
    const settingsBtn = document.getElementById('settings-button');
    settingsBtn?.addEventListener('click', () => {
      // Read current values from localStorage to ensure we have fresh data
      const currentRailway = localStorage.getItem(STORAGE_KEY_RAILWAY_URI);
      const currentStation = localStorage.getItem(STORAGE_KEY_STATION_URI);
      const currentPref = localStorage.getItem(STORAGE_KEY_PREFECTURE) || '東京都';
      populatePrefectureOptions(currentPref);
      populateRailwayOptions(currentRailway, currentPref);
      populateStationOptions(currentStation);
      openStationModal();
    });

    const closeBtn = document.getElementById('close-modal');
    closeBtn?.addEventListener('click', () => {
      closeStationModal();
    });

    // Add railway select change listener to update station list immediately
    railwaySelect?.addEventListener('change', async () => {
      if (!railwaySelect) return;
      const selectedRailwayUri = railwaySelect.value;

      // Show loading state in station select
      if (stationSelect) {
        stationSelect.innerHTML = '<option>駅を読込中...</option>';
        stationSelect.disabled = true;
      }

      // Call the callback to load stations for the new railway
      if (onRailwaySelectChange) {
        try {
          await onRailwaySelectChange(selectedRailwayUri);
          // Stations will be reloaded, repopulate the station select
          populateStationOptions(null); // Select first station by default
        } catch (error) {
          console.error('Failed to load stations:', error);
          if (stationSelect) {
            stationSelect.innerHTML = '<option>駅の読込に失敗しました</option>';
          }
        } finally {
          if (stationSelect) {
            stationSelect.disabled = false;
          }
        }
      }
    });

    // Prefecture change: re-populate railway list filtered by prefecture
    prefectureSelect?.addEventListener('change', async () => {
      if (!prefectureSelect) return;
      const newPref = prefectureSelect.value;
      // Persist preference immediately so subsequent logic can read it
      try {
        localStorage.setItem(STORAGE_KEY_PREFECTURE, newPref);
      } catch {
        // ignore
      }
      // Repopulate railways for this prefecture and select the first option
      populateRailwayOptions(null, newPref);
    });

    const saveBtn = document.getElementById('save-settings');
    saveBtn?.addEventListener('click', () => {
      if (!railwaySelect || !stationSelect || !prefectureSelect) return;
      const newRailwayUri = railwaySelect.value;
      const newStationUri = stationSelect.value;
      const newPrefecture = prefectureSelect.value;

      // Read current values from localStorage instead of using stale closure variables
      const previousRailwayUri = localStorage.getItem(STORAGE_KEY_RAILWAY_URI);
      const previousStationUri = localStorage.getItem(STORAGE_KEY_STATION_URI);
      const previousPrefecture = localStorage.getItem(STORAGE_KEY_PREFECTURE);

      // Save to localStorage
      localStorage.setItem(STORAGE_KEY_PREFECTURE, newPrefecture);
      localStorage.setItem(STORAGE_KEY_RAILWAY_URI, newRailwayUri);
      localStorage.setItem(STORAGE_KEY_STATION_URI, newStationUri);
      addRecentRailway(newRailwayUri);

      // If prefecture or railway changed, call onRailwayChange which will also update stations
      if (newPrefecture !== previousPrefecture || newRailwayUri !== previousRailwayUri) {
        onRailwayChange(newRailwayUri);
      } else if (newStationUri !== previousStationUri) {
        // Only station changed
        onStationChange(newStationUri);
      }

      closeStationModal();
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeStationModal();
    });

    stationModalInitialized = true;
  }
}

export function setupApiKeyModal(
  currentApiKey: string | null,
  onSave: (apiKey: string | null) => void,
): void {
  const modal = document.getElementById('api-key-modal');
  const apiKeyInput = document.getElementById('api-key-input') as HTMLInputElement | null;
  if (!modal || !apiKeyInput) return;

  apiKeyInput.value = currentApiKey || '';

  // Only add event listeners once
  if (!apiKeyModalInitialized) {
    const saveBtn = document.getElementById('save-api-key');
    const closeBtn = document.getElementById('close-api-key');

    saveBtn?.addEventListener('click', () => {
      const newKey = apiKeyInput.value ? apiKeyInput.value.trim() : null;
      if (newKey) localStorage.setItem(STORAGE_KEY_API_KEY, newKey);
      else localStorage.removeItem(STORAGE_KEY_API_KEY);
      onSave(newKey);
      closeApiModal();
    });

    closeBtn?.addEventListener('click', () => closeApiModal());

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeApiModal();
    });

    apiKeyModalInitialized = true;
  }
}

export function openStationModal(): void {
  const modal = document.getElementById('config-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.classList.add('flex', 'opacity-100');
}

export function closeStationModal(): void {
  const modal = document.getElementById('config-modal');
  if (!modal) return;
  modal.classList.remove('flex', 'opacity-100');
  modal.classList.add('hidden');
}

export function openApiModal(): void {
  const modal = document.getElementById('api-key-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.classList.add('flex', 'opacity-100');
}

export function closeApiModal(): void {
  const modal = document.getElementById('api-key-modal');
  if (!modal) return;
  modal.classList.remove('flex', 'opacity-100');
  modal.classList.add('hidden');
}

export function showStatus(message: string, kind: 'info' | 'error' | 'warn' = 'info'): void {
  const el = document.getElementById('status-banner');
  if (!el) return;
  el.classList.remove('hidden');
  el.classList.remove('bg-red-100', 'bg-yellow-100', 'bg-blue-100', 'text-red-800');
  // simple style mapping
  if (kind === 'error') el.classList.add('bg-red-100', 'text-red-800');
  else if (kind === 'warn') el.classList.add('bg-yellow-100');
  else el.classList.add('bg-blue-100');
  el.textContent = message;
}

export function clearStatus(): void {
  const el = document.getElementById('status-banner');
  if (!el) return;
  el.classList.add('hidden');
  el.textContent = '';
}

export function openLocationModal(): void {
  const modal = document.getElementById('location-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.classList.add('flex', 'opacity-100');
}

export function closeLocationModal(): void {
  const modal = document.getElementById('location-modal');
  if (!modal) return;
  modal.classList.remove('flex', 'opacity-100');
  modal.classList.add('hidden');
}

export function setLocationStatus(message: string): void {
  const el = document.getElementById('location-status');
  if (!el) return;
  el.textContent = message;
}

/**
 * Setup the location modal and handle finding nearby stations
 */
export function setupLocationModal(
  onStationSelect: (stationUri: string, railwayUri: string) => void,
): void {
  const modal = document.getElementById('location-modal');
  const locationButton = document.getElementById('location-button');
  const closeButton = document.getElementById('close-location-modal');
  const stationsList = document.getElementById('nearby-stations-list');

  if (!modal || !locationButton || !closeButton || !stationsList) return;

  // Only add event listeners once
  if (!locationModalInitialized) {
    closeButton.addEventListener('click', () => {
      closeLocationModal();
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeLocationModal();
    });

    // Use event delegation for station buttons to avoid memory leaks
    stationsList.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const button = target.closest('[data-station-uri]') as HTMLElement;
      if (button) {
        const stationUri = button.getAttribute('data-station-uri');
        const railwayUri = button.getAttribute('data-railway-uri');
        if (stationUri && railwayUri) {
          onStationSelect(stationUri, railwayUri);
          closeLocationModal();
        }
      }
    });

    locationButton.addEventListener('click', async () => {
      openLocationModal();
      setLocationStatus('現在地を取得中...');

      // Clear previous results
      stationsList.innerHTML = '';

      try {
        // Dynamically import location module to avoid bundling issues
        const { getCurrentPosition, findNearbyStations, formatDistance } = await import(
          './location'
        );

        const position = await getCurrentPosition();
        const { latitude, longitude } = position.coords;

        setLocationStatus(`現在地: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);

        // Find nearby stations (top 5)
        const nearbyStations = findNearbyStations(latitude, longitude, 5);

        if (nearbyStations.length === 0) {
          const noResultsP = document.createElement('p');
          noResultsP.className = 'text-center text-lg';
          noResultsP.textContent = '近くに駅が見つかりませんでした';
          stationsList.appendChild(noResultsP);
          return;
        }

        // Create station buttons using DOM API (safer than innerHTML)
        nearbyStations.forEach((station) => {
          const button = document.createElement('button');
          button.className =
            'w-full text-left p-4 mb-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition border-2 border-white';
          button.setAttribute('data-station-uri', station.uri);
          button.setAttribute('data-railway-uri', station.railway);

          const nameDiv = document.createElement('div');
          nameDiv.className = 'font-bold text-xl';
          nameDiv.textContent = station.name;

          // Lookup railway and operator friendly names
          const railwayCfg = getRailwayConfigs().find((r) => r.uri === station.railway);
          const railwayName = railwayCfg ? railwayCfg.name : station.railway;
          const operatorName = getOperatorName(railwayCfg ? railwayCfg.operator : station.operator);

          const infoDiv = document.createElement('div');
          infoDiv.className = 'text-sm text-gray-300 mt-1';
          infoDiv.textContent = `${operatorName} / ${railwayName}`;

          const distanceDiv = document.createElement('div');
          distanceDiv.className = 'text-sm text-gray-300 mt-1';
          distanceDiv.textContent = `距離: ${formatDistance(station.distance)}`;

          button.appendChild(nameDiv);
          button.appendChild(infoDiv);
          button.appendChild(distanceDiv);
          stationsList.appendChild(button);
        });
      } catch (error) {
        const e = error instanceof Error ? error : new Error(String(error));
        console.error('Location error:', e);
        setLocationStatus('エラー: ' + e.message);

        const errorP = document.createElement('p');
        errorP.className = 'text-center text-lg text-red-400';
        errorP.textContent =
          '位置情報の取得に失敗しました。ブラウザの設定で位置情報の使用を許可してください。';
        stationsList.appendChild(errorP);
      }
    });

    locationModalInitialized = true;
  }
}

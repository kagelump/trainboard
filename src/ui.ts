// src/ui.ts
import type { StationTimetableEntry } from './types';
import type { SimpleCache } from './cache';
import { formatTimeHHMM } from './utils';
import { getStationConfigs } from './dataLoaders';
import prefectures from './prefectures.json';
import sortedPrefectures from './sorted_prefectures.json';
import operators from './operators.json';
import { DISPLAYED_TRAINS_LIMIT } from './constants';

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

export function setPageTitle(title: string): void {
  document.title = title;
}

export function setStationHeader(name: string | null): void {
  const el = document.getElementById('station-header');
  if (!el) return;
  el.textContent = name || '';
}

export function setLoadingState(): void {
  const inContainer = document.getElementById('departures-inbound');
  const outContainer = document.getElementById('departures-outbound');
  const loadingHtml = `<p class="text-center text-2xl pt-8">時刻表を取得中...</p>`;
  if (inContainer) inContainer.innerHTML = loadingHtml;
  if (outContainer) outContainer.innerHTML = loadingHtml;
}

export function setDirectionHeaders(inHeaderText: string, outHeaderText: string): void {
  const inHeader = document.getElementById('direction-inbound-header');
  const outHeader = document.getElementById('direction-outbound-header');
  if (inHeader) inHeader.textContent = inHeaderText;
  if (outHeader) outHeader.textContent = outHeaderText;
}

/**
 * Extract destination station title from train object
 */
function getDestinationTitle(
  train: StationTimetableEntry,
  stationNameCache: SimpleCache<string>,
): string {
  let destinationTitle = 'N/A';
  const dests = (train as any)['odpt:destinationStation'];
  if (Array.isArray(dests) && dests.length > 0) {
    const first = dests[0];
    if (typeof first === 'string') {
      destinationTitle = stationNameCache.get(first) || first;
    } else if (first && typeof first === 'object') {
      destinationTitle = (first as any)['dc:title'] || (first as any)['title'] || 'N/A';
      if ((!destinationTitle || destinationTitle === 'N/A') && (first as any)['owl:sameAs']) {
        const uri = (first as any)['owl:sameAs'];
        if (typeof uri === 'string') destinationTitle = stationNameCache.get(uri) || uri;
      }
    }
  } else if (typeof dests === 'string') {
    destinationTitle = stationNameCache.get(dests) || dests;
  }
  return destinationTitle;
}

export function renderDirection(
  directionId: 'inbound' | 'outbound',
  departures: StationTimetableEntry[],
  stationNameCache: SimpleCache<string>,
  trainTypeMap: Record<string, { name: string; class: string }>,
): void {
  const container = document.getElementById(`departures-${directionId}`);
  if (!container) return;
  if (departures.length === 0) {
    container.innerHTML = `<p class="text-center text-2xl pt-8">本日の発車予定はありません。</p>`;
    return;
  }
  container.innerHTML = departures
    .map((train) => {
      const departureTime = (train as any)['odpt:departureTime'] || '';
      const trainTypeUri = (train as any)['odpt:trainType'] || '';
      const destinationTitle = getDestinationTitle(train, stationNameCache);
      const trainType = trainTypeMap[trainTypeUri] || { name: '不明', class: 'type-LOC' };

      return `
        <div class="train-row items-center justify-between" data-departure="${departureTime}">
          <div class="minutes-col text-center" data-departure="${departureTime}">--</div>
          <div class="time-col text-center">${departureTime || '--'}</div>
          <div class="flex justify-center items-center">
            <span class="train-type-badge ${trainType.class}">${trainType.name}</span>
          </div>
          <div class="destination-text">${destinationTitle}</div>
        </div>`;
    })
    .join('');
}

// --- Minutes-away updater ---
let minutesUpdaterId: number | undefined;

// Track which trains are currently displayed (by departure time)
let displayedTrainsInbound: string[] = [];
let displayedTrainsOutbound: string[] = [];

// Track the highest cache index we've shown for each direction
let highestShownIndexInbound = DISPLAYED_TRAINS_LIMIT - 1;
let highestShownIndexOutbound = DISPLAYED_TRAINS_LIMIT - 1;

function parseTimeToSeconds(timeStr: string): number {
  const [hStr, mStr] = (timeStr || '').split(':');
  const h = Number(hStr || 0);
  const m = Number(mStr || 0);
  return h * 3600 + m * 60;
}

function updateMinutesOnce(
  trainCacheInbound?: StationTimetableEntry[],
  trainCacheOutbound?: StationTimetableEntry[],
  stationNameCache?: SimpleCache<string>,
  trainTypeMap?: Record<string, { name: string; class: string }>,
): void {
  const now = new Date();
  const nowSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

  // Helper function to update a single direction
  const updateDirection = (
    directionId: 'inbound' | 'outbound',
    trainCache?: StationTimetableEntry[],
  ) => {
    const container = document.getElementById(`departures-${directionId}`);
    if (!container || !trainCache || !stationNameCache || !trainTypeMap) {
      console.warn(`updateMinutesOnce: Missing required parameters for ${directionId}`, {
        container: !!container,
        trainCache: !!trainCache,
        stationNameCache: !!stationNameCache,
        trainTypeMap: !!trainTypeMap,
      });
      return;
    }

    const els = Array.from(container.querySelectorAll<HTMLElement>('.train-row[data-departure]'));
    const displayedTimes =
      directionId === 'inbound' ? displayedTrainsInbound : displayedTrainsOutbound;
    const highestShownIndex =
      directionId === 'inbound' ? highestShownIndexInbound : highestShownIndexOutbound;

    // Track which trains to remove
    const trainsToRemove: HTMLElement[] = [];

    for (const el of els) {
      const dep = el.getAttribute('data-departure') || '';
      const depSecs = parseTimeToSeconds(dep);
      const diff = depSecs - nowSeconds;

      const minutesCol = el.querySelector('.minutes-col');
      if (!minutesCol) continue;

      if (diff <= 0) {
        // Train has departed - mark for removal
        trainsToRemove.push(el);
      } else if (diff <= 60) {
        minutesCol.textContent = '到着';
      } else {
        const mins = Math.ceil(diff / 60);
        minutesCol.textContent = `${mins}分`;
      }
    }

    // Remove departed trains and replace with cached trains
    if (trainsToRemove.length > 0) {
      // Get next trains from cache starting from after the highest index we've shown
      const nextStartIndex = highestShownIndex + 1;
      const nextTrains = trainCache.slice(nextStartIndex, nextStartIndex + trainsToRemove.length);

      // Update the highest shown index (only if we actually got new trains)
      if (nextTrains.length > 0) {
        if (directionId === 'inbound') {
          highestShownIndexInbound = nextStartIndex + nextTrains.length - 1;
        } else {
          highestShownIndexOutbound = nextStartIndex + nextTrains.length - 1;
        }
      }

      // Remove departed trains
      trainsToRemove.forEach((el) => {
        const dep = el.getAttribute('data-departure') || '';
        const index = displayedTimes.indexOf(dep);
        if (index > -1) {
          displayedTimes.splice(index, 1);
        }
        el.remove();
      });

      // Add new trains from cache
      nextTrains.forEach((train) => {
        const departureTime = (train as any)['odpt:departureTime'];
        if (!departureTime || displayedTimes.includes(departureTime)) return;

        const trainTypeUri = (train as any)['odpt:trainType'] || '';
        const destinationTitle = getDestinationTitle(train, stationNameCache);
        const trainType = trainTypeMap[trainTypeUri] || { name: '不明', class: 'type-LOC' };

        const trainHtml = `
          <div class="train-row items-center justify-between" data-departure="${departureTime}">
            <div class="minutes-col text-center" data-departure="${departureTime}">--</div>
            <div class="time-col text-center">${departureTime}</div>
            <div class="flex justify-center items-center">
              <span class="train-type-badge ${trainType.class}">${trainType.name}</span>
            </div>
            <div class="destination-text">${destinationTitle}</div>
          </div>`;

        container.insertAdjacentHTML('beforeend', trainHtml);
        displayedTimes.push(departureTime);
      });
    }
  };

  // Update both directions
  updateDirection('inbound', trainCacheInbound);
  updateDirection('outbound', trainCacheOutbound);
}

export function startMinutesUpdater(
  trainCacheInbound?: StationTimetableEntry[],
  trainCacheOutbound?: StationTimetableEntry[],
  stationNameCache?: SimpleCache<string>,
  trainTypeMap?: Record<string, { name: string; class: string }>,
  intervalMs = MINUTES_UPDATE_INTERVAL_MS,
): void {
  // Reset displayed trains tracking when starting a new updater
  if (trainCacheInbound) {
    displayedTrainsInbound = trainCacheInbound
      .slice(0, DISPLAYED_TRAINS_LIMIT)
      .map((t) => (t as any)['odpt:departureTime'])
      .filter(Boolean);
    highestShownIndexInbound = DISPLAYED_TRAINS_LIMIT - 1;
  }
  if (trainCacheOutbound) {
    displayedTrainsOutbound = trainCacheOutbound
      .slice(0, DISPLAYED_TRAINS_LIMIT)
      .map((t) => (t as any)['odpt:departureTime'])
      .filter(Boolean);
    highestShownIndexOutbound = DISPLAYED_TRAINS_LIMIT - 1;
  }

  updateMinutesOnce(trainCacheInbound, trainCacheOutbound, stationNameCache, trainTypeMap);
  if (typeof minutesUpdaterId !== 'undefined') clearInterval(minutesUpdaterId);
  minutesUpdaterId = window.setInterval(
    () => updateMinutesOnce(trainCacheInbound, trainCacheOutbound, stationNameCache, trainTypeMap),
    intervalMs,
  ) as unknown as number;
}

export function stopMinutesUpdater(): void {
  if (typeof minutesUpdaterId !== 'undefined') {
    clearInterval(minutesUpdaterId);
    minutesUpdaterId = undefined;
  }
}

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

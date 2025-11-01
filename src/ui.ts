// src/ui.ts
import type { StationTimetableEntry } from './types';
import type { SimpleCache } from './cache';
import { timeToMinutes, formatTimeHHMM } from './utils';
import { getStationConfigs } from './dataLoaders';

type StationCfg = { name: string; uri: string };
type RailwayCfg = { name: string; uri: string; operator: string };

// LocalStorage keys - exported for use in other modules
export const STORAGE_KEY_RAILWAY_URI = 't2board_railway_uri';
export const STORAGE_KEY_STATION_URI = 't2board_station_uri';
export const STORAGE_KEY_API_KEY = 't2board_api_key';
export const STORAGE_KEY_RECENT_RAILWAYS = 't2board_recent_railways';

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
      // Type-safe property access using the interface
      const departureTime = train['odpt:departureTime'];
      const trainTypeUri = train['odpt:trainType'] || '';
      let destinationTitle = 'N/A';
      const dests = train['odpt:destinationStation'];

      if (Array.isArray(dests) && dests.length > 0) {
        const first = dests[0];
        if (typeof first === 'string') {
          destinationTitle = stationNameCache.get(first) || first;
        } else if (first && typeof first === 'object') {
          // Handle object with dc:title or title properties
          const titleObj = first as Record<string, unknown>;
          destinationTitle =
            (titleObj['dc:title'] as string) || (titleObj['title'] as string) || 'N/A';

          if ((!destinationTitle || destinationTitle === 'N/A') && titleObj['owl:sameAs']) {
            const uri = titleObj['owl:sameAs'];
            if (typeof uri === 'string') {
              destinationTitle = stationNameCache.get(uri) || uri;
            }
          }
        }
      } else if (typeof dests === 'string') {
        destinationTitle = stationNameCache.get(dests) || dests;
      }

      const trainType = trainTypeMap[trainTypeUri] || { name: '不明', class: 'type-LOC' };

      return `
        <div class="train-row items-center justify-between">
          <div class="minutes-col text-center" data-departure="${departureTime || ''}">--</div>
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

function parseTimeToSeconds(timeStr: string): number {
  const [hStr, mStr] = (timeStr || '').split(':');
  const h = Number(hStr || 0);
  const m = Number(mStr || 0);
  return h * 3600 + m * 60;
}

function updateMinutesOnce(): void {
  const els = Array.from(document.querySelectorAll<HTMLElement>('[data-departure]'));
  const now = new Date();
  const nowSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  for (const el of els) {
    const dep = el.getAttribute('data-departure') || '';
    const depSecs = parseTimeToSeconds(dep);
    // If departure time appears to be earlier than now (cross-midnight not handled),
    // treat as passed
    const diff = depSecs - nowSeconds;
    if (diff <= 0) {
      el.textContent = '出発';
    } else if (diff <= 60) {
      el.textContent = '到着';
    } else {
      const mins = Math.ceil(diff / 60);
      el.textContent = `${mins}分`;
    }
  }
}

export function startMinutesUpdater(intervalMs = MINUTES_UPDATE_INTERVAL_MS): void {
  updateMinutesOnce();
  if (typeof minutesUpdaterId !== 'undefined') clearInterval(minutesUpdaterId);
  minutesUpdaterId = window.setInterval(updateMinutesOnce, intervalMs) as unknown as number;
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
  // Convert common operator names to Japanese
  const operatorMap: Record<string, string> = {
    Tokyu: '東急',
    JR: 'JR',
    Toei: '都営',
    TokyoMetro: '東京メトロ',
    Odakyu: '小田急',
    Keio: '京王',
    Seibu: '西武',
    Tobu: '東武',
    Keisei: '京成',
    Keikyu: '京急',
    Sotetsu: '相鉄',
    YokohamaMunicipal: '横浜市営',
  };
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
  if (!modal || !railwaySelect || !stationSelect) return;

  function populateRailwayOptions(uri: string | null) {
    if (!railwaySelect) return;
    let html = '';
    const recentUris = getRecentRailways();
    const recentConfigs = recentUris
      .map((u) => railwayConfigs.find((c) => c.uri === u))
      .filter((c): c is RailwayCfg => c !== undefined);

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

  // Populate both selects
  populateRailwayOptions(currentRailwayUri);
  populateStationOptions(currentStationUri);

  // Only add event listeners once
  if (!stationModalInitialized) {
    const settingsBtn = document.getElementById('settings-button');
    settingsBtn?.addEventListener('click', () => {
      populateRailwayOptions(currentRailwayUri);
      populateStationOptions(currentStationUri);
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

    const saveBtn = document.getElementById('save-settings');
    saveBtn?.addEventListener('click', () => {
      if (!railwaySelect || !stationSelect) return;
      const newRailwayUri = railwaySelect.value;
      const newStationUri = stationSelect.value;

      // Save to localStorage
      localStorage.setItem(STORAGE_KEY_RAILWAY_URI, newRailwayUri);
      localStorage.setItem(STORAGE_KEY_STATION_URI, newStationUri);
      addRecentRailway(newRailwayUri);

      // If railway changed, call onRailwayChange which will also update stations
      if (newRailwayUri !== currentRailwayUri) {
        onRailwayChange(newRailwayUri);
      } else if (newStationUri !== currentStationUri) {
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

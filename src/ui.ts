// src/ui.ts
import type { StationTimetableEntry } from './types';
import type { SimpleCache } from './cache';
import { timeToMinutes } from './utils';

type StationCfg = { name: string; uri: string };

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
      const departureTime = (train as any)['odpt:departureTime'];
      const trainTypeUri = (train as any)['odpt:trainType'] || '';
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
      const trainType = trainTypeMap[trainTypeUri] || { name: '不明', class: 'type-LOC' };
      // add a minutes column with a data attribute so it can be updated
      // independently of API fetches
      return `
        <div class="train-row items-center justify-between">
          <div class="minutes-col text-center" data-departure="${departureTime}">--</div>
          <div class="time-col text-center">${departureTime}</div>
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

export function startMinutesUpdater(intervalMs = 15_000): void {
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
  const now = new Date();
  el.textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export function chooseInitialStation(
  stationConfigs: StationCfg[],
  defaultStationName: string,
): StationCfg | undefined {
  const savedUri = localStorage.getItem('t2board_station_uri');
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
export function setupStationModal(
  stationConfigs: StationCfg[],
  currentUri: string | null,
  onSave: (newUri: string) => void,
): void {
  const modal = document.getElementById('config-modal');
  const stationSelect = document.getElementById('station-select') as HTMLSelectElement | null;
  if (!modal || !stationSelect) return;

  function populateOptions(uri: string | null) {
    stationSelect!.innerHTML = stationConfigs
      .map(
        (config) =>
          `<option value="${config.uri}" ${config.uri === uri ? 'selected' : ''}>${config.name}</option>`,
      )
      .join('');
  }

  populateOptions(currentUri);

  const settingsBtn = document.getElementById('settings-button');
  settingsBtn?.addEventListener('click', () => {
    populateOptions(currentUri);
    openStationModal();
  });

  const closeBtn = document.getElementById('close-modal');
  closeBtn?.addEventListener('click', () => {
    closeStationModal();
  });

  const saveBtn = document.getElementById('save-settings');
  saveBtn?.addEventListener('click', () => {
    const newUri = stationSelect.value;
    localStorage.setItem('t2board_station_uri', newUri);
    onSave(newUri);
    closeStationModal();
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeStationModal();
  });
}

export function setupApiKeyModal(
  currentApiKey: string | null,
  onSave: (apiKey: string | null) => void,
): void {
  console.log('Open up API key modal setup');
  const modal = document.getElementById('api-key-modal');
  console.log(modal);
  const apiKeyInput = document.getElementById('api-key-input') as HTMLInputElement | null;
  console.log(apiKeyInput);
  if (!modal || !apiKeyInput) return;

  apiKeyInput.value = currentApiKey || '';

  const saveBtn = document.getElementById('save-api-key');
  const closeBtn = document.getElementById('close-api-key');

  saveBtn?.addEventListener('click', () => {
    const newKey = apiKeyInput.value ? apiKeyInput.value.trim() : null;
    if (newKey) localStorage.setItem('t2board_api_key', newKey);
    else localStorage.removeItem('t2board_api_key');
    onSave(newKey);
    closeApiModal();
  });

  closeBtn?.addEventListener('click', () => closeApiModal());

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeApiModal();
  });
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

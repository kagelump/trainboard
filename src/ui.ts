// src/ui.ts
import type { StationTimetableEntry } from './types';
import type { SimpleCache } from './cache';

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
      return `
        <div class="train-row">
          <div class="time-col">${departureTime}</div>
          <div class="flex justify-center items-center">
            <span class="train-type-badge ${trainType.class}">${trainType.name}</span>
          </div>
          <div class="destination-text">${destinationTitle}行き</div>
        </div>`;
    })
    .join('');
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

export function setupModal(
  stationConfigs: StationCfg[],
  currentUri: string | null,
  onSave: (newUri: string) => void,
): void {
  const modal = document.getElementById('config-modal');
  const stationSelect = document.getElementById('station-select') as HTMLSelectElement | null;
  if (!modal || !stationSelect) return;
  stationSelect.innerHTML = stationConfigs
    .map(
      (config) =>
        `<option value="${config.uri}" ${config.uri === currentUri ? 'selected' : ''}>${config.name}</option>`,
    )
    .join('');

  const settingsBtn = document.getElementById('settings-button');
  settingsBtn?.addEventListener('click', () => {
    stationSelect.value = currentUri || '';
    modal.classList.remove('hidden');
    modal.classList.add('flex', 'opacity-100');
  });

  const closeBtn = document.getElementById('close-modal');
  closeBtn?.addEventListener('click', () => {
    modal.classList.remove('flex', 'opacity-100');
    modal.classList.add('hidden');
  });

  const saveBtn = document.getElementById('save-settings');
  saveBtn?.addEventListener('click', () => {
    const newUri = stationSelect.value;
    localStorage.setItem('t2board_station_uri', newUri);
    onSave(newUri);
    modal.classList.remove('flex', 'opacity-100');
    modal.classList.add('hidden');
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('flex', 'opacity-100');
      modal.classList.add('hidden');
    }
  });
}

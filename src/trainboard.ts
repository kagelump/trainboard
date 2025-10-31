// src/trainboard.ts
// TypeScript rewrite of trainboard.js

type StationConfig = {
  name: string;
  uri: string;
};

type TrainTypeMapEntry = {
  name: string;
  class: string;
};

type TimetableDestination = { 'dc:title'?: string };

type TimetableObject = {
  'odpt:departureTime': string;
  'odpt:trainType'?: string;
  'odpt:railDirection'?: string;
  'odpt:destinationStation'?: TimetableDestination[];
  [key: string]: unknown;
};

// --- 1. CONFIGURATION AND CONSTANTS ---
let ODPT_API_KEY: string | null = null; // loaded from ./config.json at runtime
const API_BASE_URL = 'https://api-challenge.odpt.org/api/v4/';
const TOKYU_TOYOKO_LINE_URI = 'odpt.Railway:Tokyu.Toyoko';
const INBOUND_DIRECTION_URI = 'odpt.RailDirection:Inbound';
const OUTBOUND_DIRECTION_URI = 'odpt.RailDirection:Outbound';
const INBOUND_FRIENDLY_NAME_JA = '渋谷・副都心線方面';
const OUTBOUND_FRIENDLY_NAME_JA = '横浜・元町中華街方面';

const TRAIN_TYPE_MAP: Record<string, TrainTypeMapEntry> = {
  'odpt.TrainType:Tokyu.Local': { name: '各停', class: 'type-LOC' },
  'odpt.TrainType:Tokyu.Express': { name: '急行', class: 'type-EXP' },
  'odpt.TrainType:Tokyu.CommuterExpress': { name: '通勤急行', class: 'type-CEXP' },
  'odpt.TrainType:Tokyu.LimitedExpress': { name: '特急', class: 'type-LE' },
  'odpt.TrainType:Tokyu.CommuterLimitedExpress': { name: '通勤特急', class: 'type-CLE' },
  'odpt.TrainType:Local': { name: '各停', class: 'type-LOC' },
  'odpt.TrainType:Express': { name: '急行', class: 'type-EXP' },
  'odpt.TrainType:LimitedExpress': { name: '特急', class: 'type-LE' },
};

let STATION_CONFIGS: StationConfig[] = [];
const DEFAULT_STATION_NAME = '武蔵小杉 (TY11)';
let currentConfig: { stationUri: string | null; stationName: string | null } = {
  stationUri: null,
  stationName: null,
};

let timetableIntervalId: number | undefined;
let statusIntervalId: number | undefined;

// --- Utilities ---
function getJapaneseText(langMap: unknown): string {
  if (!langMap) return 'N/A';
  if (typeof langMap === 'string') return langMap;
  const map = langMap as Record<string, string>;
  return map.ja || map.en || 'N/A';
}

function getTodayCalendarURIs(): string[] {
  const day = new Date().getDay();
  if (day >= 1 && day <= 5) return ['odpt.Calendar:Weekday'];
  return ['odpt.Calendar:SaturdayHoliday'];
}

function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map((v) => Number(v));
  return h * 60 + m;
}

async function apiFetch(url: string, retries = 3, delay = 1000): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise((r) => setTimeout(r, delay * 2 ** i));
    }
  }
  // Should never reach here
  throw new Error('Unreachable');
}

// --- Data fetching ---
async function fetchRailwayStations(): Promise<void> {
  const params = new URLSearchParams({
    'acl:consumerKey': String(ODPT_API_KEY),
    'odpt:railway': TOKYU_TOYOKO_LINE_URI,
    'odpt:operator': 'odpt.Operator:Tokyu',
  });
  const url = `${API_BASE_URL}odpt:Station?${params.toString()}`;
  try {
    const resp = await apiFetch(url);
    const data = (await resp.json()) as any[];
    STATION_CONFIGS = data
      .map((station) => {
        const stationNameJa = station['dc:title'] as string;
        const stationCode = station['odpt:stationCode'] || '';
        return { name: `${stationNameJa} (${stationCode})`, uri: station['owl:sameAs'] } as StationConfig;
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  } catch (err) {
    console.error('Error fetching station list:', err);
    const el = document.getElementById('station-header');
    if (el) el.textContent = 'エラー: 駅リスト取得失敗';
  }
}

async function fetchStationTimetable(stationUri: string): Promise<TimetableObject[]> {
  const calendarURIs = getTodayCalendarURIs();
  const params = new URLSearchParams({
    'acl:consumerKey': String(ODPT_API_KEY),
    'odpt:railway': TOKYU_TOYOKO_LINE_URI,
    'odpt:station': stationUri,
  });
  const url = `${API_BASE_URL}odpt:StationTimetable?${params.toString()}`;
  try {
    const resp = await apiFetch(url);
    const data = (await resp.json()) as any[];
    if (data.length === 0) return [];
    const expected = calendarURIs[0];
    const timetable = data.find((t) => t['odpt:calendar'] === expected);
    return (timetable?.['odpt:stationTimetableObject'] as TimetableObject[]) || [];
  } catch (err) {
    console.error('時刻表取得エラー:', err);
    return [];
  }
}

async function fetchStatus(): Promise<void> {
  const statusBanner = document.getElementById('status-banner');
  if (!statusBanner) return;
  statusBanner.classList.add('hidden');
  statusBanner.innerHTML = '';

  const params = new URLSearchParams({ 'acl:consumerKey': String(ODPT_API_KEY), 'odpt:railway': TOKYU_TOYOKO_LINE_URI });
  const url = `${API_BASE_URL}odpt:TrainInformation?${params.toString()}`;
  try {
    const resp = await apiFetch(url);
    const data = (await resp.json()) as any[];
    if (data.length === 0) return;
    const info = data[0];
    const statusText = getJapaneseText(info['odpt:trainInformationText']);
    if (statusText && !statusText.includes('通常運行') && !statusText.includes('平常通り運転しています') && !statusText.toLowerCase().includes('normal')) {
      statusBanner.innerHTML = `⚠️ <strong>運行情報:</strong> ${statusText}`;
      statusBanner.classList.remove('hidden');
      statusBanner.classList.add('bg-red-600', 'text-white');
    }
  } catch (err) {
    console.error('運行状況取得エラー:', err);
  }
}

// --- UI rendering ---
function safeGetElement(id: string): HTMLElement | null {
  return document.getElementById(id);
}

async function renderBoard(): Promise<void> {
  if (!ODPT_API_KEY) {
    const inbound = safeGetElement('departures-inbound');
    const outbound = safeGetElement('departures-outbound');
    if (inbound) inbound.innerHTML = `<p class="text-center text-red-500 text-2xl pt-8">エラー: config.json に ODPT_API_KEY を設定してください。</p>`;
    if (outbound) outbound.innerHTML = `<p class="text-center text-red-500 text-2xl pt-8">エラー: config.json に ODPT_API_KEY を設定してください。</p>`;
    return;
  }

  if (typeof timetableIntervalId !== 'undefined') clearInterval(timetableIntervalId);
  if (typeof statusIntervalId !== 'undefined') clearInterval(statusIntervalId);

  const stationConfig = STATION_CONFIGS.find((c) => c.uri === currentConfig.stationUri);
  if (!stationConfig) {
    const hdr = safeGetElement('station-header');
    if (hdr) hdr.textContent = 'エラー: 駅が選択されていません';
    return;
  }

  const hdr = safeGetElement('station-header');
  if (hdr) hdr.textContent = stationConfig.name;

  const loadingHtml = `<p class="text-center text-2xl pt-8">時刻表を取得中...</p>`;
  const inContainer = safeGetElement('departures-inbound');
  const outContainer = safeGetElement('departures-outbound');
  if (inContainer) inContainer.innerHTML = loadingHtml;
  if (outContainer) outContainer.innerHTML = loadingHtml;
  const inHeader = safeGetElement('direction-inbound-header');
  const outHeader = safeGetElement('direction-outbound-header');
  if (inHeader) inHeader.textContent = INBOUND_FRIENDLY_NAME_JA;
  if (outHeader) outHeader.textContent = OUTBOUND_FRIENDLY_NAME_JA;

  const allDepartures = await fetchStationTimetable(stationConfig.uri);
  const now = new Date();
  const nowMinutes = timeToMinutes(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);

  const inboundTrains = allDepartures.filter((t) => t['odpt:railDirection'] === INBOUND_DIRECTION_URI && timeToMinutes(t['odpt:departureTime']) >= nowMinutes).slice(0, 10);
  const outboundTrains = allDepartures.filter((t) => t['odpt:railDirection'] === OUTBOUND_DIRECTION_URI && timeToMinutes(t['odpt:departureTime']) >= nowMinutes).slice(0, 10);

  renderDirection('inbound', inboundTrains);
  renderDirection('outbound', outboundTrains);
  await fetchStatus();

  timetableIntervalId = window.setInterval(async () => {
    const deps = await fetchStationTimetable(stationConfig.uri);
    const now2 = new Date();
    const nowMins = timeToMinutes(`${String(now2.getHours()).padStart(2, '0')}:${String(now2.getMinutes()).padStart(2, '0')}`);
    const inT = deps.filter((t) => t['odpt:railDirection'] === INBOUND_DIRECTION_URI && timeToMinutes(t['odpt:departureTime']) >= nowMins).slice(0, 10);
    const outT = deps.filter((t) => t['odpt:railDirection'] === OUTBOUND_DIRECTION_URI && timeToMinutes(t['odpt:departureTime']) >= nowMins).slice(0, 10);
    renderDirection('inbound', inT);
    renderDirection('outbound', outT);
  }, 150_000);

  statusIntervalId = window.setInterval(fetchStatus, 300_000);

  window.setInterval(updateClock, 1000);
  updateClock();
}

function renderDirection(directionId: 'inbound' | 'outbound', departures: TimetableObject[]): void {
  const container = safeGetElement(`departures-${directionId}`);
  if (!container) return;
  if (departures.length === 0) {
    container.innerHTML = `<p class="text-center text-2xl pt-8">本日の発車予定はありません。</p>`;
    return;
  }
  container.innerHTML = departures
    .map((train) => {
      const departureTime = train['odpt:departureTime'];
      const trainTypeUri = train['odpt:trainType'] || '';
      const destinationTitle = (train['odpt:destinationStation']?.[0]?.['dc:title']) || 'N/A';
      const trainType = TRAIN_TYPE_MAP[trainTypeUri] || { name: '不明', class: 'type-LOC' };
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

function updateClock(): void {
  const el = safeGetElement('time-header');
  if (!el) return;
  const now = new Date();
  el.textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

// --- Initialization & modal handlers ---
function loadConfigFromStorage(): void {
  const savedUri = localStorage.getItem('t2board_station_uri');
  const defaultStation = STATION_CONFIGS.find((c) => c.name === DEFAULT_STATION_NAME) || STATION_CONFIGS[0];
  let selectedStation = defaultStation;
  if (savedUri) {
    const found = STATION_CONFIGS.find((c) => c.uri === savedUri);
    if (found) selectedStation = found;
  } else if (STATION_CONFIGS.length > 0) {
    selectedStation = defaultStation || STATION_CONFIGS[0];
  }
  if (selectedStation) {
    currentConfig = { stationUri: selectedStation.uri, stationName: selectedStation.name };
  }
}

function setupModal(): void {
  const modal = safeGetElement('config-modal');
  const stationSelect = document.getElementById('station-select') as HTMLSelectElement | null;
  if (!modal || !stationSelect) return;
  stationSelect.innerHTML = STATION_CONFIGS
    .map((config) => `<option value="${config.uri}" ${config.uri === currentConfig.stationUri ? 'selected' : ''}>${config.name}</option>`)
    .join('');

  const settingsBtn = safeGetElement('settings-button');
  settingsBtn?.addEventListener('click', () => {
    stationSelect.value = currentConfig.stationUri || '';
    modal.classList.remove('hidden');
    modal.classList.add('flex', 'opacity-100');
  });

  const closeBtn = safeGetElement('close-modal');
  closeBtn?.addEventListener('click', () => {
    modal.classList.remove('flex', 'opacity-100');
    modal.classList.add('hidden');
  });

  const saveBtn = safeGetElement('save-settings');
  saveBtn?.addEventListener('click', () => {
    const newUri = stationSelect.value;
    localStorage.setItem('t2board_station_uri', newUri);
    loadConfigFromStorage();
    renderBoard();
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

async function loadLocalConfig(): Promise<void> {
  try {
    const resp = await fetch('./config.json', { cache: 'no-store' });
    if (!resp.ok) return;
    const cfg = (await resp.json()) as { ODPT_API_KEY?: string };
    if (cfg?.ODPT_API_KEY) ODPT_API_KEY = cfg.ODPT_API_KEY;
  } catch (err) {
    console.warn('Failed to load ./config.json:', err);
  }
}

async function initializeBoard(): Promise<void> {
  await loadLocalConfig();
  if (!ODPT_API_KEY) {
    const hdr = safeGetElement('station-header');
    if (hdr) hdr.textContent = '設定エラー: config.json に ODPT_API_KEY を設定してください';
    const inC = safeGetElement('departures-inbound');
    const outC = safeGetElement('departures-outbound');
    if (inC) inC.innerHTML = `<p class="text-center text-red-500 text-2xl pt-8">エラー: config.json に ODPT_API_KEY を設定してください。</p>`;
    if (outC) outC.innerHTML = `<p class="text-center text-red-500 text-2xl pt-8">エラー: config.json に ODPT_API_KEY を設定してください。</p>`;
    return;
  }

  await fetchRailwayStations();
  loadConfigFromStorage();
  setupModal();
  renderBoard();
}

// Expose to window for bootstrapping
(window as any).initializeBoard = initializeBoard;
window.onload = initializeBoard;

// --- trainboard.js ---
// Extracted from trainboard.html

// --- 1. CONFIGURATION AND CONSTANTS ---

// IMPORTANT: ODPT API key is loaded from ./config.json at runtime.
// Create a `config.json` (not checked into git) with the shape: { "ODPT_API_KEY": "your_key_here" }
// A sample is provided in `config.example.json`.
let ODPT_API_KEY = null;

// Base API URL
const API_BASE_URL = "https://api-challenge.odpt.org/api/v4/";

// Fixed URIs for Tokyu Toyoko Line
const TOKYU_TOYOKO_LINE_URI = "odpt.Railway:Tokyu.Toyoko";

// Fixed URIs for the two main directions (Inbound: towards Shibuya, Outbound: towards Yokohama)
const INBOUND_DIRECTION_URI = "odpt.RailDirection:Inbound";
const OUTBOUND_DIRECTION_URI = "odpt.RailDirection:Outbound";

// Japanese Friendly Names for directions
const INBOUND_FRIENDLY_NAME_JA = "渋谷・副都心線方面";
const OUTBOUND_FRIENDLY_NAME_JA = "横浜・元町中華街方面";


// Mappings for Train Types (using Japanese names for display and CSS classes)
const TRAIN_TYPE_MAP = {
    "odpt.TrainType:Tokyu.Local": { name: "各停", class: "type-LOC" }, // 東急の時刻表ではプレフィックスが必要
    "odpt.TrainType:Tokyu.Express": { name: "急行", class: "type-EXP" },
    "odpt.TrainType:Tokyu.CommuterExpress": { name: "通勤急行", class: "type-CEXP" },
    "odpt.TrainType:Tokyu.LimitedExpress": { name: "特急", class: "type-LE" },
    "odpt.TrainType:Tokyu.CommuterLimitedExpress": { name: "通勤特急", class: "type-CLE" },
    // プレフィックスなしのバージョンも念のため追加
    "odpt.TrainType:Local": { name: "各停", class: "type-LOC" }, 
    "odpt.TrainType:Express": { name: "急行", class: "type-EXP" }, 
    "odpt.TrainType:LimitedExpress": { name: "特急", class: "type-LE" },
};

// This will be populated dynamically by fetchRailwayStations
let STATION_CONFIGS = []; 
const DEFAULT_STATION_NAME = "武蔵小杉 (TY11)"; 

let currentConfig = {
    stationUri: null,
    stationName: null,
};

// Global interval IDs for cleanup
let timetableIntervalId;
let statusIntervalId;

// --- 2. UTILITY FUNCTIONS ---

/**
 * Safely extracts text from a JSON-LD language map, prioritizing Japanese.
 * @param {object} langMap - The JSON-LD language map (or a string for dc:title)
 * @returns {string} The Japanese text or the English text if Japanese is not available.
 */
function getJapaneseText(langMap) {
    if (!langMap) return "N/A";
    if (typeof langMap === 'string') return langMap;

    return langMap.ja || langMap.en || "N/A";
}

/**
 * 現在の日付に基づいて、東急東横線の運行ダイヤ（平日または土曜・休日）を特定します。
 * @returns {string} 適用されるカレンダーURI
 */
function getTodayCalendarURIs() {
    const day = new Date().getDay();
    // Mon=1 to Fri=5 (Weekday)
    if (day >= 1 && day <= 5) {
        return ["odpt.Calendar:Weekday"]; 
    }
    
    // Sat=6, Sun=0, or explicit Holiday: Treat as SaturdayHoliday
    // Note: We use an array for consistency with previous version, but only one is expected here.
    return [
        "odpt.Calendar:SaturdayHoliday"
    ];
}

/**
 * Converts ODPT time string (HH:MM) to minutes past midnight.
 * Used for finding the current train in the schedule.
 * @param {string} timeStr - Time in "HH:MM" format.
 * @returns {number} Minutes past midnight.
 */
function timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

/**
 * Robust fetch wrapper with exponential backoff for retries.
 */
async function apiFetch(url, retries = 3, delay = 1000) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url);

            if (!response.ok) {
                console.error(`Attempt ${i + 1}: HTTP Error Status: ${response.status} for URL: ${url}`);
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return response;
        } catch (error) {
            if (i === retries - 1) {
                throw error;
            }
            await new Promise(resolve => setTimeout(resolve, delay * (2 ** i)));
        }
    }
}

// --- 3. DATA FETCHING AND PROCESSING ---

/**
 * Fetches all station URIs and names for the Tokyu Toyoko Line to populate the settings modal.
 */
async function fetchRailwayStations() {
    const queryParams = new URLSearchParams({
        'acl:consumerKey': ODPT_API_KEY,
        'odpt:railway': TOKYU_TOYOKO_LINE_URI,
        'odpt:operator': 'odpt.Operator:Tokyu', // Filter only for Tokyu stations on the line
    });

    const apiUrl = `${API_BASE_URL}odpt:Station?${queryParams.toString()}`;

    try {
        const response = await apiFetch(apiUrl);
        const data = await response.json();
        
        // Build the STATION_CONFIGS array
        STATION_CONFIGS = data.map(station => {
            const stationNameJa = station['dc:title']; // ODPT station name is typically only Japanese here
            const stationCode = station['odpt:stationCode'] || '';
            return {
                name: `${stationNameJa} (${stationCode})`,
                uri: station['owl:sameAs'],
            };
        }).sort((a, b) => a.name.localeCompare(b.name, 'ja')); // Sort by Japanese name

    } catch (error) {
        console.error("Error fetching station list:", error);
        document.getElementById('station-header').textContent = "エラー: 駅リスト取得失敗";
    }
}

/**
 * Load local configuration from ./config.json (served alongside the static files).
 * This file should be gitignored in development to avoid committing secrets.
 */
async function loadLocalConfig() {
    try {
        const resp = await fetch('./config.json', { cache: 'no-store' });
        if (!resp.ok) {
            console.warn('No local config.json found (HTTP ' + resp.status + ')');
            return;
        }
        const cfg = await resp.json();
        if (cfg && cfg.ODPT_API_KEY) {
            ODPT_API_KEY = cfg.ODPT_API_KEY;
        }
    } catch (err) {
        console.warn('Failed to load ./config.json:', err);
    }
}


/**
 * Fetches timetable data for a specific station (all directions in one call).
 * @param {string} stationUri - ODPT URI for the station.
 * @returns {Promise<Array>} List of raw departure objects.
 */
async function fetchStationTimetable(stationUri) {
    const calendarURIs = getTodayCalendarURIs(); // Will contain only one URI now (Weekday or SaturdayHoliday)

    const queryParams = new URLSearchParams({
        'acl:consumerKey': ODPT_API_KEY,
        'odpt:railway': TOKYU_TOYOKO_LINE_URI,
        'odpt:station': stationUri,
    });

    const apiUrl = `${API_BASE_URL}odpt:StationTimetable?${queryParams.toString()}`;

    try {
        const response = await apiFetch(apiUrl); 
        const data = await response.json();

        if (data.length === 0) {
            console.warn(`No timetable objects returned for station ${stationUri}.`);
            return [];
        }
        
        let timetable = null;
        // 取得したデータの中から、今日適用されるカレンダーIDを持つ時刻表を抽出
        const expectedCalendarUri = calendarURIs[0]; 
        timetable = data.find(t => t['odpt:calendar'] === expectedCalendarUri);

        if (!timetable) {
            console.warn(`Timetable object found but no entry matched today's expected calendar: ${expectedCalendarUri}`);
            return [];
        }

        // 列車のリストはodpt:stationTimetableObjectに格納されている
        return timetable['odpt:stationTimetableObject'] || [];

    } catch (error) {
        console.error(`時刻表取得エラー (${stationUri}):`, error);
        return [];
    }
}
    
/**
 * Fetches real-time train status information for the line.
 */
async function fetchStatus() {
    const statusBanner = document.getElementById('status-banner');
    statusBanner.classList.add('hidden');
    statusBanner.innerHTML = '';

    const queryParams = new URLSearchParams({
        'acl:consumerKey': ODPT_API_KEY,
        'odpt:railway': TOKYU_TOYOKO_LINE_URI,
    });

    const apiUrl = `${API_BASE_URL}odpt:TrainInformation?${queryParams.toString()}`;

    try {
        const response = await apiFetch(apiUrl);
        const data = await response.json();

        if (data.length > 0) {
            const info = data[0];
            const statusTextMap = info['odpt:trainInformationText'];
            const statusText = getJapaneseText(statusTextMap);
            
            // Display status if it's NOT normal operation (checking multiple common phrases)
            if (statusText && 
                !statusText.includes("通常運行") && 
                !statusText.includes("平常通り運転しています") && 
                !statusText.toLowerCase().includes("normal")
            ) {
                statusBanner.innerHTML = `⚠️ **運行情報:** ${statusText}`;
                statusBanner.classList.remove('hidden');
                statusBanner.classList.add('bg-red-600', 'text-white'); 
            }
        }
    } catch (error) {
        console.error("運行状況取得エラー:", error);
    }
}


// --- 4. UI RENDERING ---

/**
 * Renders the entire departure board.
 */
async function renderBoard() {
    if (ODPT_API_KEY === "YOUR_ODPT_API_KEY_HERE") {
         document.getElementById('departures-inbound').innerHTML = `<p class="text-center text-red-500 text-2xl pt-8">エラー: スクリプトでODPT_API_KEYを設定してください。</p>`;
         document.getElementById('departures-outbound').innerHTML = `<p class="text-center text-red-500 text-2xl pt-8">エラー: スクリプトでODPT_API_KEYを設定してください。</p>`;
         return;
    }

    // 1. Clear intervals to reset board
    clearInterval(timetableIntervalId);
    clearInterval(statusIntervalId);

    // Find the current station configuration
    const stationConfig = STATION_CONFIGS.find(c => c.uri === currentConfig.stationUri);
    
    // Safety check for configuration
    if (!stationConfig) {
         document.getElementById('station-header').textContent = "エラー: 駅が選択されていません";
         return;
    }

    // 2. Update Header
    document.getElementById('station-header').textContent = stationConfig.name;
    
    // 3. Display Loading state
    const loadingHtml = `<p class="text-center text-2xl pt-8">時刻表を取得中...</p>`;
    document.getElementById('departures-inbound').innerHTML = loadingHtml;
    document.getElementById('departures-outbound').innerHTML = loadingHtml;
    document.getElementById('direction-inbound-header').textContent = INBOUND_FRIENDLY_NAME_JA;
    document.getElementById('direction-outbound-header').textContent = OUTBOUND_FRIENDLY_NAME_JA;


    // 4. Single Data Fetch
    const allDepartures = await fetchStationTimetable(stationConfig.uri);

    // 5. Client-side filtering and rendering
    // getHours/getMinutesを使って手動で時刻を構築 (堅牢性のため)
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const currentTimeStr = `${hours}:${minutes}`;
    const nowMinutes = timeToMinutes(currentTimeStr);
    console.log(allDepartures)
    // Filter, time-slice, and split by direction
    const inboundTrains = allDepartures
        .filter(train => train['odpt:railDirection'] === INBOUND_DIRECTION_URI)
        .filter(train => timeToMinutes(train['odpt:departureTime']) >= nowMinutes)
        .slice(0, 10);
    console.log(inboundTrains)
        
    const outboundTrains = allDepartures
        .filter(train => train['odpt:railDirection'] === OUTBOUND_DIRECTION_URI)
        .filter(train => timeToMinutes(train['odpt:departureTime']) >= nowMinutes)
        .slice(0, 10);

    // Render both directions
    renderDirection('inbound', inboundTrains);
    renderDirection('outbound', outboundTrains);
    
    // Fetch status
    await fetchStatus();


    // 6. Set up automatic refresh intervals
    timetableIntervalId = setInterval(async () => {
        const departures = await fetchStationTimetable(stationConfig.uri);
        
        // getHours/getMinutesを使って手動で時刻を構築 (堅牢性のため)
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const currentTimeStr = `${hours}:${minutes}`;
        const nowMins = timeToMinutes(currentTimeStr);

        const inTrains = departures.filter(train => train['odpt:railDirection'] === INBOUND_DIRECTION_URI && timeToMinutes(train['odpt:departureTime']) >= nowMins).slice(0, 10);
        const outTrains = departures.filter(train => train['odpt:railDirection'] === OUTBOUND_DIRECTION_URI && timeToMinutes(train['odpt:departureTime']) >= nowMins).slice(0, 10);

        renderDirection('inbound', inTrains);
        renderDirection('outbound', outTrains);
    }, 150000); // Timetable refresh every 2.5 min

    statusIntervalId = setInterval(fetchStatus, 300000); // Status refresh every 5 min
    
    // 7. Set up clock interval (only one needed)
    setInterval(updateClock, 1000); 
    updateClock();
}

/**
 * Renders data for a single direction panel.
 */
function renderDirection(directionId, departures) {
    const container = document.getElementById(`departures-${directionId}`);
    
    if (!container) return; 

    if (departures.length === 0) {
        container.innerHTML = `<p class="text-center text-2xl pt-8">本日の発車予定はありません。</p>`;
        return;
    }

    container.innerHTML = departures.map(train => {
        const departureTime = train['odpt:departureTime'];
        const trainTypeUri = train['odpt:trainType'];
        
        // Destination is an array of objects. We extract the dc:title (which is the station name string)
        const destinationTitleMap = train['odpt:destinationStation']?.[0]?.['dc:title']; 
        // Note: dc:title is usually just the Japanese string here, not a full language map.
        const destination = destinationTitleMap || "N/A";
        
        const trainType = TRAIN_TYPE_MAP[trainTypeUri] || { name: "不明", class: "type-LOC" };
        
        return `
            <div class="train-row">
                <div class="time-col">${departureTime}</div>
                <div class="flex justify-center items-center">
                    <span class="train-type-badge ${trainType.class}">${trainType.name}</span>
                </div>
                <div class="destination-text">${destination}行き</div>
            </div>
        `;
    }).join('');
}
    
/**
 * Updates the header clock display.
 */
function updateClock() {
    const now = new Date();
    // toLocaleTimeStringの代わりに、手動でパディングしてHH:MM形式を保証
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const timeStr = `${hours}:${minutes}`;

    document.getElementById('time-header').textContent = timeStr;
}


// --- 5. INITIALIZATION AND UI HANDLERS ---
    
/**
 * Loads configuration from localStorage or uses default if available.
 */
function loadConfig() {
    const savedUri = localStorage.getItem('t2board_station_uri');
    
    // Find a default station from the dynamically loaded list
    const defaultStation = STATION_CONFIGS.find(c => c.name === DEFAULT_STATION_NAME) || STATION_CONFIGS[0];

    let selectedStation = defaultStation;

    if (savedUri) {
        // If a saved URI exists, try to find it in the new list
        const found = STATION_CONFIGS.find(c => c.uri === savedUri);
        if (found) {
            selectedStation = found;
        }
    } else if (STATION_CONFIGS.length > 0) {
        // If no saved URI, use the first station if a default wasn't explicitly found
         selectedStation = defaultStation || STATION_CONFIGS[0];
    }


    if (selectedStation) {
        currentConfig = {
            stationUri: selectedStation.uri,
            stationName: selectedStation.name
        };
    }
}

/**
 * Sets up the configuration modal.
 */
function setupModal() {
    const modal = document.getElementById('config-modal');
    const stationSelect = document.getElementById('station-select');
    
    // Populate dropdown with dynamically fetched stations
    stationSelect.innerHTML = STATION_CONFIGS.map(config => 
        `<option value="${config.uri}" ${config.uri === currentConfig.stationUri ? 'selected' : ''}>
            ${config.name}
        </option>`
    ).join('');
    
    // Settings Button handler
    document.getElementById('settings-button').addEventListener('click', () => {
        stationSelect.value = currentConfig.stationUri;
        modal.classList.remove('hidden');
        modal.classList.add('flex', 'opacity-100');
    });
    
    // Close Button handler
    document.getElementById('close-modal').addEventListener('click', () => {
        modal.classList.remove('flex', 'opacity-100');
        modal.classList.add('hidden');
    });

    // Save Button handler
    document.getElementById('save-settings').addEventListener('click', () => {
        const newUri = stationSelect.value;
        localStorage.setItem('t2board_station_uri', newUri);
        
        // Reload configuration and board
        loadConfig();
        renderBoard();

        modal.classList.remove('flex', 'opacity-100');
        modal.classList.add('hidden');
    });
    
    // Close modal on outside click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('flex', 'opacity-100');
            modal.classList.add('hidden');
        }
    });
}
    
/**
 * Main initialization function
 */
async function initializeBoard() {
    // 0. Load local config (ODPT API key)
    await loadLocalConfig();

    // If no API key is configured, inform the user and stop further network calls.
    if (!ODPT_API_KEY || ODPT_API_KEY === 'YOUR_KEY_HERE') {
        document.getElementById('station-header').textContent = '設定エラー: config.json に ODPT_API_KEY を設定してください';
        document.getElementById('departures-inbound').innerHTML = `<p class="text-center text-red-500 text-2xl pt-8">エラー: config.json に ODPT_API_KEY を設定してください。</p>`;
        document.getElementById('departures-outbound').innerHTML = `<p class="text-center text-red-500 text-2xl pt-8">エラー: config.json に ODPT_API_KEY を設定してください。</p>`;
        return;
    }

    // 1. Fetch the list of all stations on the line
    await fetchRailwayStations();
    
    // 2. Load the current/default configuration based on the fetched list
    loadConfig();
    
    // 3. Set up the UI elements and handlers (modal)
    setupModal();
    
    // 4. Start the main board rendering loop
    renderBoard();
}


// --- MAIN EXECUTION ---
window.onload = initializeBoard;

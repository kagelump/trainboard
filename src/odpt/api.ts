// src/api.ts
// Small API client for ODPT endpoints used by the app. Functions are
// parameterized with apiKey and apiBaseUrl to avoid tight coupling.
import type {
  OdptStation,
  OdptStationTimetable,
  OdptTrainInformation,
  OdptRailway,
  OdptRailDirection,
  OdptTrainType,
} from './types';
import holidays from './data/holidays.json';

/**
 * Fetches data from a URL with automatic retry logic.
 * @param url - The URL to fetch
 * @param retries - Number of retry attempts (default: 3)
 * @param delay - Base delay in milliseconds between retries (default: 1000)
 * @returns Promise resolving to the Response object
 * @throws Error if all retry attempts fail
 */
export async function apiFetch(url: string, retries = 3, delay = 1000): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise((r) => setTimeout(r, delay * 2 ** i));
    }
  }
  throw new Error('Unreachable');
}

export async function fetchStationsList(
  apiKey: string | null,
  apiBaseUrl: string,
  railwayUri?: string,
): Promise<OdptStation[]> {
  if (!apiBaseUrl) {
    throw new Error('API base URL is required');
  }
  const params = new URLSearchParams();
  if (apiKey) params.set('acl:consumerKey', String(apiKey));
  if (railwayUri) params.append('odpt:railway', railwayUri);
  const url = `${apiBaseUrl}odpt:Station?${params.toString()}`;
  const resp = await apiFetch(url);
  return (await resp.json()) as OdptStation[];
}

export function calendarURI(): string {
  // Build YYYY-MM-DD for today's local date and check holidays.json first.
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const todayStr = `${yyyy}-${mm}-${dd}`;

  // holidays.json maps date strings (YYYY-MM-DD) to holiday names.
  if (Object.prototype.hasOwnProperty.call(holidays, todayStr)) {
    return 'odpt.Calendar:SaturdayHoliday';
  }

  const d = today.getDay();
  return d >= 1 && d <= 5 ? 'odpt.Calendar:Weekday' : 'odpt.Calendar:SaturdayHoliday';
}

export async function fetchStationTimetable(
  stationUri: string,
  apiKey: string | null,
  apiBaseUrl: string,
  railwayUri: string,
): Promise<OdptStationTimetable[]> {
  if (!apiBaseUrl || !stationUri || !railwayUri) {
    throw new Error('API base URL, station URI, and railway URI are required');
  }
  const params = new URLSearchParams();
  if (apiKey) params.set('acl:consumerKey', String(apiKey));
  params.set('odpt:railway', railwayUri);
  params.set('odpt:station', stationUri);
  params.set('odpt:calendar', calendarURI());
  const url = `${apiBaseUrl}odpt:StationTimetable?${params.toString()}`;
  const resp = await apiFetch(url);
  return (await resp.json()) as OdptStationTimetable[];
}

export async function fetchStatus(
  apiKey: string | null,
  apiBaseUrl: string,
  railwayUri: string,
): Promise<OdptTrainInformation[]> {
  if (!apiBaseUrl || !railwayUri) {
    throw new Error('API base URL and railway URI are required');
  }
  const params = new URLSearchParams();
  if (apiKey) params.set('acl:consumerKey', String(apiKey));
  params.set('odpt:railway', railwayUri);
  const url = `${apiBaseUrl}odpt:TrainInformation?${params.toString()}`;
  const resp = await apiFetch(url);
  return (await resp.json()) as OdptTrainInformation[];
}

export async function fetchStationsByUris(
  uris: string[],
  apiKey: string | null,
  apiBaseUrl: string,
): Promise<OdptStation[]> {
  if (!apiBaseUrl) {
    throw new Error('API base URL is required');
  }
  if (uris.length === 0) return [];
  // ODPT supports comma-separated OR filters; query owl:sameAs
  const params = new URLSearchParams();
  if (apiKey) params.set('acl:consumerKey', String(apiKey));
  params.append('owl:sameAs', uris.join(','));
  const url = `${apiBaseUrl}odpt:Station?${params.toString()}`;
  const resp = await apiFetch(url);
  return (await resp.json()) as OdptStation[];
}

export async function fetchRailways(
  apiKey: string | null,
  apiBaseUrl: string,
): Promise<OdptRailway[]> {
  if (!apiBaseUrl) {
    throw new Error('API base URL is required');
  }
  const params = new URLSearchParams();
  if (apiKey) params.set('acl:consumerKey', String(apiKey));
  const url = `${apiBaseUrl}odpt:Railway?${params.toString()}`;
  const resp = await apiFetch(url);
  return (await resp.json()) as OdptRailway[];
}

export async function fetchRailwayByUri(
  railwayUri: string,
  apiKey: string | null,
  apiBaseUrl: string,
): Promise<OdptRailway | null> {
  if (!apiBaseUrl || !railwayUri) {
    throw new Error('API base URL and railway URI are required');
  }
  const params = new URLSearchParams();
  if (apiKey) params.set('acl:consumerKey', String(apiKey));
  params.append('owl:sameAs', railwayUri);
  const url = `${apiBaseUrl}odpt:Railway?${params.toString()}`;
  const resp = await apiFetch(url);
  const data = (await resp.json()) as OdptRailway[];
  return data.length > 0 ? data[0] : null;
}

export async function fetchRailDirections(
  apiKey: string | null,
  apiBaseUrl: string,
): Promise<OdptRailDirection[]> {
  if (!apiBaseUrl) {
    throw new Error('API base URL is required');
  }
  const params = new URLSearchParams();
  if (apiKey) params.set('acl:consumerKey', String(apiKey));
  const url = `${apiBaseUrl}odpt:RailDirection?${params.toString()}`;
  const resp = await apiFetch(url);
  return (await resp.json()) as OdptRailDirection[];
}

export async function fetchTrainTypes(
  apiKey: string | null,
  apiBaseUrl: string,
): Promise<OdptTrainType[]> {
  if (!apiBaseUrl) {
    throw new Error('API base URL is required');
  }
  const params = new URLSearchParams();
  if (apiKey) params.set('acl:consumerKey', String(apiKey));
  const url = `${apiBaseUrl}odpt:TrainType?${params.toString()}`;
  const resp = await apiFetch(url);
  return (await resp.json()) as OdptTrainType[];
}

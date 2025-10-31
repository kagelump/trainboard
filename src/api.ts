// src/api.ts
// Small API client for ODPT endpoints used by the app. Functions are
// parameterized with apiKey and apiBaseUrl to avoid tight coupling.
import type { OdptStation, OdptStationTimetable, OdptTrainInformation } from './types';

export async function apiFetch(url: string, retries = 3, delay = 1000): Promise<Response> {
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
  throw new Error('Unreachable');
}

export async function fetchStationsList(
  apiKey: string,
  apiBaseUrl: string,
  railwayUri?: string,
): Promise<OdptStation[]> {
  const params = new URLSearchParams({ 'acl:consumerKey': String(apiKey) });
  if (railwayUri) params.append('odpt:railway', railwayUri);
  params.append('odpt:operator', 'odpt.Operator:Tokyu');
  const url = `${apiBaseUrl}odpt:Station?${params.toString()}`;
  const resp = await apiFetch(url);
  return (await resp.json()) as OdptStation[];
}

export async function fetchStationTimetable(
  stationUri: string,
  apiKey: string,
  apiBaseUrl: string,
): Promise<OdptStationTimetable[]> {
  const calendarURI = (() => {
    const d = new Date().getDay();
    return d >= 1 && d <= 5 ? 'odpt.Calendar:Weekday' : 'odpt.Calendar:SaturdayHoliday';
  })();
  const params = new URLSearchParams({
    'acl:consumerKey': String(apiKey),
    'odpt:railway': 'odpt.Railway:Tokyu.Toyoko',
    'odpt:station': stationUri,
    'odpt:calendar': calendarURI,
  });
  const url = `${apiBaseUrl}odpt:StationTimetable?${params.toString()}`;
  const resp = await apiFetch(url);
  return (await resp.json()) as OdptStationTimetable[];
}

export async function fetchStatus(apiKey: string, apiBaseUrl: string): Promise<any[]> {
  const params = new URLSearchParams({
    'acl:consumerKey': String(apiKey),
    'odpt:railway': 'odpt.Railway:Tokyu.Toyoko',
  });
  const url = `${apiBaseUrl}odpt:TrainInformation?${params.toString()}`;
  const resp = await apiFetch(url);
  return (await resp.json()) as OdptTrainInformation[];
}

export async function fetchStationsByUris(
  uris: string[],
  apiKey: string,
  apiBaseUrl: string,
): Promise<OdptStation[]> {
  if (uris.length === 0) return [];
  // ODPT supports comma-separated OR filters; query owl:sameAs
  const params = new URLSearchParams({ 'acl:consumerKey': String(apiKey) });
  params.append('owl:sameAs', uris.join(','));
  const url = `${apiBaseUrl}odpt:Station?${params.toString()}`;
  const resp = await apiFetch(url);
  return (await resp.json()) as OdptStation[];
}

// src/utils.ts
import type { OdptStationTimetable, StationTimetableEntry } from './types';

export function getJapaneseText(langMap: unknown): string {
  if (!langMap) return 'N/A';
  if (typeof langMap === 'string') return langMap;
  const map = langMap as Record<string, string>;
  return map.ja || map.en || 'N/A';
}

export function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map((v) => Number(v));
  return h * 60 + m;
}

export function getUpcomingDepartures(
  departuresData: OdptStationTimetable[],
  directionUri: string,
  nowMins: number,
  limit = 5,
): StationTimetableEntry[] {
  const timetable = departuresData.find((d) => (d as any)['odpt:railDirection'] === directionUri);
  const items = (timetable?.['odpt:stationTimetableObject'] ?? []) as StationTimetableEntry[];
  return items
    .filter((it) => typeof it['odpt:departureTime'] === 'string')
    .filter((it) => timeToMinutes(it['odpt:departureTime'] as string) >= nowMins)
    .slice(0, limit);
}

export function collectDestinationUris(...departureLists: StationTimetableEntry[][]): Set<string> {
  const s = new Set<string>();
  for (const list of departureLists) {
    for (const t of list ?? []) {
      const dests = (t as any)['odpt:destinationStation'];
      if (!dests) continue;
      if (Array.isArray(dests)) {
        for (const d of dests) {
          if (!d) continue;
          if (typeof d === 'string') s.add(d as string);
          else if (typeof d === 'object') {
            const maybeUri = (d as any)['owl:sameAs'] || (d as any)['@id'] || (d as any)['id'];
            if (maybeUri && typeof maybeUri === 'string') s.add(maybeUri);
          }
        }
      } else if (typeof dests === 'string') {
        s.add(dests as string);
      }
    }
  }
  return s;
}

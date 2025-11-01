// src/utils.ts
import type { OdptStationTimetable, StationTimetableEntry } from './types';

/**
 * Extracts Japanese text from a multilingual object or returns the string as-is.
 * @param langMap - An object with language keys (ja, en) or a plain string
 * @returns The Japanese text, English fallback, or 'N/A'
 */
export function getJapaneseText(langMap: unknown): string {
  if (!langMap) return 'N/A';
  if (typeof langMap === 'string') return langMap;
  const map = langMap as Record<string, string>;
  return map.ja || map.en || 'N/A';
}

/**
 * Converts a time string in HH:MM format to minutes since midnight.
 * @param timeStr - Time string in HH:MM format
 * @returns Total minutes since midnight
 */
export function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map((v) => Number(v));
  return h * 60 + m;
}

/**
 * Filters and returns upcoming departures for a specific direction.
 * @param departuresData - Array of station timetable data
 * @param directionUri - The URI of the rail direction to filter by
 * @param nowMins - Current time in minutes since midnight
 * @param limit - Maximum number of departures to return (default: 5)
 * @returns Array of upcoming departure entries
 */
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

/**
 * Collects all unique destination station URIs from multiple departure lists.
 * @param departureLists - Variable number of departure entry arrays to scan
 * @returns Set of unique destination station URIs
 */
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

/**
 * Formats the current time as HH:MM using zero-padded values.
 * @param date - The date to format (defaults to current time)
 * @returns Formatted time string in HH:MM format
 */
export function formatTimeHHMM(date: Date = new Date()): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

import type { StationTimetableEntry } from '../types';
import type { SimpleCache } from '../cache';

export class TrainDepartureView {
  departureTime: string;
  trainTypeUri: string;
  // We only care about one destination.  Maybe there are cases with multiple? idk.
  destination: string;

  /**
   * Construct a TrainDepartureView from a StationTimetableEntry.
   * @param entry Raw StationTimetableEntry from ODPT
   * @param stationNameCache Optional cache mapping station URIs to display names
   */
  constructor(entry: StationTimetableEntry, stationNameCache?: SimpleCache<string> | null) {
    this.departureTime = (entry['odpt:departureTime'] || '') as string;
    this.trainTypeUri = (entry['odpt:trainType'] || '') as string;

    // Resolve a human-friendly destination title. The API may return either
    // a string URI or an object with dc:title or owl:sameAs. Prefer the cached
    // station name when available.
    let destinationTitle = 'N/A';
    const dests = entry['odpt:destinationStation'];
    if (Array.isArray(dests) && dests.length > 0) {
      const first = dests[0];
      if (typeof first === 'string') {
        destinationTitle = (stationNameCache && stationNameCache.get(first)) || first;
      } else if (first && typeof first === 'object') {
        destinationTitle = (first as any)['dc:title'] || (first as any)['title'] || 'N/A';
        if ((destinationTitle === 'N/A' || !destinationTitle) && (first as any)['owl:sameAs']) {
          const uri = (first as any)['owl:sameAs'];
          if (typeof uri === 'string')
            destinationTitle = (stationNameCache && stationNameCache.get(uri)) || uri;
        }
      }
    } else if (typeof dests === 'string') {
      destinationTitle = (stationNameCache && stationNameCache.get(dests)) || dests;
    }

    this.destination = destinationTitle;
  }

  /**
   * Helper to create a view from an entry, used by callers that prefer a factory.
   */
  static from(entry: StationTimetableEntry, stationNameCache?: SimpleCache<string> | null) {
    return new TrainDepartureView(entry, stationNameCache);
  }
}

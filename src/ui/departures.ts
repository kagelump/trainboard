// src/ui/departures.ts
// Departure list rendering functions

import type { StationTimetableEntry } from '../odpt/types';
import type { SimpleCache } from '../lib/cache';
import type { DeparturesList } from './components/DeparturesList';
import { TrainDepartureView } from './components/TrainDepartureView';
import type { TrainDepartureView as TrainDepartureViewType } from './components/TrainDepartureView';
import type { TrainTypeMapEntry } from '../odpt/dataLoaders';

export function setLoadingState(): void {
  const inContainer = document.getElementById('departures-inbound') as HTMLElement;
  const outContainer = document.getElementById('departures-outbound') as HTMLElement;

  // Create or get DeparturesList components
  let inList = inContainer?.querySelector('departures-list') as DeparturesList;
  let outList = outContainer?.querySelector('departures-list') as DeparturesList;

  if (!inList) {
    inList = document.createElement('departures-list') as DeparturesList;
    if (inContainer) {
      inContainer.innerHTML = '';
      inContainer.appendChild(inList);
    }
  }

  if (!outList) {
    outList = document.createElement('departures-list') as DeparturesList;
    if (outContainer) {
      outContainer.innerHTML = '';
      outContainer.appendChild(outList);
    }
  }

  if (inList) inList.loading = true;
  if (outList) outList.loading = true;
}

export function setDirectionHeaders(inHeaderText: string, outHeaderText: string): void {
  const inHeader = document.getElementById('direction-inbound-header');
  const outHeader = document.getElementById('direction-outbound-header');
  if (inHeader) inHeader.textContent = `${inHeaderText}行き`;
  if (outHeader) outHeader.textContent = `${outHeaderText}行き`;
}

export function renderDirection(
  directionId: 'inbound' | 'outbound',
  departures: Array<StationTimetableEntry | TrainDepartureViewType>,
  stationNameCache: SimpleCache<string>,
  trainTypeMap: Record<string, TrainTypeMapEntry>,
  _options?: { autoUpdate?: boolean; [key: string]: any },
): void {
  console.log('Rendering departures for', directionId, 'with', departures.length, 'entries');
  const container = document.getElementById(`departures-${directionId}`) as HTMLElement;
  if (!container) return;

  // Create or get DeparturesList component
  let departuresList = container.querySelector('departures-list') as DeparturesList;

  if (!departuresList) {
    departuresList = document.createElement('departures-list') as DeparturesList;
    container.innerHTML = '';
    container.appendChild(departuresList);
  }

  // Normalize entries: callers may pass raw StationTimetableEntry objects or
  // already-constructed TrainDepartureView instances. Ensure the component
  // always receives TrainDepartureView instances.
  const views = departures.map((d) =>
    d instanceof TrainDepartureView
      ? d
      : new TrainDepartureView(d as StationTimetableEntry, stationNameCache),
  );
  departuresList.departures = views;
  departuresList.stationNameCache = stationNameCache;
  departuresList.trainTypeMap = trainTypeMap;
  departuresList.loading = false;
}

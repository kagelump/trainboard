// src/dataLoaders.ts
// Data loading and caching for ODPT API resources

import {
  fetchRailDirections,
  fetchTrainTypes,
  fetchRailwayByUri,
  fetchStationsByUris,
} from './api';
import type { OdptRailway, StationTimetableEntry, StationLite, StationConfig } from './types';
export type { StationConfig } from './types';
import { getJapaneseText, collectDestinationUris } from './utils';
import { SimpleCache } from './cache';
import { getTrainTypeCssClass } from './trainTypeStyles';
import { setPageTitle } from './ui';
import terminusData from './terminus.json';

// --- Types ---
// StationConfig is defined and exported from `src/types.ts`.

export type TrainTypeMapEntry = {
  name: string;
  class: string;
};

export type RailwayConfig = {
  uri: string;
  name: string;
  operator: string;
};

// --- Shared State ---
export let RAILWAY_CONFIGS: RailwayConfig[] = [];
export let currentRailway: OdptRailway | null = null;
export let INBOUND_DIRECTION_URI: string | null = null;
export let OUTBOUND_DIRECTION_URI: string | null = null;
export let INBOUND_FRIENDLY_NAME_JA = '渋谷・副都心線方面'; // fallback
export let OUTBOUND_FRIENDLY_NAME_JA = '横浜・元町中華街方面'; // fallback

// Terminus mapping loaded from static JSON (railway URI -> inbound/outbound labels)
export const TERMINUS_MAP: Record<string, { inbound: string; outbound: string }> =
  terminusData as unknown as Record<string, { inbound: string; outbound: string }>;

export const TRAIN_TYPE_MAP: Record<string, TrainTypeMapEntry> = {};
export const directionNameCache = new Map<string, string>();
export let STATION_CONFIGS: StationConfig[] = [];
export const stationNameCache = new SimpleCache<string>(500);

// --- Getters ---
export function getInboundDirectionUri(): string {
  return INBOUND_DIRECTION_URI || 'odpt.RailDirection:Inbound';
}

export function getOutboundDirectionUri(): string {
  return OUTBOUND_DIRECTION_URI || 'odpt.RailDirection:Outbound';
}

export function getInboundFriendlyName(): string {
  // Prefer terminus.json mapping for the currently selected railway if available
  try {
    const uri = currentRailway ? currentRailway['owl:sameAs'] || currentRailway['@id'] : null;
    if (uri && TERMINUS_MAP[uri] && TERMINUS_MAP[uri].inbound) return TERMINUS_MAP[uri].inbound;
  } catch {
    // ignore and fall back
  }
  return INBOUND_FRIENDLY_NAME_JA;
}

export function getOutboundFriendlyName(): string {
  // Prefer terminus.json mapping for the currently selected railway if available
  try {
    const uri = currentRailway ? currentRailway['owl:sameAs'] || currentRailway['@id'] : null;
    if (uri && TERMINUS_MAP[uri] && TERMINUS_MAP[uri].outbound) return TERMINUS_MAP[uri].outbound;
  } catch {
    // ignore and fall back
  }
  return OUTBOUND_FRIENDLY_NAME_JA;
}

export function getRailwayConfigs(): RailwayConfig[] {
  return RAILWAY_CONFIGS;
}

export function setRailwayConfigs(configs: RailwayConfig[]): void {
  RAILWAY_CONFIGS = configs;
}

export function getStationConfigs(): StationConfig[] {
  return STATION_CONFIGS;
}

// --- Data Loading Functions ---

/**
 * Loads rail direction names from ODPT API and populates the cache.
 */
export async function loadDirectionNames(apiKey: string | null, apiBaseUrl: string): Promise<void> {
  try {
    const directions = await fetchRailDirections(apiKey, apiBaseUrl);
    for (const dir of directions) {
      const uri = dir['owl:sameAs'] || dir['@id'];
      const name = getJapaneseText(dir['dc:title']);
      if (uri && typeof uri === 'string') {
        directionNameCache.set(uri, name);
      }
    }
  } catch (error) {
    console.warn('Failed to load direction names:', error);
  }
}

/**
 * Loads train type information from ODPT API and populates the train type map.
 */
export async function loadTrainTypes(apiKey: string | null, apiBaseUrl: string): Promise<void> {
  try {
    const trainTypes = await fetchTrainTypes(apiKey, apiBaseUrl);

    for (const tt of trainTypes) {
      const uri = tt['owl:sameAs'] || tt['@id'];

      // Skip entries without a valid URI
      if (!uri || typeof uri !== 'string') {
        continue;
      }

      const name = getJapaneseText(tt['dc:title']);

      // Skip entries without a name
      if (!name) {
        continue;
      }

      const cssClass = getTrainTypeCssClass(uri);
      TRAIN_TYPE_MAP[uri] = { name, class: cssClass };
    }

    console.log(`Loaded ${Object.keys(TRAIN_TYPE_MAP).length} train types`);
  } catch (error) {
    console.warn('Failed to load train types:', error);
  }
}

/**
 * Loads railway metadata and updates direction URIs and friendly names.
 * Also extracts station list from railway stationOrder.
 */
export async function loadRailwayMetadata(
  railwayUri: string,
  apiKey: string | null,
  apiBaseUrl: string,
): Promise<void> {
  try {
    const railway = await fetchRailwayByUri(railwayUri, apiKey, apiBaseUrl);
    if (!railway) {
      console.warn('Railway not found:', railwayUri);
      return;
    }
    currentRailway = railway;

    // Set direction URIs from railway metadata
    // Note: ODPT's ascending/descending is OPPOSITE of typical inbound/outbound convention
    // Ascending (上り) goes toward terminus, Descending (下り) goes away from terminus
    // But for display, we swap them to match user expectations
    INBOUND_DIRECTION_URI = railway['odpt:descendingRailDirection'] || 'odpt.RailDirection:Inbound';
    OUTBOUND_DIRECTION_URI =
      railway['odpt:ascendingRailDirection'] || 'odpt.RailDirection:Outbound';

    // Set friendly direction names
    if (INBOUND_DIRECTION_URI && directionNameCache.has(INBOUND_DIRECTION_URI)) {
      INBOUND_FRIENDLY_NAME_JA =
        directionNameCache.get(INBOUND_DIRECTION_URI) || INBOUND_FRIENDLY_NAME_JA;
    }
    if (OUTBOUND_DIRECTION_URI && directionNameCache.has(OUTBOUND_DIRECTION_URI)) {
      OUTBOUND_FRIENDLY_NAME_JA =
        directionNameCache.get(OUTBOUND_DIRECTION_URI) || OUTBOUND_FRIENDLY_NAME_JA;
    }

    // Extract stations from stationOrder
    const stationOrder = (railway['odpt:stationOrder'] || []) as StationLite[];
    STATION_CONFIGS = stationOrder
      .map((entry) => {
        const stationUri = entry['odpt:station'] || '';
        const stationTitle = entry['odpt:stationTitle'];
        const stationName = getJapaneseText(stationTitle);
        const index = entry['odpt:index'] || -1;
        return {
          name: stationName,
          uri: stationUri,
          index: index,
        } as StationConfig;
      })
      .filter((station) => station.uri && station.name !== 'N/A')
      .sort((a, b) => a.index - b.index);

    // Update page title
    const railwayName = getJapaneseText(railway['dc:title'] || railway['odpt:railwayTitle']);
    setPageTitle(`${railwayName} 発車案内板`);
  } catch (error) {
    console.warn('Failed to load railway metadata:', error);
  }
}

/**
 * Ensures station names are cached for all destination URIs in the given departure lists.
 * Fetches missing station names from ODPT API in a batch call.
 */
export async function ensureStationNamesForDepartures(
  apiKey: string | null,
  apiBaseUrl: string,
  ...departureLists: StationTimetableEntry[][]
): Promise<void> {
  const uris = collectDestinationUris(...departureLists);
  const missing = Array.from(uris).filter((u) => !stationNameCache.has(u));
  if (missing.length === 0) return;

  try {
    const stations = await fetchStationsByUris(missing, apiKey, apiBaseUrl);
    for (const station of stations) {
      const uri = station['owl:sameAs'] || station['@id'] || station['id'];
      const name = getJapaneseText(
        station['dc:title'] || station['odpt:stationTitle'] || station['title'],
      );
      if (uri && typeof uri === 'string') stationNameCache.set(uri, name);
    }
    for (const u of missing) {
      if (!stationNameCache.has(u)) stationNameCache.set(u, u);
    }
  } catch (error) {
    console.warn('Failed to fetch station names for destinations:', error);
  }
}

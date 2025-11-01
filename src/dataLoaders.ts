// src/dataLoaders.ts
// Data loading and caching for ODPT API resources

import {
  fetchRailDirections,
  fetchTrainTypes,
  fetchRailwayByUri,
  fetchStationsByUris,
  fetchStationsList,
} from './api';
import type { OdptRailway, StationTimetableEntry } from './types';
import { getJapaneseText, collectDestinationUris } from './utils';
import { SimpleCache } from './cache';
import { getTrainTypeCssClass } from './trainTypeStyles';
import { setPageTitle } from './ui';

// --- Types ---
export type StationConfig = {
  name: string;
  uri: string;
  code?: string;
};

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
  return INBOUND_FRIENDLY_NAME_JA;
}

export function getOutboundFriendlyName(): string {
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
export async function loadDirectionNames(apiKey: string, apiBaseUrl: string): Promise<void> {
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
    const message = error instanceof Error ? error.message : String(error);
    console.warn('Failed to load direction names:', message);
  }
}

/**
 * Loads train type information from ODPT API and populates the train type map.
 */
export async function loadTrainTypes(apiKey: string, apiBaseUrl: string): Promise<void> {
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
    const message = error instanceof Error ? error.message : String(error);
    console.warn('Failed to load train types:', message);
  }
}

/**
 * Loads railway metadata and updates direction URIs and friendly names.
 */
export async function loadRailwayMetadata(
  railwayUri: string,
  apiKey: string,
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
    INBOUND_DIRECTION_URI = railway['odpt:ascendingRailDirection'] || 'odpt.RailDirection:Inbound';
    OUTBOUND_DIRECTION_URI =
      railway['odpt:descendingRailDirection'] || 'odpt.RailDirection:Outbound';

    // Set friendly direction names
    if (INBOUND_DIRECTION_URI && directionNameCache.has(INBOUND_DIRECTION_URI)) {
      INBOUND_FRIENDLY_NAME_JA =
        directionNameCache.get(INBOUND_DIRECTION_URI) || INBOUND_FRIENDLY_NAME_JA;
    }
    if (OUTBOUND_DIRECTION_URI && directionNameCache.has(OUTBOUND_DIRECTION_URI)) {
      OUTBOUND_FRIENDLY_NAME_JA =
        directionNameCache.get(OUTBOUND_DIRECTION_URI) || OUTBOUND_FRIENDLY_NAME_JA;
    }

    // Update page title
    const railwayName = getJapaneseText(railway['dc:title'] || railway['odpt:railwayTitle']);
    setPageTitle(`${railwayName} 発車案内板`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('Failed to load railway metadata:', message);
  }
}

/**
 * Loads station list for a specific railway.
 */
export async function loadStationsForRailway(
  railwayUri: string,
  apiKey: string,
  apiBaseUrl: string,
): Promise<void> {
  try {
    const data = await fetchStationsList(apiKey, apiBaseUrl, railwayUri);
    STATION_CONFIGS = data
      .map((station) => {
        const stationNameJa = getJapaneseText(station['dc:title'] || station['odpt:stationTitle']);
        const stationCode = station['odpt:stationCode'] || '';
        return {
          name: stationCode ? `${stationNameJa} (${stationCode})` : stationNameJa,
          uri: station['owl:sameAs'] || '',
          code: stationCode,
        } as StationConfig;
      })
      .filter((s) => s.uri)
      .sort((a, b) => {
        // Sort by station code if both have codes
        if (a.code && b.code) {
          // Extract numeric part from codes like "TY11" -> 11
          const aMatch = a.code.match(/\d+/);
          const bMatch = b.code.match(/\d+/);
          if (aMatch && bMatch) {
            const aNum = parseInt(aMatch[0], 10);
            const bNum = parseInt(bMatch[0], 10);
            if (aNum !== bNum) return aNum - bNum;
          }
          // If numeric parts are equal or don't exist, sort by full code
          return a.code.localeCompare(b.code);
        }
        // If codes don't exist, sort by name
        return a.name.localeCompare(b.name, 'ja');
      });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error fetching station list:', message);
  }
}

/**
 * Ensures station names are cached for all destination URIs in the given departure lists.
 * Fetches missing station names from ODPT API in a batch call.
 */
export async function ensureStationNamesForDepartures(
  apiKey: string,
  apiBaseUrl: string,
  ...departureLists: StationTimetableEntry[][]
): Promise<void> {
  const uris = collectDestinationUris(...departureLists);
  const missing = Array.from(uris).filter((u) => !stationNameCache.has(u));
  if (missing.length === 0) return;

  try {
    const data = await fetchStationsByUris(missing, apiKey, apiBaseUrl);
    for (const station of data) {
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
    const message = error instanceof Error ? error.message : String(error);
    console.warn('Failed to fetch station names for destinations:', message);
  }
}

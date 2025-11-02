// src/routing.ts
// URL routing for railway and station selection

import type { StationConfig } from './types';

export type RailwayConfig = {
  uri: string;
  name: string;
  operator: string;
};

export interface RouteParams {
  railwayName: string | null;
  stationName: string | null;
}

/**
 * Parse the current URL path to extract railway and station names
 * Expected format: /railway/{railway name}/station/{station name}
 */
export function parseRouteFromUrl(): RouteParams {
  const path = window.location.pathname;
  const params: RouteParams = {
    railwayName: null,
    stationName: null,
  };

  // Match pattern: /railway/{railway}/station/{station}
  const match = path.match(/\/railway\/([^/]+)\/station\/([^/]+)/);
  if (match) {
    // URL decode the matched groups
    params.railwayName = decodeURIComponent(match[1]);
    params.stationName = decodeURIComponent(match[2]);
  }

  return params;
}

/**
 * Find a railway configuration by its name (case-insensitive match)
 */
export function findRailwayByName(
  railways: RailwayConfig[],
  railwayName: string,
): RailwayConfig | null {
  if (!railwayName) return null;
  
  // Try exact match first
  const exactMatch = railways.find((r) => r.name === railwayName);
  if (exactMatch) return exactMatch;
  
  // Try case-insensitive match
  const lowerName = railwayName.toLowerCase();
  return railways.find((r) => r.name.toLowerCase() === lowerName) || null;
}

/**
 * Find a station configuration by its name (case-insensitive match)
 */
export function findStationByName(
  stations: StationConfig[],
  stationName: string,
): StationConfig | null {
  if (!stationName) return null;
  
  // Try exact match first
  const exactMatch = stations.find((s) => s.name === stationName);
  if (exactMatch) return exactMatch;
  
  // Try case-insensitive match
  const lowerName = stationName.toLowerCase();
  return stations.find((s) => s.name.toLowerCase() === lowerName) || null;
}

/**
 * Update the browser URL without reloading the page
 * Format: /railway/{railway name}/station/{station name}
 */
export function updateUrl(railwayName: string | null, stationName: string | null): void {
  if (!railwayName || !stationName) {
    // If either is missing, navigate to root
    if (window.location.pathname !== '/') {
      window.history.pushState({}, '', '/');
    }
    return;
  }

  // Encode the names for URL safety
  const encodedRailway = encodeURIComponent(railwayName);
  const encodedStation = encodeURIComponent(stationName);
  const newPath = `/railway/${encodedRailway}/station/${encodedStation}`;

  // Only update if different from current path
  if (window.location.pathname !== newPath) {
    window.history.pushState({}, '', newPath);
  }
}

/**
 * Get railway and station names from their URIs
 */
export function getNamesFromUris(
  railwayUri: string | null,
  stationUri: string | null,
  railways: RailwayConfig[],
  stations: StationConfig[],
): { railwayName: string | null; stationName: string | null } {
  const railway = railwayUri ? railways.find((r) => r.uri === railwayUri) : null;
  const station = stationUri ? stations.find((s) => s.uri === stationUri) : null;

  return {
    railwayName: railway?.name || null,
    stationName: station?.name || null,
  };
}

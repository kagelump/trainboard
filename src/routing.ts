// src/routing.ts
// URL routing for railway and station selection

import type { StationConfig } from './types';
import type { RailwayConfig } from './dataLoaders';

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
 * Extract Latin name from ODPT URI
 * Example: "odpt.Railway:Tokyu.Toyoko" -> "Tokyu.Toyoko"
 *          "odpt.Station:JR-East.Yamanote.Tokyo" -> "JR-East.Yamanote.Tokyo"
 */
function extractLatinNameFromUri(uri: string): string | null {
  const match = uri.match(/^odpt\.[^:]+:(.+)$/);
  return match ? match[1] : null;
}

/**
 * Find a railway configuration by its name (case-insensitive match)
 * Supports:
 * - Full Japanese name: "東急東横線"
 * - Latin ODPT name: "Tokyu.Toyoko"
 * - Partial Latin name: "Toyoko"
 */
export function findRailwayByName(
  railways: RailwayConfig[],
  railwayName: string,
): RailwayConfig | null {
  if (!railwayName) return null;
  
  // Try exact match first
  const exactMatch = railways.find((r) => r.name === railwayName);
  if (exactMatch) return exactMatch;
  
  // Try case-insensitive match on Japanese name
  const lowerName = railwayName.toLowerCase();
  const nameMatch = railways.find((r) => r.name.toLowerCase() === lowerName);
  if (nameMatch) return nameMatch;
  
  // Try matching against Latin ODPT name (from URI)
  const uriMatch = railways.find((r) => {
    const latinName = extractLatinNameFromUri(r.uri);
    if (!latinName) return false;
    
    // Match full Latin name (case-insensitive)
    if (latinName.toLowerCase() === lowerName) return true;
    
    // Match partial Latin name (e.g., "Toyoko" matches "Tokyu.Toyoko")
    const parts = latinName.split('.');
    return parts.some((part) => part.toLowerCase() === lowerName);
  });
  
  return uriMatch || null;
}

/**
 * Find a station configuration by its name (case-insensitive match)
 * Supports:
 * - Full Japanese name with code: "武蔵小杉 (TY11)"
 * - Partial Japanese name: "武蔵小杉" or "横浜"
 * - Latin ODPT name: "JR-East.Yamanote.Tokyo"
 * - Partial Latin name: "MusashiKosugi" or "Tokyo"
 */
export function findStationByName(
  stations: StationConfig[],
  stationName: string,
): StationConfig | null {
  if (!stationName) return null;
  
  // Try exact match first
  const exactMatch = stations.find((s) => s.name === stationName);
  if (exactMatch) return exactMatch;
  
  // Try case-insensitive match on full name
  const lowerName = stationName.toLowerCase();
  const nameMatch = stations.find((s) => s.name.toLowerCase() === lowerName);
  if (nameMatch) return nameMatch;
  
  // Try substring match on Japanese name (e.g., "横浜" matches "横浜 (TY21)")
  const substringMatch = stations.find((s) => s.name.includes(stationName));
  if (substringMatch) return substringMatch;
  
  // Try case-insensitive substring match
  const lowerSubstringMatch = stations.find((s) =>
    s.name.toLowerCase().includes(lowerName),
  );
  if (lowerSubstringMatch) return lowerSubstringMatch;
  
  // Try matching against Latin ODPT name (from URI)
  const uriMatch = stations.find((s) => {
    const latinName = extractLatinNameFromUri(s.uri);
    if (!latinName) return false;
    
    // Match full Latin name (case-insensitive)
    if (latinName.toLowerCase() === lowerName) return true;
    
    // Match partial Latin name (e.g., "Tokyo" matches "JR-East.Yamanote.Tokyo")
    const parts = latinName.split('.');
    return parts.some((part) => part.toLowerCase() === lowerName);
  });
  
  return uriMatch || null;
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

// src/routing.ts
// URL routing for railway and station selection

import type { StationConfig } from './types';
import type { RailwayConfig } from './dataLoaders';

export interface RouteParams {
  railwayName: string | null;
  stationName: string | null;
}

/**
 * Get the base path for the application.
 * For GitHub Pages, this will be the repository name (e.g., '/trainboard/')
 * For local development, this will be '/'
 * 
 * The base path can be set via VITE_BASE_PATH environment variable,
 * otherwise it's auto-detected from the URL structure.
 */
export function getBasePath(): string {
  // Check if a base path was configured at build time
  if (typeof __APP_BASE_PATH__ !== 'undefined' && __APP_BASE_PATH__) {
    return __APP_BASE_PATH__;
  }
  
  // Auto-detect: Check if we're on GitHub Pages by looking at the URL pattern
  // GitHub Pages URLs look like: /repo-name/railway/... or /repo-name/
  const path = window.location.pathname;
  const segments = path.split('/').filter(s => s);
  
  // No segments means we're at root
  if (segments.length === 0) {
    return '';
  }
  
  // If the path starts with /railway, there's no base path
  if (segments[0] === 'railway') {
    return '';
  }
  
  // If the second segment is 'railway', the first is the base path
  // e.g., /trainboard/railway/... -> base is /trainboard
  if (segments.length >= 2 && segments[1] === 'railway') {
    return '/' + segments[0];
  }
  
  // If we only have one segment, treat it as the base path (repo root)
  // e.g., /trainboard/ or /trainboard
  // Note: This app only has two route types: / and /railway/.../station/...
  // Any single-segment path is assumed to be a GitHub Pages repo root.
  // If the app had other routes like /login or /about, this would need refinement.
  if (segments.length === 1) {
    return '/' + segments[0];
  }
  
  // For other paths, don't assume a base path
  // This prevents false positives like /some/random/path
  return '';
}

/**
 * Remove the base path from a pathname
 */
function removeBasePath(pathname: string, basePath: string): string {
  if (!basePath || basePath === '/') return pathname;
  if (pathname.startsWith(basePath)) {
    return pathname.slice(basePath.length) || '/';
  }
  return pathname;
}

/**
 * Add the base path to a pathname
 */
function addBasePath(pathname: string, basePath: string): string {
  if (!basePath || basePath === '/') return pathname;
  // Ensure no double slashes
  if (pathname.startsWith('/')) {
    return basePath + pathname;
  }
  return basePath + '/' + pathname;
}

/**
 * Parse the current URL path to extract railway and station names
 * Expected format: [basePath]/railway/{railway name}/station/{station name}
 */
export function parseRouteFromUrl(): RouteParams {
  const basePath = getBasePath();
  const fullPath = window.location.pathname;
  const path = removeBasePath(fullPath, basePath);
  
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
 * Format: [basePath]/railway/{railway name}/station/{station name}
 */
export function updateUrl(railwayName: string | null, stationName: string | null): void {
  const basePath = getBasePath();
  
  if (!railwayName || !stationName) {
    // If either is missing, navigate to root (with base path)
    const rootPath = basePath || '/';
    if (window.location.pathname !== rootPath) {
      window.history.pushState({}, '', rootPath);
    }
    return;
  }

  // Encode the names for URL safety
  const encodedRailway = encodeURIComponent(railwayName);
  const encodedStation = encodeURIComponent(stationName);
  const relativePath = `/railway/${encodedRailway}/station/${encodedStation}`;
  const newPath = addBasePath(relativePath, basePath);

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

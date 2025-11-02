// src/location.ts
// Geolocation utilities for finding nearby stations

import stationsData from './stations.json';

export interface StationFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
  properties: {
    'owl:sameAs': string;
    'odpt:stationTitle': {
      en?: string;
      ja?: string;
    };
    'odpt:operator': string;
    'odpt:railway': string;
  };
}

export interface NearbyStation {
  uri: string;
  name: string;
  railway: string;
  operator: string;
  distance: number; // in meters
  coordinates: [number, number];
}

/**
 * Calculate the Haversine distance between two coordinates in meters
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Get user's current position using the Geolocation API
 */
export function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    });
  });
}

/**
 * Find stations near a given location
 * @param lat User's latitude
 * @param lon User's longitude
 * @param maxResults Maximum number of results to return (default: 5)
 * @returns Array of nearby stations sorted by distance
 */
export function findNearbyStations(
  lat: number,
  lon: number,
  maxResults: number = 5,
): NearbyStation[] {
  const features = (stationsData as any).features as StationFeature[];

  const stationsWithDistance = features.map((feature) => {
    const [stationLon, stationLat] = feature.geometry.coordinates;
    const distance = calculateDistance(lat, lon, stationLat, stationLon);

    return {
      uri: feature.properties['owl:sameAs'],
      name:
        feature.properties['odpt:stationTitle'].ja ||
        feature.properties['odpt:stationTitle'].en ||
        'Unknown',
      railway: feature.properties['odpt:railway'],
      operator: feature.properties['odpt:operator'],
      distance,
      coordinates: feature.geometry.coordinates,
    };
  });

  // Sort by distance and return top results
  return stationsWithDistance.sort((a, b) => a.distance - b.distance).slice(0, maxResults);
}

/**
 * Format distance for display
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}

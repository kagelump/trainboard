// src/__tests__/location.test.ts
import { describe, it, expect } from 'vitest';
import { calculateDistance, formatDistance, findNearbyStations } from '../lib/location';

describe('location utilities', () => {
  describe('calculateDistance', () => {
    it('calculates distance between two points correctly', () => {
      // Distance between Tokyo Station and Shibuya Station (approx 7km)
      const tokyoLat = 35.681236;
      const tokyoLon = 139.767125;
      const shibuyaLat = 35.658034;
      const shibuyaLon = 139.701636;

      const distance = calculateDistance(tokyoLat, tokyoLon, shibuyaLat, shibuyaLon);

      // Should be roughly 7km (7000m), allow some margin
      expect(distance).toBeGreaterThan(6000);
      expect(distance).toBeLessThan(8000);
    });

    it('returns 0 for same coordinates', () => {
      const distance = calculateDistance(35.681236, 139.767125, 35.681236, 139.767125);
      expect(distance).toBe(0);
    });

    it('calculates distance for coordinates in different hemispheres', () => {
      // Tokyo and Sydney
      const tokyoLat = 35.681236;
      const tokyoLon = 139.767125;
      const sydneyLat = -33.86882;
      const sydneyLon = 151.20929;

      const distance = calculateDistance(tokyoLat, tokyoLon, sydneyLat, sydneyLon);

      // Should be roughly 7800km
      expect(distance).toBeGreaterThan(7000000);
      expect(distance).toBeLessThan(8500000);
    });
  });

  describe('formatDistance', () => {
    it('formats distances under 1000m correctly', () => {
      expect(formatDistance(0)).toBe('0m');
      expect(formatDistance(100)).toBe('100m');
      expect(formatDistance(500)).toBe('500m');
      expect(formatDistance(999)).toBe('999m');
    });

    it('formats distances 1000m and over in km', () => {
      expect(formatDistance(1000)).toBe('1.0km');
      expect(formatDistance(1500)).toBe('1.5km');
      expect(formatDistance(10000)).toBe('10.0km');
      expect(formatDistance(12345)).toBe('12.3km');
    });

    it('rounds meters to nearest integer', () => {
      expect(formatDistance(123.4)).toBe('123m');
      expect(formatDistance(123.6)).toBe('124m');
    });
  });

  describe('findNearbyStations', () => {
    it('finds stations near a given location', () => {
      // Test with coordinates near Tokyo Station
      const tokyoLat = 35.681236;
      const tokyoLon = 139.767125;

      const nearbyStations = findNearbyStations(tokyoLat, tokyoLon, 5);

      // Should return some stations
      expect(nearbyStations.length).toBeGreaterThan(0);
      expect(nearbyStations.length).toBeLessThanOrEqual(5);

      // Each station should have required properties
      nearbyStations.forEach((station) => {
        expect(station).toHaveProperty('uri');
        expect(station).toHaveProperty('name');
        expect(station).toHaveProperty('railway');
        expect(station).toHaveProperty('operator');
        expect(station).toHaveProperty('distance');
        expect(station).toHaveProperty('coordinates');
        expect(station.distance).toBeGreaterThanOrEqual(0);
      });
    });

    it('returns stations sorted by distance', () => {
      const tokyoLat = 35.681236;
      const tokyoLon = 139.767125;

      const nearbyStations = findNearbyStations(tokyoLat, tokyoLon, 10);

      // Verify sorting
      for (let i = 1; i < nearbyStations.length; i++) {
        expect(nearbyStations[i].distance).toBeGreaterThanOrEqual(nearbyStations[i - 1].distance);
      }
    });

    it('respects maxResults parameter', () => {
      const tokyoLat = 35.681236;
      const tokyoLon = 139.767125;

      const stations3 = findNearbyStations(tokyoLat, tokyoLon, 3);
      expect(stations3.length).toBeLessThanOrEqual(3);

      const stations10 = findNearbyStations(tokyoLat, tokyoLon, 10);
      expect(stations10.length).toBeLessThanOrEqual(10);
    });

    it('handles edge case coordinates', () => {
      // Test with coordinates far from any station (middle of ocean)
      const oceanLat = 0;
      const oceanLon = 0;

      const nearbyStations = findNearbyStations(oceanLat, oceanLon, 5);

      // Should still return results (the 5 closest, even if very far)
      expect(nearbyStations.length).toBeGreaterThan(0);
    });
  });
});

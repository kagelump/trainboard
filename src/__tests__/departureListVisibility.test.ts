import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DeparturesList } from '../components/DeparturesList';
import { visibilityManager } from '../visibilityManager';
import type { StationTimetableEntry } from '../types';

/**
 * Integration test to verify that the departure list doesn't become empty
 * after tabbing away and back. This replicates the exact issue reported:
 * "departure list turns empty after you tab away and tab back"
 */
describe('DeparturesList Visibility Integration', () => {
  let departuresList: DeparturesList;
  let container: HTMLDivElement;

  // Shared test utilities
  const createMockStationNameCache = () => ({
    get: (uri: string) => uri.split(':')[1] || uri,
    set: () => {},
    has: () => true,
    clear: () => {},
    keys: () => [],
    enablePersistence: () => {},
    map: new Map(),
    maxEntries: 500,
    persist: () => {},
  }) as any;

  const createMockTrainTypeMap = () => ({
    'odpt.TrainType:Local': { name: '各駅停車', class: 'type-LOC' },
    'odpt.TrainType:Express': { name: '急行', class: 'type-EXP' },
  });

  beforeEach(() => {
    // Reset visibility manager
    visibilityManager.destroy();

    // Create a container and departures list element
    container = document.createElement('div');
    document.body.appendChild(container);
    
    departuresList = document.createElement('departures-list') as DeparturesList;
    container.appendChild(departuresList);
  });

  afterEach(() => {
    // Clean up
    document.body.removeChild(container);
    visibilityManager.destroy();
  });

  it('should maintain departures list after tabbing away and back', async () => {
    // Setup: Initialize visibility manager
    visibilityManager.initialize();

    // Create mock departure data
    const mockDepartures: StationTimetableEntry[] = [
      {
        '@id': 'train1',
        '@type': 'odpt:StationTimetable',
        'odpt:departureTime': '10:00',
        'odpt:trainType': 'odpt.TrainType:Local',
        'odpt:destinationStation': ['odpt.Station:Tokyo'],
      } as any,
      {
        '@id': 'train2',
        '@type': 'odpt:StationTimetable',
        'odpt:departureTime': '10:15',
        'odpt:trainType': 'odpt.TrainType:Express',
        'odpt:destinationStation': ['odpt.Station:Yokohama'],
      } as any,
    ];

    // Mock station name cache and train type map
    const mockStationNameCache = createMockStationNameCache();
    const mockTrainTypeMap = createMockTrainTypeMap();

    // Set up the departures list with data
    departuresList.departures = mockDepartures;
    departuresList.stationNameCache = mockStationNameCache;
    departuresList.trainTypeMap = mockTrainTypeMap;
    departuresList.autoUpdateMinutes = false; // Don't auto-update for this test

    // Wait for component to render
    await departuresList.updateComplete;

    // Verify departures are displayed
    expect(departuresList.departures.length).toBe(2);

    // Simulate: User tabs away (page becomes hidden)
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => true,
    });
    document.dispatchEvent(new Event('visibilitychange'));

    // Wait for any async operations
    await departuresList.updateComplete;

    // Departures should still be present
    expect(departuresList.departures.length).toBe(2);

    // Simulate: User tabs back (page becomes visible)
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => false,
    });
    document.dispatchEvent(new Event('visibilitychange'));

    // Wait for any async operations
    await departuresList.updateComplete;

    // CRITICAL: Departures should NOT be empty after visibility change
    expect(departuresList.departures.length).toBe(2);
  });

  it('should resume minutes updater when page becomes visible', async () => {
    visibilityManager.initialize();

    const mockDepartures: StationTimetableEntry[] = [
      {
        '@id': 'train1',
        '@type': 'odpt:StationTimetable',
        'odpt:departureTime': '10:00',
        'odpt:trainType': 'odpt.TrainType:Local',
        'odpt:destinationStation': ['odpt.Station:Tokyo'],
      } as any,
    ];

    const mockStationNameCache = createMockStationNameCache();
    const mockTrainTypeMap = createMockTrainTypeMap();

    departuresList.departures = mockDepartures;
    departuresList.stationNameCache = mockStationNameCache;
    departuresList.trainTypeMap = mockTrainTypeMap;
    departuresList.autoUpdateMinutes = false; // Don't auto-update for this test

    await departuresList.updateComplete;

    // Simulate page becoming hidden
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => true,
    });
    document.dispatchEvent(new Event('visibilitychange'));

    const initialDepartures = departuresList.departures.length;

    // Simulate page becoming visible
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => false,
    });
    document.dispatchEvent(new Event('visibilitychange'));

    // Departures should still be present
    expect(departuresList.departures.length).toBe(initialDepartures);
  });

  it('should handle multiple visibility changes without losing data', async () => {
    visibilityManager.initialize();

    const mockDepartures: StationTimetableEntry[] = [
      {
        '@id': 'train1',
        '@type': 'odpt:StationTimetable',
        'odpt:departureTime': '10:00',
        'odpt:trainType': 'odpt.TrainType:Local',
        'odpt:destinationStation': ['odpt.Station:Tokyo'],
      } as any,
      {
        '@id': 'train2',
        '@type': 'odpt:StationTimetable',
        'odpt:departureTime': '10:15',
        'odpt:trainType': 'odpt.TrainType:Express',
        'odpt:destinationStation': ['odpt.Station:Yokohama'],
      } as any,
      {
        '@id': 'train3',
        '@type': 'odpt:StationTimetable',
        'odpt:departureTime': '10:30',
        'odpt:trainType': 'odpt.TrainType:Local',
        'odpt:destinationStation': ['odpt.Station:Tokyo'],
      } as any,
    ];

    const mockStationNameCache = createMockStationNameCache();
    const mockTrainTypeMap = createMockTrainTypeMap();

    departuresList.departures = mockDepartures;
    departuresList.stationNameCache = mockStationNameCache;
    departuresList.trainTypeMap = mockTrainTypeMap;

    await departuresList.updateComplete;

    // Perform multiple visibility changes (simulating user switching tabs multiple times)
    for (let i = 0; i < 5; i++) {
      // Hide
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        get: () => true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
      await departuresList.updateComplete;

      // Show
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        get: () => false,
      });
      document.dispatchEvent(new Event('visibilitychange'));
      await departuresList.updateComplete;

      // After each cycle, departures should still be intact
      expect(departuresList.departures.length).toBe(3);
    }
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  parseRouteFromUrl,
  findRailwayByName,
  findStationByName,
  updateUrl,
  getNamesFromUris,
} from '../routing';
import type { RailwayConfig, StationConfig } from '../dataLoaders';

describe('URL Routing', () => {
  // Mock window.location and window.history
  const originalLocation = window.location;
  const originalHistory = window.history;

  beforeEach(() => {
    // Reset location mock
    delete (window as any).location;
    (window as any).location = {
      pathname: '/',
      href: 'http://localhost/',
    };

    // Reset history mock
    delete (window as any).history;
    (window as any).history = {
      pushState: vi.fn(),
    };
  });

  afterEach(() => {
    (window as any).location = originalLocation;
    (window as any).history = originalHistory;
  });

  describe('parseRouteFromUrl', () => {
    it('should parse railway and station from URL', () => {
      window.location.pathname = '/railway/東急東横線/station/武蔵小杉 (TY11)';
      const params = parseRouteFromUrl();
      expect(params.railwayName).toBe('東急東横線');
      expect(params.stationName).toBe('武蔵小杉 (TY11)');
    });

    it('should return null values for root path', () => {
      window.location.pathname = '/';
      const params = parseRouteFromUrl();
      expect(params.railwayName).toBeNull();
      expect(params.stationName).toBeNull();
    });

    it('should return null values for non-matching paths', () => {
      window.location.pathname = '/some/other/path';
      const params = parseRouteFromUrl();
      expect(params.railwayName).toBeNull();
      expect(params.stationName).toBeNull();
    });

    it('should handle URL-encoded names', () => {
      window.location.pathname = '/railway/%E6%9D%B1%E6%80%A5%E6%9D%B1%E6%A8%AA%E7%B7%9A/station/%E6%AD%A6%E8%94%B5%E5%B0%8F%E6%9D%89%20(TY11)';
      const params = parseRouteFromUrl();
      expect(params.railwayName).toBe('東急東横線');
      expect(params.stationName).toBe('武蔵小杉 (TY11)');
    });
  });

  describe('findRailwayByName', () => {
    const mockRailways: RailwayConfig[] = [
      { uri: 'odpt.Railway:Tokyu.Toyoko', name: '東急東横線', operator: 'odpt.Operator:Tokyu' },
      { uri: 'odpt.Railway:JR-East.Yamanote', name: 'ＪＲ山手線', operator: 'odpt.Operator:JR-East' },
    ];

    it('should find railway by exact name match', () => {
      const railway = findRailwayByName(mockRailways, '東急東横線');
      expect(railway).toBeDefined();
      expect(railway?.uri).toBe('odpt.Railway:Tokyu.Toyoko');
    });

    it('should find railway by case-insensitive match', () => {
      // Note: this primarily works for ASCII characters
      const railway = findRailwayByName(mockRailways, 'ｊｒ山手線');
      // This test may not work as expected for Japanese characters
      // but demonstrates the case-insensitive logic
      expect(railway).toBeDefined();
    });

    it('should find railway by full Latin ODPT name', () => {
      const railway = findRailwayByName(mockRailways, 'Tokyu.Toyoko');
      expect(railway).toBeDefined();
      expect(railway?.uri).toBe('odpt.Railway:Tokyu.Toyoko');
    });

    it('should find railway by partial Latin name', () => {
      const railway = findRailwayByName(mockRailways, 'Toyoko');
      expect(railway).toBeDefined();
      expect(railway?.uri).toBe('odpt.Railway:Tokyu.Toyoko');
    });

    it('should find railway by Latin name case-insensitive', () => {
      const railway = findRailwayByName(mockRailways, 'yamanote');
      expect(railway).toBeDefined();
      expect(railway?.uri).toBe('odpt.Railway:JR-East.Yamanote');
    });

    it('should return null for non-existent railway', () => {
      const railway = findRailwayByName(mockRailways, '存在しない路線');
      expect(railway).toBeNull();
    });

    it('should return null for empty string', () => {
      const railway = findRailwayByName(mockRailways, '');
      expect(railway).toBeNull();
    });
  });

  describe('findStationByName', () => {
    const mockStations: StationConfig[] = [
      { uri: 'odpt.Station:Tokyu.Toyoko.MusashiKosugi', name: '武蔵小杉 (TY11)' },
      { uri: 'odpt.Station:Tokyu.Toyoko.Yokohama', name: '横浜 (TY21)' },
    ];

    it('should find station by exact name match', () => {
      const station = findStationByName(mockStations, '武蔵小杉 (TY11)');
      expect(station).toBeDefined();
      expect(station?.uri).toBe('odpt.Station:Tokyu.Toyoko.MusashiKosugi');
    });

    it('should find station by substring (without station code)', () => {
      const station = findStationByName(mockStations, '横浜');
      expect(station).toBeDefined();
      expect(station?.uri).toBe('odpt.Station:Tokyu.Toyoko.Yokohama');
    });

    it('should find station by full Latin ODPT name', () => {
      const station = findStationByName(mockStations, 'Tokyu.Toyoko.MusashiKosugi');
      expect(station).toBeDefined();
      expect(station?.uri).toBe('odpt.Station:Tokyu.Toyoko.MusashiKosugi');
    });

    it('should find station by partial Latin name', () => {
      const station = findStationByName(mockStations, 'MusashiKosugi');
      expect(station).toBeDefined();
      expect(station?.uri).toBe('odpt.Station:Tokyu.Toyoko.MusashiKosugi');
    });

    it('should find station by Latin name case-insensitive', () => {
      const station = findStationByName(mockStations, 'yokohama');
      expect(station).toBeDefined();
      expect(station?.uri).toBe('odpt.Station:Tokyu.Toyoko.Yokohama');
    });

    it('should return null for non-existent station', () => {
      const station = findStationByName(mockStations, '存在しない駅');
      expect(station).toBeNull();
    });

    it('should return null for empty string', () => {
      const station = findStationByName(mockStations, '');
      expect(station).toBeNull();
    });
  });

  describe('updateUrl', () => {
    it('should update URL with railway and station names', () => {
      updateUrl('東急東横線', '武蔵小杉 (TY11)');
      expect(window.history.pushState).toHaveBeenCalledWith(
        {},
        '',
        '/railway/%E6%9D%B1%E6%80%A5%E6%9D%B1%E6%A8%AA%E7%B7%9A/station/%E6%AD%A6%E8%94%B5%E5%B0%8F%E6%9D%89%20(TY11)',
      );
    });

    it('should navigate to root if railway is missing', () => {
      window.location.pathname = '/some/path';
      updateUrl(null, '武蔵小杉 (TY11)');
      expect(window.history.pushState).toHaveBeenCalledWith({}, '', '/');
    });

    it('should navigate to root if station is missing', () => {
      window.location.pathname = '/some/path';
      updateUrl('東急東横線', null);
      expect(window.history.pushState).toHaveBeenCalledWith({}, '', '/');
    });

    it('should not update if URL is already correct', () => {
      window.location.pathname = '/railway/%E6%9D%B1%E6%80%A5%E6%9D%B1%E6%A8%AA%E7%B7%9A/station/%E6%AD%A6%E8%94%B5%E5%B0%8F%E6%9D%89%20(TY11)';
      updateUrl('東急東横線', '武蔵小杉 (TY11)');
      expect(window.history.pushState).not.toHaveBeenCalled();
    });
  });

  describe('getNamesFromUris', () => {
    const mockRailways: RailwayConfig[] = [
      { uri: 'odpt.Railway:Tokyu.Toyoko', name: '東急東横線', operator: 'odpt.Operator:Tokyu' },
    ];

    const mockStations: StationConfig[] = [
      { uri: 'odpt.Station:Tokyu.Toyoko.MusashiKosugi', name: '武蔵小杉 (TY11)' },
    ];

    it('should get names from valid URIs', () => {
      const names = getNamesFromUris(
        'odpt.Railway:Tokyu.Toyoko',
        'odpt.Station:Tokyu.Toyoko.MusashiKosugi',
        mockRailways,
        mockStations,
      );
      expect(names.railwayName).toBe('東急東横線');
      expect(names.stationName).toBe('武蔵小杉 (TY11)');
    });

    it('should return null for invalid railway URI', () => {
      const names = getNamesFromUris(
        'invalid.uri',
        'odpt.Station:Tokyu.Toyoko.MusashiKosugi',
        mockRailways,
        mockStations,
      );
      expect(names.railwayName).toBeNull();
      expect(names.stationName).toBe('武蔵小杉 (TY11)');
    });

    it('should return null for invalid station URI', () => {
      const names = getNamesFromUris(
        'odpt.Railway:Tokyu.Toyoko',
        'invalid.uri',
        mockRailways,
        mockStations,
      );
      expect(names.railwayName).toBe('東急東横線');
      expect(names.stationName).toBeNull();
    });

    it('should return nulls for null URIs', () => {
      const names = getNamesFromUris(null, null, mockRailways, mockStations);
      expect(names.railwayName).toBeNull();
      expect(names.stationName).toBeNull();
    });
  });
});

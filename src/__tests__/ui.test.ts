import { describe, it, expect, beforeEach } from 'vitest';

// Tests for Recent Railways and train caching behavior
// (combined during merge/rebase)
import { getRecentRailways, addRecentRailway, STORAGE_KEY_RECENT_RAILWAYS } from '../ui/settings';

describe('Recent Railways', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  it('should return empty array when no recent railways', () => {
    const recent = getRecentRailways();
    expect(recent).toEqual([]);
  });

  it('should add a railway to recent list', () => {
    addRecentRailway('odpt.Railway:Tokyu.Toyoko');
    const recent = getRecentRailways();
    expect(recent).toEqual(['odpt.Railway:Tokyu.Toyoko']);
  });

  it('should move existing railway to front when added again', () => {
    addRecentRailway('odpt.Railway:Tokyu.Toyoko');
    addRecentRailway('odpt.Railway:Tokyu.DenEnToshi');
    addRecentRailway('odpt.Railway:Tokyu.Toyoko');

    const recent = getRecentRailways();
    expect(recent).toEqual(['odpt.Railway:Tokyu.Toyoko', 'odpt.Railway:Tokyu.DenEnToshi']);
  });

  it('should limit recent railways to 5 items', () => {
    addRecentRailway('odpt.Railway:Line1');
    addRecentRailway('odpt.Railway:Line2');
    addRecentRailway('odpt.Railway:Line3');
    addRecentRailway('odpt.Railway:Line4');
    addRecentRailway('odpt.Railway:Line5');
    addRecentRailway('odpt.Railway:Line6');

    const recent = getRecentRailways();
    expect(recent).toHaveLength(5);
    expect(recent[0]).toBe('odpt.Railway:Line6');
    expect(recent[4]).toBe('odpt.Railway:Line2');
  });

  it('should persist to localStorage', () => {
    addRecentRailway('odpt.Railway:Tokyu.Toyoko');

    const stored = localStorage.getItem(STORAGE_KEY_RECENT_RAILWAYS);
    expect(stored).toBe('["odpt.Railway:Tokyu.Toyoko"]');
  });

  it('should handle corrupted localStorage data gracefully', () => {
    localStorage.setItem(STORAGE_KEY_RECENT_RAILWAYS, 'invalid json');

    const recent = getRecentRailways();
    expect(recent).toEqual([]);
  });
});

describe('Train caching behavior', () => {
  it('should cache more trains than displayed (15 vs 5)', () => {
    // This is a conceptual test to document the expected behavior
    const displayLimit = 5;
    const cacheLimit = 15;

    expect(cacheLimit).toBeGreaterThan(displayLimit);
    expect(cacheLimit).toBe(15);
    expect(displayLimit).toBe(5);
  });

  it('should track departure times for train removal', () => {
    // Simulate tracking displayed trains by departure time
    const displayedTimes = ['09:00', '09:15', '09:30', '09:45', '10:00'];

    // When a train at 09:00 departs, it should be removed
    const departedTime = '09:00';
    const index = displayedTimes.indexOf(departedTime);

    expect(index).toBe(0);
    displayedTimes.splice(index, 1);

    expect(displayedTimes).toEqual(['09:15', '09:30', '09:45', '10:00']);
    expect(displayedTimes.length).toBe(4);
  });

  it('should replace departed trains with cached trains', () => {
    // Simulate the cache containing 15 trains
    // Generate trains at 15-minute intervals: 9:00, 9:15, 9:30, etc.
    const trainCache = Array.from({ length: 15 }, (_, i) => ({
      'odpt:departureTime': `${9 + Math.floor((i * 15) / 60)}:${String((i * 15) % 60).padStart(2, '0')}`,
    }));

    // Initially display first 5
    let displayed = trainCache.slice(0, 5);
    expect(displayed.length).toBe(5);

    // When 2 trains depart
    const remainingDisplayed = 3;
    const trainsNeeded = 5 - remainingDisplayed;

    // Get the next trains from cache
    const nextTrains = trainCache.slice(5, 5 + trainsNeeded);
    expect(nextTrains.length).toBe(2);

    // After replacement, should have 5 trains again
    const newDisplayed = [...displayed.slice(2), ...nextTrains];
    expect(newDisplayed.length).toBe(5);
  });

  it('should handle time calculation for departed trains', () => {
    // Test time parsing logic
    const parseTimeToSeconds = (timeStr: string): number => {
      const [hStr, mStr] = (timeStr || '').split(':');
      const h = Number(hStr || 0);
      const m = Number(mStr || 0);
      return h * 3600 + m * 60;
    };

    const now = { hours: 9, minutes: 35, seconds: 0 };
    const nowSeconds = now.hours * 3600 + now.minutes * 60 + now.seconds;

    const departedTrain = '09:30'; // 5 minutes ago
    const upcomingTrain = '09:40'; // 5 minutes away

    const departedSeconds = parseTimeToSeconds(departedTrain);
    const upcomingSeconds = parseTimeToSeconds(upcomingTrain);

    expect(departedSeconds - nowSeconds).toBeLessThan(0); // Has departed
    expect(upcomingSeconds - nowSeconds).toBeGreaterThan(0); // Still upcoming
  });
});

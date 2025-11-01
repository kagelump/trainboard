import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getRecentRailways,
  addRecentRailway,
  STORAGE_KEY_RECENT_RAILWAYS,
} from '../ui';

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
    expect(recent).toEqual([
      'odpt.Railway:Tokyu.Toyoko',
      'odpt.Railway:Tokyu.DenEnToshi',
    ]);
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

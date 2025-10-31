import { describe, it, expect } from 'vitest';
import { timeToMinutes, getUpcomingDepartures, collectDestinationUris } from '../utils';

describe('parsing utils', () => {
  it('timeToMinutes converts HH:MM to minutes since midnight', () => {
    expect(timeToMinutes('00:00')).toBe(0);
    expect(timeToMinutes('09:05')).toBe(9 * 60 + 5);
    expect(timeToMinutes('23:59')).toBe(23 * 60 + 59);
  });

  it('getUpcomingDepartures filters and limits by direction and time', () => {
    const sample: any[] = [
      {
        'odpt:railDirection': 'in',
        'odpt:stationTimetableObject': [
          { 'odpt:departureTime': '08:00' },
          { 'odpt:departureTime': '09:30' },
          { 'odpt:departureTime': '10:15' },
        ],
      },
      {
        'odpt:railDirection': 'out',
        'odpt:stationTimetableObject': [
          { 'odpt:departureTime': '09:00' },
          { 'odpt:departureTime': '09:45' },
        ],
      },
    ];

    const upcoming = getUpcomingDepartures(sample as any, 'in', 9 * 60);
    // should only include 09:30 and 10:15
    expect(upcoming.map((x) => x['odpt:departureTime'])).toEqual(['09:30', '10:15']);

    const out = getUpcomingDepartures(sample as any, 'out', 9 * 60);
    expect(out.map((x) => x['odpt:departureTime'])).toEqual(['09:00', '09:45']);
  });

  it('collectDestinationUris handles strings and object forms', () => {
    const a = [
      {
        'odpt:departureTime': '09:00',
        'odpt:destinationStation': ['urn:station:1', 'urn:station:2'],
      },
    ];
    const b = [
      {
        'odpt:departureTime': '09:10',
        'odpt:destinationStation': [{ 'owl:sameAs': 'urn:station:3', 'dc:title': '三' }],
      },
    ];
    const set = collectDestinationUris(a as any, b as any);
    expect(Array.from(set).sort()).toEqual(
      ['urn:station:1', 'urn:station:2', 'urn:station:3'].sort(),
    );
  });
});

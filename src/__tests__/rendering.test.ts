import { describe, it, expect, beforeEach } from 'vitest';
import { renderDirection, setLoadingState, setDirectionHeaders } from '../ui';
import { SimpleCache } from '../cache';
import type { StationTimetableEntry } from '../types';

describe('Train Row Rendering', () => {
  beforeEach(() => {
    // Setup DOM structure needed for tests
    document.body.innerHTML = `
      <div id="departures-inbound"></div>
      <div id="departures-outbound"></div>
      <div id="direction-inbound-header"></div>
      <div id="direction-outbound-header"></div>
    `;
  });

  it('should render empty state when no departures', () => {
    const stationNameCache = new SimpleCache<string>();
    const trainTypeMap = {};

    renderDirection('inbound', [], stationNameCache, trainTypeMap);

    const container = document.getElementById('departures-inbound');
    expect(container?.textContent).toContain('本日の発車予定はありません');
  });

  it('should render train rows with correct data', () => {
    const stationNameCache = new SimpleCache<string>();
    stationNameCache.set('odpt.Station:Tokyu.Toyoko.Shibuya', '渋谷');

    const trainTypeMap = {
      'odpt.TrainType:Tokyu.Express': { name: '急行', class: 'type-EXP' },
    };

    const departures: StationTimetableEntry[] = [
      {
        'odpt:departureTime': '09:30',
        'odpt:trainType': 'odpt.TrainType:Tokyu.Express',
        'odpt:destinationStation': ['odpt.Station:Tokyu.Toyoko.Shibuya'],
      } as any,
    ];

    renderDirection('inbound', departures, stationNameCache, trainTypeMap);

    const container = document.getElementById('departures-inbound');
    expect(container?.innerHTML).toContain('09:30');
    expect(container?.innerHTML).toContain('急行');
    expect(container?.innerHTML).toContain('渋谷');
    expect(container?.innerHTML).toContain('type-EXP');
  });

  it('should handle multiple train rows', () => {
    const stationNameCache = new SimpleCache<string>();
    stationNameCache.set('odpt.Station:Tokyu.Toyoko.Shibuya', '渋谷');
    stationNameCache.set('odpt.Station:Tokyu.Toyoko.Yokohama', '横浜');

    const trainTypeMap = {
      'odpt.TrainType:Tokyu.Express': { name: '急行', class: 'type-EXP' },
      'odpt.TrainType:Tokyu.Local': { name: '各停', class: 'type-LOC' },
    };

    const departures: StationTimetableEntry[] = [
      {
        'odpt:departureTime': '09:30',
        'odpt:trainType': 'odpt.TrainType:Tokyu.Express',
        'odpt:destinationStation': ['odpt.Station:Tokyu.Toyoko.Shibuya'],
      } as any,
      {
        'odpt:departureTime': '09:45',
        'odpt:trainType': 'odpt.TrainType:Tokyu.Local',
        'odpt:destinationStation': ['odpt.Station:Tokyu.Toyoko.Yokohama'],
      } as any,
    ];

    renderDirection('outbound', departures, stationNameCache, trainTypeMap);

    const container = document.getElementById('departures-outbound');
    const trainRows = container?.querySelectorAll('.train-row');
    expect(trainRows?.length).toBe(2);
  });

  it('should render train type badge with correct class', () => {
    const stationNameCache = new SimpleCache<string>();
    stationNameCache.set('odpt.Station:Test', 'テスト駅');

    const trainTypeMap = {
      'odpt.TrainType:Test.Limited': { name: '特急', class: 'type-LTD' },
    };

    const departures: StationTimetableEntry[] = [
      {
        'odpt:departureTime': '10:00',
        'odpt:trainType': 'odpt.TrainType:Test.Limited',
        'odpt:destinationStation': ['odpt.Station:Test'],
      } as any,
    ];

    renderDirection('inbound', departures, stationNameCache, trainTypeMap);

    const container = document.getElementById('departures-inbound');
    const badge = container?.querySelector('.train-type-badge');
    expect(badge?.classList.contains('type-LTD')).toBe(true);
    expect(badge?.textContent).toBe('特急');
  });

  it('should handle unknown train type', () => {
    const stationNameCache = new SimpleCache<string>();
    stationNameCache.set('odpt.Station:Test', 'テスト駅');

    const trainTypeMap = {};

    const departures: StationTimetableEntry[] = [
      {
        'odpt:departureTime': '10:00',
        'odpt:trainType': 'odpt.TrainType:Unknown',
        'odpt:destinationStation': ['odpt.Station:Test'],
      } as any,
    ];

    renderDirection('inbound', departures, stationNameCache, trainTypeMap);

    const container = document.getElementById('departures-inbound');
    expect(container?.innerHTML).toContain('不明');
    expect(container?.innerHTML).toContain('type-LOC');
  });
});

describe('UI State Rendering', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="departures-inbound"></div>
      <div id="departures-outbound"></div>
      <div id="direction-inbound-header"></div>
      <div id="direction-outbound-header"></div>
    `;
  });

  it('should set loading state', () => {
    setLoadingState();

    const inbound = document.getElementById('departures-inbound');
    const outbound = document.getElementById('departures-outbound');

    expect(inbound?.textContent).toContain('時刻表を取得中');
    expect(outbound?.textContent).toContain('時刻表を取得中');
  });

  it('should set direction headers', () => {
    setDirectionHeaders('渋谷', '横浜');

    const inHeader = document.getElementById('direction-inbound-header');
    const outHeader = document.getElementById('direction-outbound-header');

    expect(inHeader?.textContent).toBe('渋谷行き');
    expect(outHeader?.textContent).toBe('横浜行き');
  });
});

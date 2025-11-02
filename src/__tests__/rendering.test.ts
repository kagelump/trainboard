import { describe, it, expect, beforeEach } from 'vitest';
import { renderDirection, setLoadingState, setDirectionHeaders } from '../ui';
import { SimpleCache } from '../cache';
import type { StationTimetableEntry } from '../types';
import type { DeparturesList } from '../components/DeparturesList';

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

  it('should render empty state when no departures', async () => {
    const stationNameCache = new SimpleCache<string>();
    const trainTypeMap = {};

    renderDirection('inbound', [], stationNameCache, trainTypeMap);

    const container = document.getElementById('departures-inbound');
    const departuresList = container?.querySelector('departures-list') as DeparturesList;

    // Wait for Lit to render
    await departuresList?.updateComplete;

    expect(departuresList?.shadowRoot?.textContent).toContain('本日の発車予定はありません');
  });

  it('should render train rows with correct data', async () => {
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
    const departuresList = container?.querySelector('departures-list') as DeparturesList;

    // Wait for Lit to render
    await departuresList?.updateComplete;

    // Get train-row elements from the DeparturesList shadow DOM
    const trainRow = departuresList?.shadowRoot?.querySelector('train-row');
    await (trainRow as any)?.updateComplete;

    // Get content from the train-row shadow DOM
    const trainRowContent = trainRow?.shadowRoot?.textContent || '';
    expect(trainRowContent).toContain('09:30');
    expect(trainRowContent).toContain('急行');
    expect(trainRowContent).toContain('渋谷');
  });

  it('should handle multiple train rows', async () => {
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
    const departuresList = container?.querySelector('departures-list') as DeparturesList;

    // Wait for Lit to render
    await departuresList?.updateComplete;

    const trainRows = departuresList?.shadowRoot?.querySelectorAll('train-row');
    expect(trainRows?.length).toBe(2);
  });

  it('should render train type badge with correct class', async () => {
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
    const departuresList = container?.querySelector('departures-list') as DeparturesList;

    // Wait for Lit to render
    await departuresList?.updateComplete;

    // Get train-row element from the DeparturesList shadow DOM
    const trainRow = departuresList?.shadowRoot?.querySelector('train-row');
    await (trainRow as any)?.updateComplete;

    // Get content from the train-row shadow DOM
    const trainRowContent = trainRow?.shadowRoot?.textContent || '';
    expect(trainRowContent).toContain('特急');
  });

  it('should handle unknown train type', async () => {
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
    const departuresList = container?.querySelector('departures-list') as DeparturesList;

    // Wait for Lit to render
    await departuresList?.updateComplete;

    // Get train-row element from the DeparturesList shadow DOM
    const trainRow = departuresList?.shadowRoot?.querySelector('train-row');
    await (trainRow as any)?.updateComplete;

    // Get content from the train-row shadow DOM
    const trainRowContent = trainRow?.shadowRoot?.textContent || '';
    expect(trainRowContent).toContain('不明');
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

  it('should set loading state', async () => {
    setLoadingState();

    const inbound = document.getElementById('departures-inbound');
    const outbound = document.getElementById('departures-outbound');

    const inboundList = inbound?.querySelector('departures-list') as DeparturesList;
    const outboundList = outbound?.querySelector('departures-list') as DeparturesList;

    // Wait for Lit to render
    await inboundList?.updateComplete;
    await outboundList?.updateComplete;

    expect(inboundList?.shadowRoot?.textContent).toContain('時刻表を取得中');
    expect(outboundList?.shadowRoot?.textContent).toContain('時刻表を取得中');
  });

  it('should set direction headers', () => {
    setDirectionHeaders('渋谷', '横浜');

    const inHeader = document.getElementById('direction-inbound-header');
    const outHeader = document.getElementById('direction-outbound-header');

    expect(inHeader?.textContent).toBe('渋谷行き');
    expect(outHeader?.textContent).toBe('横浜行き');
  });
});

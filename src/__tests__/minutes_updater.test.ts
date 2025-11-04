import { describe, it, expect, beforeEach } from 'vitest';
import { renderDirection } from '../ui/departures';
import { SimpleCache } from '../lib/cache';
// Import components to register them
import '../ui/components/DeparturesList.js';
import '../ui/components/TrainRow.js';

beforeEach(() => {
  // Reset DOM between tests
  document.body.innerHTML = '';
});

describe('minutes updater initial run', () => {
  it('finds train-row elements when initial update is deferred', async () => {
    // Prepare containers
    const inContainer = document.createElement('div');
    inContainer.id = 'departures-inbound';
    const outContainer = document.createElement('div');
    outContainer.id = 'departures-outbound';
    document.body.appendChild(inContainer);
    document.body.appendChild(outContainer);

    // Prepare a small departures cache with one outbound train
    const departures = [
      {
        'odpt:departureTime': '12:34',
        'odpt:destinationStation': 'urn:station:1',
        'odpt:trainType': 'urn:trainType:EXP',
      },
    ];

    const stationNameCache = new SimpleCache<string>();
    stationNameCache.set('urn:station:1', 'Test Station');

    const trainTypeMap = {
      'urn:trainType:EXP': { name: 'Express', class: 'type-EXP' },
    };

    // Render the departures list (this creates the <departures-list> element
    // and sets its `departures` property which will render train-row children)
    renderDirection('outbound', departures as any, stationNameCache as any, trainTypeMap as any);

    // Render with autoUpdate enabled and an empty trainCache (no replacements needed)
    renderDirection('outbound', departures as any, stationNameCache as any, trainTypeMap as any, {
      autoUpdate: true,
    });

    // Wait for the departures-list to complete initial render
    const departuresList = outContainer.querySelector('departures-list') as HTMLElement | null;
    expect(departuresList).toBeTruthy();

    await (departuresList as any)?.updateComplete;

    const shadowRoot = (departuresList as any).shadowRoot;
    expect(shadowRoot).toBeTruthy();

    const trainRows = shadowRoot.querySelectorAll('train-row');
    expect(trainRows.length).toBeGreaterThan(0);

    // no cleanup required; component will clear interval on disconnect when dom is reset in next test
  }, 10000); // Increase timeout to 10 seconds
});

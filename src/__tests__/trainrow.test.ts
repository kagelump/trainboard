import { describe, it, expect } from 'vitest';
import '../components/TrainRow.js';
import { TrainRow } from '../components/TrainRow.js';

describe('TrainRow.updateMinutes', () => {
  it('shows 発車済 when train departed within 60 seconds', () => {
    const el = document.createElement('train-row') as any;
    // departure 09:00
    el.departureTime = '09:00';
    // now is 09:00:30 -> already departed
    const nowSeconds = 9 * 3600 + 0 * 60 + 30;
    // set the component time and use the public API
    el.nowSeconds = nowSeconds;
    // New behavior: a train is considered departed only if it's more than 60 seconds past
    // the departure time. At -30s we should NOT mark it departed, but show '発車済'.
    const departed = el.trainDeparted();
    expect(departed).toBe(false);
    expect(el.minutes()).toBe('発車済');
  });

  it('returns true when train departed more than 60 seconds ago', () => {
    const el = document.createElement('train-row') as any;
    // departure 09:00
    el.departureTime = '09:00';
    // now is 09:01:30 -> 90 seconds past departure
    const nowSeconds = 9 * 3600 + 1 * 60 + 30;
    el.nowSeconds = nowSeconds;
    const departed = el.trainDeparted();
    expect(departed).toBe(true);
  });

  it('shows 到着 when departure is within 60 seconds', () => {
    const el = document.createElement('train-row') as TrainRow;
    // departure 09:01
    el.departureTime = '09:01';
    // now is 09:00:30 -> 30s until departure
    const nowSeconds = 9 * 3600 + 0 * 60 + 30;
    el.nowSeconds = nowSeconds;
    const departed = el.trainDeparted();
    expect(departed).toBe(false);
    expect(el.minutes()).toBe('到着');
  });

  it('shows N分 for minutes > 1', () => {
    const el = document.createElement('train-row') as any;
    // departure 09:10
    el.departureTime = '09:10';
    // now is 09:00:00 -> 10 minutes
    const nowSeconds = 9 * 3600 + 0 * 60 + 0;
    el.nowSeconds = nowSeconds;
    const departed = el.trainDeparted();
    expect(departed).toBe(false);
    expect(el.minutes()).toBe('10分');
  });
});

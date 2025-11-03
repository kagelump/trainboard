import { test, expect } from 'vitest';
// Import the JSON directly (tsconfig.resolveJsonModule = true)
import holidays from '../holidays.json';

test('src/holidays.json is present and valid', () => {
  const data: Record<string, string> = holidays as unknown as Record<string, string>;

  expect(data).toBeTruthy();
  expect(typeof data).toBe('object');

  const keys = Object.keys(data);
  expect(keys.length).toBeGreaterThan(0);

  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  for (const k of keys) {
    expect(dateRe.test(k)).toBe(true);
    expect(typeof data[k]).toBe('string');
    expect(data[k].length).toBeGreaterThan(0);
  }
});

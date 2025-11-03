import { test, expect } from 'vitest';
import fs from 'fs';

test('src/holidays.json is present and valid', () => {
  const fileUrl = new URL('../holidays.json', import.meta.url);
  const exists = fs.existsSync(fileUrl);
  expect(exists).toBe(true);

  const raw = fs.readFileSync(fileUrl, 'utf8');
  const data = JSON.parse(raw);

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

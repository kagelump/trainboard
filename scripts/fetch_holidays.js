#!/usr/bin/env node
// Fetches Japanese holidays JSON and writes to src/holidays.json
// Requires Node 18+ for global `fetch`. If you need older Node support,
// install node-fetch and adapt accordingly.
const fs = require('fs').promises;
const path = require('path');

const URL = 'https://holidays-jp.github.io/api/v1/date.json';
const OUT_PATH = path.resolve(process.cwd(), 'src', 'odpt', 'data', 'holidays.json');

(async function main() {
  try {
    console.log('Fetching holidays from', URL);
    if (typeof fetch !== 'function') {
      throw new Error(
        'global fetch is not available. Please run with Node 18+ or install node-fetch.',
      );
    }

    const res = await fetch(URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);

    const data = await res.json();
    if (!data || typeof data !== 'object')
      throw new Error('Unexpected response shape: expected an object');

    const pretty = JSON.stringify(data, null, 2) + '\n';

    await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
    await fs.writeFile(OUT_PATH, pretty, 'utf8');

    console.log('Wrote', OUT_PATH);
  } catch (err) {
    console.error('Error fetching holidays:', err);
    process.exitCode = 1;
  }
})();

#!/usr/bin/env node
// capture-and-log.js
// Capture a screenshot using puppeteer-core and forward page console logs to stdout
// Usage: node capture-and-log.js <url> <outputPath> <width> <height>

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

async function findExecutable() {
  const candidates = [
    process.env.CHROMIUM_BIN,
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium-browser-stable',
    '/snap/bin/chromium',
  ].filter(Boolean);

  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch (e) {
      // ignore
    }
  }
  return null;
}

async function main() {
  const url = process.argv[2] || 'http://localhost:8080';
  const out = process.argv[3] || 'screenshot.png';
  const width = parseInt(process.argv[4] || '960', 10);
  const height = parseInt(process.argv[5] || '640', 10);

  const executablePath = await findExecutable();
  if (!executablePath) {
    console.error('[ERROR] Chromium executable not found. Set CHROMIUM_BIN or install chromium.');
    process.exit(2);
  }

  const browser = await puppeteer.launch({
    executablePath,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    defaultViewport: { width, height },
  });

  const page = await browser.newPage();

  page.on('console', async (msg) => {
    try {
      const args = await Promise.all(
        msg.args().map((a) => a.executionContext().evaluate((a) => a.toString(), a)),
      );
      console.log(`[PAGE ${msg.type().toUpperCase()}] ${args.join(' ')}`);
    } catch (e) {
      console.log(`[PAGE ${msg.type().toUpperCase()}] ${msg.text()}`);
    }
  });

  page.on('pageerror', (err) => {
    console.error('[PAGE ERROR]', err && err.stack ? err.stack : err);
  });

  page.on('requestfailed', (req) => {
    console.warn(
      `[REQUEST FAILED] ${req.method()} ${req.url()} (${req.failure() && req.failure().errorText})`,
    );
  });

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.screenshot({ path: out });
    console.log(`[CAPTURE] Screenshot saved to ${out}`);
    await browser.close();
    process.exit(0);
  } catch (err) {
    console.error('[ERROR] Capture failed:', err && err.stack ? err.stack : err);
    try {
      await browser.close();
    } catch (e) {}
    process.exit(1);
  }
}

main();

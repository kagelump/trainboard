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

  // Navigation timeout for page.goto (ms). Configurable via CAPTURE_TIMEOUT_MS.
  const NAV_TIMEOUT = parseInt(process.env.CAPTURE_TIMEOUT_MS || '60000', 10);
  console.log('[INFO] NAV_TIMEOUT (ms):', NAV_TIMEOUT);

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
    // Navigate to the page (stop when DOMContentLoaded) and then wait for
    // a render condition so we don't capture the initial "loading" state.
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });

    // Wait strategies (in order of preference):
    // 1) WAIT_FOR_SELECTOR - CSS selector that must appear in the DOM
    // 2) WAIT_FOR_FUNCTION - JS expression that must evaluate truthy in page context
    // 3) WAIT_AFTER_LOAD_MS - fixed delay after DOMContentLoaded (fallback)
    const WAIT_FOR_SELECTOR = process.env.WAIT_FOR_SELECTOR || '';
    const WAIT_FOR_FUNCTION = process.env.WAIT_FOR_FUNCTION || '';
    const WAIT_TIMEOUT = parseInt(process.env.WAIT_TIMEOUT_MS || '20000', 10);
    const WAIT_AFTER_LOAD_MS = parseInt(process.env.WAIT_AFTER_LOAD_MS || '5000', 10);

    if (WAIT_FOR_SELECTOR) {
      console.log('[INFO] Waiting for selector:', WAIT_FOR_SELECTOR, 'timeout(ms):', WAIT_TIMEOUT);
      await page.waitForSelector(WAIT_FOR_SELECTOR, { timeout: WAIT_TIMEOUT });
    } else if (WAIT_FOR_FUNCTION) {
      console.log('[INFO] Waiting for function:', WAIT_FOR_FUNCTION, 'timeout(ms):', WAIT_TIMEOUT);
      await page.waitForFunction(WAIT_FOR_FUNCTION, { timeout: WAIT_TIMEOUT });
    } else {
      console.log('[INFO] No wait condition provided; waiting fixed ms:', WAIT_AFTER_LOAD_MS);
      await page.waitForTimeout(WAIT_AFTER_LOAD_MS);
    }

    await page.screenshot({ path: out });
    console.log(`[CAPTURE] Screenshot saved to ${out}`);
    await browser.close();
    process.exit(0);
  } catch (err) {
    console.error('[ERROR] Capture failed:', err && err.stack ? err.stack : err);
    // On navigation timeout or other failures, save page HTML and a debug screenshot
    const ts = Date.now();
    const saveHtml = `/tmp/capture-${ts}.html`;
    const debugShot = `/tmp/capture-${ts}.png`;
    try {
      const content = await page.content();
      fs.writeFileSync(saveHtml, content, 'utf8');
      console.error('[DEBUG] Saved page HTML to', saveHtml);
      await page.screenshot({ path: debugShot, fullPage: true });
      console.error('[DEBUG] Saved debug screenshot to', debugShot);
    } catch (e) {
      console.error('[DEBUG] Failed to write debug artifacts:', e && e.stack ? e.stack : e);
    }
    try {
      await browser.close();
    } catch (e) {}
    process.exit(1);
  }
}

main();

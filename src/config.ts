// src/config.ts
// Configuration management for the trainboard application

import { STORAGE_KEY_API_KEY } from './ui';

// --- Configuration State ---
export let ODPT_API_KEY: string | null = null;
// Load compile-time defaults from defaults.json (committed). This file contains
// non-secret defaults such as API_BASE_URL and default selections. Secrets
// (API keys) should not be committed and are handled via the settings modal.
import defaults from '../defaults.json';

export let API_BASE_URL: string =
  (defaults && defaults.API_BASE_URL) ||
  'https://odpt-api-proxy.trainboard-odpt-proxy.workers.dev/';
export let DEFAULT_RAILWAY: string =
  (defaults && defaults.DEFAULT_RAILWAY) || 'odpt.Railway:Tokyu.Toyoko';
export let DEFAULT_STATION_NAME: string =
  (defaults && defaults.DEFAULT_STATION_NAME) || '武蔵小杉 (TY11)';

// Polling intervals (milliseconds)
export const TIMETABLE_REFRESH_INTERVAL_MS = 300_000; // 5 minutes
export const STATUS_REFRESH_INTERVAL_MS = 300_000; // 5 minutes
export const MINUTES_UPDATE_INTERVAL_MS = 15_000; // 15 seconds
export const CLOCK_UPDATE_INTERVAL_MS = 10_000; // 10 seconds

/**
 * Sets the ODPT API key.
 */
export function setApiKey(key: string | null): void {
  ODPT_API_KEY = key;
}

/**
 * Gets the current ODPT API key.
 */
export function getApiKey(): string | null {
  return ODPT_API_KEY;
}

/**
 * Gets the API base URL.
 */
export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

/**
 * Compile-time defaults are loaded from `defaults.json` (imported at build
 * time). This file is intended to contain non-secret defaults such as
 * `API_BASE_URL`, `DEFAULT_RAILWAY`, and `DEFAULT_STATION_NAME`.
 *
 * Do NOT store secret API keys in `defaults.json` if you want them to remain
 * private; use the Cloudflare proxy or the in-browser settings modal which
 * persists keys to `localStorage` instead.
 */
// Runtime fetching of config.json is removed. Defaults are compiled in via
// `defaults.json` (imported above). This keeps runtime logic deterministic and
// avoids needing a separate file to be served at the app root. Any user
// overrides should be made via the settings modal (localStorage) or via build
// time changes to `defaults.json`.
function loadFromLocalConfig(): Promise<void> {
  // No-op: defaults are provided at compile time.
  return Promise.resolve();
}

/**
 * Loads configuration from file and localStorage.
 * Note: API keys are NOT read from `defaults.json` (defaults are compile-time).
 * If present, localStorage will supply an API key via the settings modal
 * (preferred for development).
 */
export async function loadLocalConfig(): Promise<void> {
  await loadFromLocalConfig();
  // Allow user-supplied API key in localStorage (set via settings modal)
  try {
    const userKey = localStorage.getItem(STORAGE_KEY_API_KEY);
    if (userKey) {
      ODPT_API_KEY = userKey;
    }
  } catch (error) {
    // localStorage may be unavailable in some environments (e.g., private browsing)
    // Silent fail is acceptable here as it's a fallback mechanism
  }
}

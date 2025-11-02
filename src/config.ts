// src/config.ts
// Configuration management for the trainboard application

import { STORAGE_KEY_API_KEY } from './ui';

// --- Configuration State ---
export let ODPT_API_KEY: string | null = null;
export let API_BASE_URL = 'https://odpt-api-proxy.trainboard-odpt-proxy.workers.dev/';
export let DEFAULT_RAILWAY = 'odpt.Railway:Tokyu.Toyoko';
export let DEFAULT_STATION_NAME = '武蔵小杉 (TY11)';

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
 * Loads configuration from the ./config.json file.
 */
async function loadFromLocalConfig(): Promise<void> {
  try {
    const resp = await fetch('./config.json', { cache: 'no-store' });
    if (!resp.ok) return;
    const cfg = (await resp.json()) as {
      ODPT_API_KEY?: string;
      DEFAULT_RAILWAY?: string;
      DEFAULT_STATION_NAME?: string;
      API_BASE_URL?: string;
    };
    if (cfg?.ODPT_API_KEY) ODPT_API_KEY = cfg.ODPT_API_KEY;
    if (cfg?.DEFAULT_RAILWAY) DEFAULT_RAILWAY = cfg.DEFAULT_RAILWAY;
    if (cfg?.DEFAULT_STATION_NAME) DEFAULT_STATION_NAME = cfg.DEFAULT_STATION_NAME;
    if (cfg?.API_BASE_URL) API_BASE_URL = cfg.API_BASE_URL;
  } catch (error) {
    const e = error instanceof Error ? error : new Error(String(error));
    console.warn('Failed to load ./config.json:', e.message);
  }
}

/**
 * Loads configuration from file and localStorage.
 * LocalStorage API key takes precedence over config.json.
 */
export async function loadLocalConfig(): Promise<void> {
  await loadFromLocalConfig();
  // Allow user-supplied API key in localStorage to override config.json
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

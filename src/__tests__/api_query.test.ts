import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { fetchRailDirections } from '../api';

describe('API query string', () => {
  beforeEach(() => {
    // Mock fetch on globalThis to capture calls and return a minimal successful response
    (globalThis as any).fetch = vi.fn(async (input: any) => {
      return {
        ok: true,
        json: async () => [],
      } as any;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('omits acl:consumerKey when apiKey is null', async () => {
    await fetchRailDirections(null, 'https://example.com/');
    const calledUrl = (globalThis as any).fetch.mock.calls[0][0] as string;
    const url = new URL(calledUrl);
    expect(url.searchParams.has('acl:consumerKey')).toBe(false);
  });

  it('includes acl:consumerKey when apiKey provided', async () => {
    await fetchRailDirections('MYKEY', 'https://example.com/');
    const calledUrl = (globalThis as any).fetch.mock.calls[0][0] as string;
    const url = new URL(calledUrl);
    expect(url.searchParams.get('acl:consumerKey')).toBe('MYKEY');
  });
});

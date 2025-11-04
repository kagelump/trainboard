/**
 * Cloudflare Worker - ODPT API Proxy with MCP Server Layer
 *
 * This worker acts as a secure proxy for the ODPT (Open Data Challenge for Public Transportation)
 * API, protecting your API key from being exposed in the browser.
 *
 * Features:
 * - Securely stores ODPT API key as an environment variable
 * - Forwards requests from the trainboard app to ODPT API
 * - Adds CORS headers for browser compatibility
 * - Caches responses to reduce API calls and improve performance
 * - MCP (Model Context Protocol) server endpoints for AI/LLM integration
 *
 * Note: Basic rate limiting is provided by Cloudflare's infrastructure.
 * For advanced rate limiting, see the README for KV-based implementation examples.
 *
 * Environment Variables Required:
 * - ODPT_API_KEY: Your ODPT API key
 * - ALLOWED_ORIGINS: Comma-separated list of allowed origins (optional, defaults to all)
 * - CACHE_TTL: Cache time-to-live in seconds (optional, defaults to 60)
 */

// Configuration constants
const DEFAULT_CACHE_TTL = 3600; // 1 hour
const DEFAULT_API_BASE_URL = 'https://api-challenge.odpt.org/api/v4/';

// MCP resource definitions for ODPT train endpoints
const MCP_RESOURCES = [
  {
    uri: 'odpt://PassengerSurvey',
    name: 'odpt:PassengerSurvey',
    description: 'Passenger survey data for railway lines and stations',
    mimeType: 'application/json',
  },
  {
    uri: 'odpt://Railway',
    name: 'odpt:Railway',
    description: 'Railway line metadata including operators, stations, and line codes',
    mimeType: 'application/json',
  },
  {
    uri: 'odpt://RailDirection',
    name: 'odpt:RailDirection',
    description: 'Rail direction information (inbound/outbound, up/down)',
    mimeType: 'application/json',
  },
  {
    uri: 'odpt://RailwayFare',
    name: 'odpt:RailwayFare',
    description: 'Railway fare information between stations',
    mimeType: 'application/json',
  },
  {
    uri: 'odpt://Station',
    name: 'odpt:Station',
    description: 'Station metadata including location, codes, and railway associations',
    mimeType: 'application/json',
  },
  {
    uri: 'odpt://StationTimetable',
    name: 'odpt:StationTimetable',
    description: 'Station departure/arrival timetables by calendar and direction',
    mimeType: 'application/json',
  },
  {
    uri: 'odpt://Train',
    name: 'odpt:Train',
    description: 'Real-time train position and status information',
    mimeType: 'application/json',
  },
  {
    uri: 'odpt://TrainInformation',
    name: 'odpt:TrainInformation',
    description: 'Railway operation status and service disruption messages',
    mimeType: 'application/json',
  },
  {
    uri: 'odpt://TrainTimetable',
    name: 'odpt:TrainTimetable',
    description: 'Train-level timetables with scheduled stops and times',
    mimeType: 'application/json',
  },
  {
    uri: 'odpt://TrainType',
    name: 'odpt:TrainType',
    description: 'Train type classifications (express, local, limited express, etc.)',
    mimeType: 'application/json',
  },
];

/**
 * Main fetch event handler
 */
addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event));
});

/**
 * Handle incoming requests
 */
async function handleRequest(event) {
  const request = event.request;

  // Handle OPTIONS requests for CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(request),
    });
  }

  // Parse the request URL
  const url = new URL(request.url);

  // MCP endpoints support both GET and POST
  const isMcpEndpoint = url.pathname.startsWith('/mcp/');

  // Only allow GET requests (except for MCP endpoints which also support POST)
  if (request.method !== 'GET' && !(isMcpEndpoint && request.method === 'POST')) {
    return new Response('Method not allowed', {
      status: 405,
      headers: { Allow: isMcpEndpoint ? 'GET, POST, OPTIONS' : 'GET, OPTIONS' },
    });
  }

  try {
    // Parse the request URL
    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === '/health' || url.pathname === '/') {
      return new Response(
        JSON.stringify({
          status: 'healthy',
          service: 'ODPT API Proxy',
          version: '1.0.0',
          timestamp: new Date().toISOString(),
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...getCorsHeaders(request),
          },
        },
      );
    }

    // MCP resources/list endpoint
    if (url.pathname === '/mcp/resources/list') {
      return new Response(
        JSON.stringify({
          resources: MCP_RESOURCES,
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...getCorsHeaders(request),
          },
        },
      );
    }

    // MCP resources/get endpoint
    if (url.pathname === '/mcp/resources/get') {
      const resourceUri = url.searchParams.get('uri');

      if (!resourceUri) {
        return new Response(
          JSON.stringify({
            error: 'Missing resource URI',
            message: 'Please provide a "uri" query parameter',
            example: '/mcp/resources/get?uri=odpt://Station&odpt:railway=odpt.Railway:Tokyu.Toyoko',
          }),
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              ...getCorsHeaders(request),
            },
          },
        );
      }

      // Find the resource definition
      const resource = MCP_RESOURCES.find((r) => r.uri === resourceUri);

      if (!resource) {
        return new Response(
          JSON.stringify({
            error: 'Resource not found',
            message: `Resource with URI "${resourceUri}" not found`,
            availableResources: MCP_RESOURCES.map((r) => r.uri),
          }),
          {
            status: 404,
            headers: {
              'Content-Type': 'application/json',
              ...getCorsHeaders(request),
            },
          },
        );
      }

      // Extract ODPT endpoint name from resource
      const endpoint = resource.name;

      // Remove the 'uri' parameter and pass remaining params to ODPT API
      const odptParams = new URLSearchParams(url.searchParams);
      odptParams.delete('uri');

      // Build the ODPT API URL
      const apiUrl = buildApiUrl(endpoint, odptParams);

      // Try to get from cache first
      const cache = caches.default;
      let response = await cache.match(apiUrl);

      if (!response) {
        // Cache miss - fetch from ODPT API
        response = await fetchFromOdptApi(apiUrl);

        // Cache successful responses
        if (response.ok) {
          const cacheTtl = getCacheTtl(endpoint);
          const responseToCache = response.clone();
          const cacheHeaders = new Headers(responseToCache.headers);
          cacheHeaders.set('Cache-Control', `public, max-age=${cacheTtl}`);

          const cachedResponse = new Response(responseToCache.body, {
            status: responseToCache.status,
            statusText: responseToCache.statusText,
            headers: cacheHeaders,
          });

          event.waitUntil(cache.put(apiUrl, cachedResponse));
        }
      }

      // Return the ODPT API response with CORS headers
      const headers = new Headers(response.headers);
      Object.entries(getCorsHeaders(request)).forEach(([key, value]) => {
        headers.set(key, value);
      });

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    // MCP tools/list endpoint
    if (url.pathname === '/mcp/tools/list') {
      return new Response(
        JSON.stringify({
          tools: [
            {
              name: 'query_odpt_resource',
              description: 'Query ODPT train data resources with filtering parameters',
              inputSchema: {
                type: 'object',
                properties: {
                  resource: {
                    type: 'string',
                    description: 'The ODPT resource to query',
                    enum: MCP_RESOURCES.map((r) => r.name),
                  },
                  filters: {
                    type: 'object',
                    description: 'Query filters (e.g., odpt:railway, odpt:station)',
                    additionalProperties: true,
                  },
                },
                required: ['resource'],
              },
            },
          ],
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...getCorsHeaders(request),
          },
        },
      );
    }

    // Extract the ODPT endpoint from the path
    // Expected format: /odpt:Station, /odpt:Train, etc.
    const endpoint = url.pathname.substring(1); // Remove leading slash

    if (!endpoint || !endpoint.startsWith('odpt:')) {
      return new Response(
        JSON.stringify({
          error: 'Invalid endpoint',
          message: 'Endpoint must start with "odpt:"',
          example: '/odpt:Station?odpt:railway=odpt.Railway:Tokyu.Toyoko',
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...getCorsHeaders(request),
          },
        },
      );
    }

    // Build the ODPT API URL
    const apiUrl = buildApiUrl(endpoint, url.searchParams);

    // Try to get from cache first
    const cache = caches.default;
    let response = await cache.match(apiUrl);

    if (!response) {
      // Cache miss - fetch from ODPT API
      response = await fetchFromOdptApi(apiUrl);

      // Cache successful responses
      if (response.ok) {
        // Determine cache TTL based on endpoint. Live status (TrainInformation)
        // should be cached for a shorter period (5 minutes = 300s).
        const cacheTtl = getCacheTtl(endpoint);
        const responseToCache = response.clone();
        const cacheHeaders = new Headers(responseToCache.headers);
        cacheHeaders.set('Cache-Control', `public, max-age=${cacheTtl}`);

        const cachedResponse = new Response(responseToCache.body, {
          status: responseToCache.status,
          statusText: responseToCache.statusText,
          headers: cacheHeaders,
        });

        event.waitUntil(cache.put(apiUrl, cachedResponse));
      }
    }

    // Add CORS headers to the response
    const headers = new Headers(response.headers);
    Object.entries(getCorsHeaders(request)).forEach(([key, value]) => {
      headers.set(key, value);
    });

    // Return the response with CORS headers
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch (error) {
    console.error('Error handling request:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error.message,
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders(request),
        },
      },
    );
  }
}

/**
 * Build the ODPT API URL with API key
 */
function buildApiUrl(endpoint, searchParams) {
  const apiKey = ODPT_API_KEY;
  if (!apiKey) {
    throw new Error('ODPT_API_KEY environment variable not set');
  }

  const apiBaseUrl = DEFAULT_API_BASE_URL;
  const params = new URLSearchParams(searchParams);

  // Add the API key
  params.set('acl:consumerKey', apiKey);

  return `${apiBaseUrl}${endpoint}?${params.toString()}`;
}

/**
 * Fetch from ODPT API
 */
async function fetchFromOdptApi(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`ODPT API returned ${response.status}: ${response.statusText}`);
  }

  return response;
}

/**
 * Get CORS headers based on allowed origins
 */
function getCorsHeaders(request) {
  const origin = request.headers.get('Origin');
  const allowedOrigins = getAllowedOrigins();

  // Check if origin is allowed
  const isAllowed =
    allowedOrigins === '*' ||
    (origin && allowedOrigins.split(',').some((o) => o.trim() === origin));

  // MCP endpoints support POST, other endpoints are GET only
  const url = new URL(request.url);
  const isMcpEndpoint = url.pathname.startsWith('/mcp/');
  const allowedMethods = isMcpEndpoint ? 'GET, POST, OPTIONS' : 'GET, OPTIONS';

  return {
    'Access-Control-Allow-Origin': isAllowed ? (allowedOrigins === '*' ? '*' : origin) : 'null',
    'Access-Control-Allow-Methods': allowedMethods,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

/**
 * Get allowed origins from environment or default to all
 */
function getAllowedOrigins() {
  return typeof ALLOWED_ORIGINS !== 'undefined' && ALLOWED_ORIGINS ? ALLOWED_ORIGINS : '*';
}

/**
 * Get cache TTL from environment or use default
 */
function getCacheTtl() {
  // Backwards-compatible: accept optional endpoint argument to vary TTL per endpoint
  const args = Array.from(arguments);
  const endpoint = args.length > 0 ? args[0] : undefined;

  // If the caller indicates we're fetching live train status, use a shorter TTL
  if (typeof endpoint === 'string' && endpoint.startsWith('odpt:TrainInformation')) {
    return 300; // 5 minutes
  }

  return typeof CACHE_TTL !== 'undefined' && CACHE_TTL
    ? parseInt(CACHE_TTL, 10)
    : DEFAULT_CACHE_TTL;
}

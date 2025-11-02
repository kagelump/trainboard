# Cloudflare API Proxy for ODPT Trainboard

This directory contains scripts, utilities, and documentation for creating and managing a secure API proxy on Cloudflare Workers for the ODPT (Open Data Challenge for Public Transportation) API.

## Overview

The Cloudflare Worker acts as a secure proxy between your trainboard application and the ODPT API, providing several benefits:

- **Security**: Your ODPT API key is stored securely as a Cloudflare secret and never exposed to browser clients
- **Performance**: Responses are cached at Cloudflare's edge network, reducing API calls and improving load times
- **Rate Limiting**: Built-in protection against abuse
- **CORS Support**: Proper CORS headers for browser compatibility
- **Zero Server Cost**: Runs on Cloudflare's free tier (100,000 requests/day)

## Architecture

```
┌──────────┐        ┌──────────────────┐        ┌──────────────┐
│ Browser  │───────>│ Cloudflare Worker│───────>│  ODPT API    │
│ (Client) │        │   (API Proxy)    │        │              │
└──────────┘        └──────────────────┘        └──────────────┘
     │                       │                          │
     │                       │                          │
     └─── No API key ────────┼── Adds API key ─────────┘
          exposed            │   from secret
                             │
                        Caching & CORS
```

## Files

- **`worker.js`** - Cloudflare Worker script that handles proxy logic
- **`wrangler.toml.example`** - Template configuration for Wrangler CLI
- **`setup.sh`** - Interactive setup script for initial configuration
- **`deploy.sh`** - Deployment script for publishing the worker
- **`test.sh`** - Test script to verify the deployed worker is working correctly
- **`config.example.json`** - Example trainboard configuration for using the proxy
- **`README.md`** - This documentation file
- **`.gitignore`** - Prevents committing sensitive files like wrangler.toml

## Prerequisites

Before you begin, ensure you have:

1. **Cloudflare Account** (free tier works fine)
   - Sign up at [cloudflare.com](https://www.cloudflare.com/)
   - Note your Account ID from the dashboard

2. **ODPT API Key**
   - Sign up at [ODPT Developer Portal](https://developer.odpt.org/)
   - Get your API key (regular or challenge API)

3. **Node.js and npm** (v18 or later recommended)
   - Download from [nodejs.org](https://nodejs.org/)

## Quick Start

### Option 1: Automated Setup (Recommended)

Run the interactive setup script:

```bash
cd scripts/cloudflare
./setup.sh
```

This will:

1. Check for Node.js and install Wrangler CLI if needed
2. Authenticate with Cloudflare
3. Create `wrangler.toml` from template
4. Configure your Account ID
5. Set your ODPT API key as a secret

After setup completes, deploy:

```bash
./deploy.sh
```

### Option 2: Manual Setup

1. **Install Wrangler CLI**

```bash
npm install -g wrangler
```

2. **Authenticate with Cloudflare**

```bash
wrangler login
```

3. **Create Configuration File**

```bash
cp wrangler.toml.example wrangler.toml
```

4. **Edit `wrangler.toml`**

Update the following fields:

- `account_id` - Your Cloudflare Account ID (find at https://dash.cloudflare.com/)
- `name` - Worker name (optional, defaults to "odpt-api-proxy")

```toml
account_id = "your_actual_account_id_here"
name = "odpt-api-proxy"
```

5. **Set API Key Secret**

```bash
wrangler secret put ODPT_API_KEY
# Paste your ODPT API key when prompted
```

6. **Deploy the Worker**

```bash
wrangler deploy
```

## Configuration

### Environment Variables

The worker supports the following environment variables (set in `wrangler.toml`):

#### `ALLOWED_ORIGINS` (Optional)

Comma-separated list of allowed origins for CORS.

```toml
[vars]
ALLOWED_ORIGINS = "https://yourdomain.com,https://www.yourdomain.com"
```

Default: `"*"` (allow all origins)

#### `CACHE_TTL` (Optional)

Cache time-to-live in seconds.

```toml
[vars]
CACHE_TTL = "60"
```

Default: `60` seconds

### Secrets

#### `ODPT_API_KEY` (Required)

Your ODPT API key. This is stored securely and never exposed in code or configuration files.

Set it using:

```bash
wrangler secret put ODPT_API_KEY
```

## Usage

### Worker Endpoints

#### Health Check

Test that the worker is running:

```bash
curl https://odpt-api-proxy.YOUR-SUBDOMAIN.workers.dev/health
```

Response:

```json
{
  "status": "healthy",
  "service": "ODPT API Proxy",
  "version": "1.0.0",
  "timestamp": "2024-11-02T12:00:00.000Z"
}
```

#### ODPT API Proxy

Forward requests to ODPT API:

```
https://odpt-api-proxy.YOUR-SUBDOMAIN.workers.dev/{endpoint}?{params}
```

Examples:

```bash
# Get stations for a railway
curl "https://odpt-api-proxy.YOUR-SUBDOMAIN.workers.dev/odpt:Station?odpt:railway=odpt.Railway:Tokyu.Toyoko"

# Get station timetable
curl "https://odpt-api-proxy.YOUR-SUBDOMAIN.workers.dev/odpt:StationTimetable?odpt:station=odpt.Station:Tokyu.Toyoko.MusashiKosugi"

# Get real-time trains
curl "https://odpt-api-proxy.YOUR-SUBDOMAIN.workers.dev/odpt:Train?odpt:railway=odpt.Railway:Tokyu.Toyoko"
```

Integrating with Trainboard

Edit your project's `defaults.json` (compile-time defaults) to use the proxy:

```json
{
  "API_BASE_URL": "https://odpt-api-proxy.YOUR-SUBDOMAIN.workers.dev/",
  "DEFAULT_RAILWAY": "odpt.Railway:Tokyu.Toyoko",
  "DEFAULT_STATION_NAME": "武蔵小杉 (TY11)"
}
```

**Important**: Remove `ODPT_API_KEY` from `defaults.json` (do NOT commit private keys) — the proxy handles authentication now!

## Local Development

Test the worker locally before deploying:

```bash
wrangler dev
```

This starts a local server (usually at `http://localhost:8787`) where you can test the worker.

Test the local worker:

```bash
curl "http://localhost:8787/health"
curl "http://localhost:8787/odpt:Station?odpt:railway=odpt.Railway:Tokyu.Toyoko"
```

## Testing

### Automated Testing

After deploying, use the test script to verify the worker is functioning correctly:

```bash
./test.sh https://odpt-api-proxy.YOUR-SUBDOMAIN.workers.dev
```

This will:

- Test the health endpoint
- Verify error handling
- Make a real ODPT API request through the proxy
- Check CORS headers

### Manual Testing

Test individual endpoints:

```bash
# Health check
curl https://odpt-api-proxy.YOUR-SUBDOMAIN.workers.dev/health

# Get stations
curl "https://odpt-api-proxy.YOUR-SUBDOMAIN.workers.dev/odpt:Station?odpt:railway=odpt.Railway:Tokyu.Toyoko"

# Get station timetable
curl "https://odpt-api-proxy.YOUR-SUBDOMAIN.workers.dev/odpt:StationTimetable?odpt:station=odpt.Station:Tokyu.Toyoko.MusashiKosugi"
```

## Deployment

### Deploy to Production

```bash
./deploy.sh
```

Or manually:

```bash
wrangler deploy
```

### Deploy to Staging/Development

You can create multiple environments in `wrangler.toml`:

```toml
[env.staging]
name = "odpt-api-proxy-staging"
vars = { CACHE_TTL = "30" }

[env.development]
name = "odpt-api-proxy-dev"
vars = { CACHE_TTL = "10" }
```

Deploy to specific environment:

```bash
./deploy.sh staging
# or
wrangler deploy --env staging
```

## Monitoring and Logs

### View Logs

Real-time logs:

```bash
wrangler tail
```

Filter logs:

```bash
wrangler tail --status error
wrangler tail --search "odpt:Station"
```

### Check Worker Status

```bash
wrangler deployments list
```

### Analytics

View analytics in the Cloudflare dashboard:

1. Go to https://dash.cloudflare.com/
2. Navigate to Workers & Pages
3. Click on your worker
4. View the Analytics tab

## Security Best Practices

### Secrets Management

✅ **DO:**

- Store API keys using `wrangler secret put`
- Keep `wrangler.toml` in version control
- Use different API keys for different environments

❌ **DON'T:**

- Put API keys directly in `wrangler.toml`
- Commit `wrangler.toml` with actual account IDs to public repos
- Share secrets in plain text

### CORS Configuration

For production, restrict allowed origins:

```toml
[vars]
ALLOWED_ORIGINS = "https://yourdomain.com,https://yourapp.github.io"
```

### Rate Limiting

The worker includes basic rate limiting structure. For production apps with high traffic, consider:

1. **Cloudflare Workers KV** for distributed rate limiting
2. **Cloudflare Rate Limiting** rules in the dashboard
3. **Durable Objects** for accurate per-user rate limits

Example KV-based rate limiting (advanced):

```toml
[[kv_namespaces]]
binding = "RATE_LIMIT"
id = "your_kv_namespace_id"
```

## Troubleshooting

### Common Issues

#### "Error: No account_id found"

Make sure you've updated `wrangler.toml` with your actual Account ID:

```bash
wrangler whoami  # Get your account info
nano wrangler.toml  # Update account_id
```

#### "Error: 401 Unauthorized"

Your ODPT API key secret is not set or is invalid:

```bash
wrangler secret put ODPT_API_KEY
# Paste valid API key
```

#### "Worker not responding"

Check the worker logs:

```bash
wrangler tail
```

#### "CORS errors in browser"

Ensure `ALLOWED_ORIGINS` includes your domain, or set to `"*"` for testing:

```toml
[vars]
ALLOWED_ORIGINS = "*"
```

#### "Rate limit exceeded"

Cloudflare free tier limits:

- 100,000 requests per day
- 1,000 requests per minute

Upgrade to paid plan or optimize caching.

### Debug Mode

Enable detailed logging by adding console.log statements in `worker.js`:

```javascript
console.log('Request URL:', request.url);
console.log('API URL:', apiUrl);
```

View logs:

```bash
wrangler tail
```

## Cost and Limits

### Cloudflare Workers Free Tier

- **100,000 requests per day**
- **CPU time**: 10ms per request
- **Memory**: 128 MB
- **Bundled size**: 1 MB compressed

This is more than sufficient for personal trainboard deployments.

### Paid Plans

If you need more:

- **$5/month**: 10 million requests
- Additional requests: $0.50 per million

See [Cloudflare Workers Pricing](https://www.cloudflare.com/plans/developer-platform/)

## Advanced Features

### Custom Domains

Use your own domain instead of `.workers.dev`:

1. Add domain to Cloudflare
2. Update `wrangler.toml`:

```toml
[[routes]]
pattern = "api.yourdomain.com/*"
zone_name = "yourdomain.com"
```

3. Deploy:

```bash
wrangler deploy
```

### Multiple Environments

Create separate workers for dev/staging/production:

```toml
[env.production]
name = "odpt-api-proxy"
vars = { CACHE_TTL = "60" }

[env.staging]
name = "odpt-api-proxy-staging"
vars = { CACHE_TTL = "30" }
```

Deploy to each:

```bash
wrangler deploy --env production
wrangler deploy --env staging
```

### Enhanced Caching

Customize cache behavior in `worker.js`:

```javascript
// Cache for different durations based on endpoint
const CACHE_TTL_MAP = {
  'odpt:Station': 3600, // 1 hour (rarely changes)
  'odpt:StationTimetable': 3600, // 1 hour
  'odpt:Train': 30, // 30 seconds (real-time)
  'odpt:TrainInformation': 60, // 1 minute
};
```

### KV-Based Rate Limiting

For accurate rate limiting, use Workers KV:

1. Create KV namespace:

```bash
wrangler kv:namespace create "RATE_LIMIT"
```

2. Add to `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "RATE_LIMIT"
id = "your_kv_namespace_id"
```

3. Implement in `worker.js`:

```javascript
async function checkRateLimit(request) {
  const ip = request.headers.get('CF-Connecting-IP');
  const key = `ratelimit:${ip}`;
  const count = (await RATE_LIMIT.get(key)) || 0;

  if (count > MAX_REQUESTS_PER_MINUTE) {
    return new Response('Rate limit exceeded', { status: 429 });
  }

  await RATE_LIMIT.put(key, count + 1, { expirationTtl: 60 });
  return null;
}
```

## Updating the Worker

To update the worker after making changes:

1. Edit `worker.js`
2. Test locally:

```bash
wrangler dev
```

3. Deploy:

```bash
wrangler deploy
```

Changes take effect immediately.

## Deleting the Worker

To remove the worker:

```bash
wrangler delete
```

Or from the dashboard:

1. Go to Workers & Pages
2. Click on the worker
3. Settings → Delete

## Support and Resources

- **Cloudflare Workers Docs**: https://developers.cloudflare.com/workers/
- **Wrangler CLI Docs**: https://developers.cloudflare.com/workers/wrangler/
- **ODPT API Docs**: https://developer.odpt.org/
- **Trainboard Project**: See main [README.md](../../README.md)

## Contributing

Improvements to the proxy worker are welcome! Consider:

- Enhanced rate limiting
- Request/response transformation
- Additional security features
- Performance optimizations

## License

This worker script is part of the Trainboard project. Use and modify freely for your own ODPT API proxy needs.

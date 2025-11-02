# Example Configuration for Cloudflare API Proxy

This directory contains an example configuration file for using the Cloudflare Worker proxy with your trainboard application.

## Using config.example.json

After deploying the Cloudflare Worker (see [README.md](README.md)):

1. Copy `scripts/cloudflare/config.example.json` to the project root as `defaults.json` (compile-time defaults):

```bash
cp scripts/cloudflare/config.example.json defaults.json
```

2. Edit `defaults.json` and replace `YOUR-SUBDOMAIN` with your actual Cloudflare Workers subdomain:

```json
{
  "API_BASE_URL": "https://odpt-api-proxy.mysubdomain.workers.dev/",
  "DEFAULT_RAILWAY": "odpt.Railway:Tokyu.Toyoko",
  "DEFAULT_STATION_NAME": "武蔵小杉 (TY11)"
}
```

3. **Important**: Do NOT include `ODPT_API_KEY` in the config - the proxy handles authentication securely

## Benefits of Using the Proxy

- **Security**: API key is never exposed in browser
- **Performance**: Improved with edge caching at Cloudflare's CDN
- **Cost**: Free tier supports 100,000 requests/day
- **Rate Limiting**: Built-in protection against abuse

## Configuration Fields

- `API_BASE_URL`: Your Cloudflare Worker URL (must end with `/`)
- `DEFAULT_RAILWAY`: Default train line to display (optional)
- `DEFAULT_STATION_NAME`: Default station to display (optional)

## Finding Your Worker URL

After deploying with `./deploy.sh`, your worker URL will be displayed. It follows this format:

```
https://<worker-name>.<subdomain>.workers.dev
```

Where:

- `<worker-name>` is from `wrangler.toml` (default: `odpt-api-proxy`)
- `<subdomain>` is your Cloudflare account subdomain

You can also find it in your Cloudflare dashboard:

1. Go to https://dash.cloudflare.com/
2. Navigate to Workers & Pages
3. Click on your worker
4. Copy the URL shown at the top

## Switching Between Direct API and Proxy

### Using Proxy (Recommended for Production)

```json
{
  "API_BASE_URL": "https://odpt-api-proxy.YOUR-SUBDOMAIN.workers.dev/"
}
```

### Using Direct API (Development Only)

```json
{
  "ODPT_API_KEY": "your-api-key-here",
  "API_BASE_URL": "https://api-challenge.odpt.org/api/v4/"
}
```

## Troubleshooting

### "Failed to fetch" errors

Check that:

1. Worker is deployed and running: `curl https://odpt-api-proxy.YOUR-SUBDOMAIN.workers.dev/health`
2. API_BASE_URL ends with `/`
3. CORS is properly configured in the worker

### "401 Unauthorized" errors from ODPT API

The worker's ODPT_API_KEY secret may not be set correctly:

```bash
cd scripts/cloudflare
wrangler secret put ODPT_API_KEY
# Paste your valid ODPT API key
wrangler deploy  # Re-deploy to apply
```

## See Also

- [README.md](README.md) - Full Cloudflare proxy documentation
- [Main README](../../README.md) - Trainboard application documentation

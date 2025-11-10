# Direct Rendering Usage Examples

This document provides examples of how to use the new direct rendering feature.

## Basic Usage

Generate a departure board image using default configuration:

```bash
node scripts/rpi-eink/render-to-image.js /tmp/trainboard.png
```

This will:
1. Load configuration from `defaults.json`
2. Fetch train data from the ODPT API
3. Render the departure board to `/tmp/trainboard.png` (960x640)

## Custom Dimensions

Generate an image with custom dimensions:

```bash
node scripts/rpi-eink/render-to-image.js /tmp/trainboard.png 1200 800
```

This creates a 1200x800 image instead of the default 960x640.

## Custom Configuration

Create a custom config file:

```json
{
  "DEFAULT_RAILWAY": "odpt.Railway:Tokyu.DenEnToshi",
  "DEFAULT_STATION_NAME": "渋谷",
  "API_BASE_URL": "https://api-challenge.odpt.org/api/v4/",
  "API_KEY": "your-api-key-here"
}
```

Use it:

```bash
node scripts/rpi-eink/render-to-image.js /tmp/trainboard.png 960 640 custom-config.json
```

## Using Environment Variables

Set the API key via environment variable:

```bash
export ODPT_API_KEY="your-api-key"
node scripts/rpi-eink/render-to-image.js /tmp/trainboard.png
```

## Integration with update-display.sh

The `update-display.sh` script automatically uses direct rendering if available:

```bash
# This will try direct rendering first, then fall back to browser if needed
~/trainboard/scripts/rpi-eink/update-display.sh
```

## Troubleshooting

### Canvas module not found

If you get an error about canvas not being installed:

```bash
cd ~/trainboard
npm install canvas
```

### API errors

Check your API configuration:

```bash
# View current config
cat ~/trainboard/defaults.json

# Test API access
curl "https://api-challenge.odpt.org/api/v4/odpt:Railway?acl:consumerKey=YOUR_KEY" | head
```

### Network issues

Ensure your Raspberry Pi can reach the API:

```bash
ping -c 3 api-challenge.odpt.org
```

## Performance Tips

1. **Use a proxy**: Deploy the Cloudflare API proxy to reduce latency
2. **Cache images**: The renderer is fast, but caching the last image can help during API outages
3. **Adjust update frequency**: For e-ink displays, updating every 2-5 minutes is usually sufficient

## Comparison with Browser-based Rendering

| Feature | Direct Rendering | Browser-based |
|---------|-----------------|---------------|
| Speed | 2-3 seconds | 20-30 seconds |
| Memory | ~50MB | ~500MB |
| Reliability | High | Medium |
| Setup | npm install canvas | chromium + xvfb |
| Fallback | Automatic | N/A |

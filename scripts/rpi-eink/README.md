# Raspberry Pi E-Ink Display Scripts

This directory contains scripts for running the Trainboard application on a Raspberry Pi with an e-ink display.

## Files

### Installation & Setup

- **`install.sh`** - Automated installation script that sets up all dependencies, clones repositories, and configures the system. Run this first on a fresh Raspberry Pi.

### Display Management

- **`render-to-image.js`** - **NEW!** Fast server-side renderer that generates departure board images directly using Node.js Canvas, without requiring a browser. Significantly faster than Chromium on Raspberry Pi (~10x speed improvement).

- **`update-display.sh`** - Main script that captures a screenshot of the trainboard and displays it on the e-ink screen. Now intelligently chooses between direct rendering (fast) and browser-based capture (fallback). This is run automatically by the systemd timer.

- **`capture-and-log.js`** - Puppeteer-based screenshot capture script (used as fallback if direct rendering is unavailable).

- **`clear-display.sh`** - Utility script to clear the e-ink display. Useful for troubleshooting or when you want to blank the screen.

- **`test-render.js`** - Test script for the direct renderer with mock data.

### Systemd Services

- **`trainboard-display.service`** - Systemd service unit that runs the display update script.

- **`trainboard-display.timer`** - Systemd timer that triggers the display update service at regular intervals (default: every 2 minutes).

## Quick Start

### 1. Run the Installation Script

On your Raspberry Pi, run:

```bash
cd ~/trainboard/scripts/rpi-eink
chmod +x install.sh
./install.sh
```

This will:

- Install all required system packages
- Install Node.js and npm
- Set up the e-Paper display library
- Build the trainboard application
- Configure systemd services

### 2. Configure API base URL and defaults

Edit the configuration file to adjust non-secret values such as `API_BASE_URL` or default railway/station (compile-time defaults live in `defaults.json`):

```bash
nano ~/trainboard/defaults.json
```

Example (do NOT store secret API keys in this file):

```json
{
  "DEFAULT_RAILWAY": "odpt.Railway:Tokyu.Toyoko",
  "DEFAULT_STATION_NAME": "武蔵小杉 (TY11)",
  "API_BASE_URL": "https://api-challenge.odpt.org/api/v4/"
}
```

If you need to supply an ODPT API key for development, either:

- Use the in-browser settings modal (⚙️) to paste a key which will be stored in `localStorage` for the current device; or
- Deploy the Cloudflare API proxy (recommended for production) so no key is stored in the browser.

### 3. Test the Display

Run the update script manually to test:

```bash
~/trainboard/scripts/rpi-eink/update-display.sh
```

You should see the trainboard displayed on your e-ink screen after ~20-30 seconds.

### 4. Enable Automatic Updates

Enable the systemd timer to start on boot:

```bash
sudo systemctl enable trainboard-display.timer
sudo systemctl start trainboard-display.timer
```

Check the timer status:

```bash
sudo systemctl status trainboard-display.timer
```

## Script Details

### render-to-image.js

**New in this version**: A fast, lightweight Node.js-based renderer that generates departure board images directly without requiring a browser. This is significantly faster and uses less memory than Chromium-based rendering, making it ideal for Raspberry Pi deployments.

**Features:**
- Direct API integration with ODPT
- Server-side Canvas rendering (no browser needed)
- ~10x faster than Chromium on Raspberry Pi
- Lower memory usage
- Automatic fallback to browser-based rendering if unavailable

**Usage:**

```bash
node ~/trainboard/scripts/rpi-eink/render-to-image.js <outputPath> [width] [height] [configFile]
```

**Examples:**

```bash
# Basic usage with defaults from defaults.json
node render-to-image.js /tmp/trainboard.png

# Custom dimensions
node render-to-image.js /tmp/trainboard.png 960 640

# With custom config file
node render-to-image.js /tmp/trainboard.png 960 640 /path/to/config.json
```

**Dependencies:**
- Node.js 14 or higher
- `canvas` npm package (automatically installed)

**Configuration:**
The renderer uses the same `defaults.json` configuration file as the web application. It supports:
- `DEFAULT_RAILWAY` - Railway URI (e.g., "odpt.Railway:Tokyu.Toyoko")
- `DEFAULT_STATION_NAME` - Station name to display
- `API_BASE_URL` - ODPT API endpoint
- `API_KEY` - Optional API key (can also use `ODPT_API_KEY` environment variable)

### update-display.sh

The update script now intelligently chooses the best rendering method:

1. **Direct Node.js Renderer** (Preferred) - Uses `render-to-image.js` for fast, browser-free rendering
2. **Puppeteer Capture** (Fallback 1) - Uses Puppeteer with Chromium if direct rendering fails
3. **Chromium + Xvfb** (Fallback 2) - Uses headless Chromium as a last resort

**Process:**
1. **Attempt Direct Rendering** - Try render-to-image.js first (fastest, ~2-3 seconds)
2. **Fallback to Browser** - If direct rendering fails, start web server and capture with browser
3. **Update Display** - Converts the image and sends it to the e-ink display
4. **Refresh Management** - Alternates between partial and full refreshes to extend display lifespan

**Environment Variables:**

- `APP_DIR` - Path to trainboard application (default: `$HOME/trainboard`)
- `DISPLAY_DIR` - Path to e-Paper Python library (default: `$HOME/e-Paper/RaspberryPi_JetsonNano/python`)
- `SCREENSHOT_PATH` - Path to save screenshot (default: `$APP_DIR/screenshot.png`)
- `LOG_FILE` - Log file path (default: `/var/log/trainboard-display.log`)
- `HTTP_PORT` - Web server port (default: `8080`)

**Refresh Strategy:**

- Partial refresh (fast): Most updates, ~5 seconds
- Full refresh (slow): Every 10th update, ~20 seconds, clears ghosting

### clear-display.sh

Clears the e-ink display completely. Useful when:

- Troubleshooting display issues
- Display shows corrupted/garbled content
- You want to blank the screen

Usage:

```bash
~/trainboard/scripts/rpi-eink/clear-display.sh
```

## Systemd Services

### Starting/Stopping the Timer

```bash
# Start the timer
sudo systemctl start trainboard-display.timer

# Stop the timer
sudo systemctl stop trainboard-display.timer

# Check status
sudo systemctl status trainboard-display.timer

# View recent logs
sudo journalctl -u trainboard-display.service -n 50
```

### Manual Display Update

To trigger an immediate update without waiting for the timer:

```bash
sudo systemctl start trainboard-display.service
```

### Adjusting Update Frequency

Edit the timer configuration:

```bash
sudo systemctl edit trainboard-display.timer
```

Add your custom timing:

```ini
[Timer]
OnBootSec=1min
OnUnitActiveSec=5min
```

This example changes the update frequency to every 5 minutes.

Then reload and restart:

```bash
sudo systemctl daemon-reload
sudo systemctl restart trainboard-display.timer
```

## Troubleshooting

### Display Not Updating

Check the service logs:

```bash
sudo journalctl -u trainboard-display.service -f
```

Check if the service is running:

```bash
sudo systemctl status trainboard-display.service
```

### Web Server Issues

Check if the server is running:

```bash
pgrep -f http-server
```

Test the server manually:

```bash
curl http://localhost:8080
```

### SPI/Display Hardware Issues

Verify SPI is enabled:

```bash
lsmod | grep spi_bcm2835
```

If not shown, enable SPI:

```bash
sudo raspi-config
# Navigate to: Interface Options -> SPI -> Yes
```

Check GPIO permissions:

```bash
ls -l /dev/spidev0.0
sudo usermod -a -G spi,gpio pi
```

### Clear Display Not Working

Try running the e-Paper test directly:

```bash
cd ~/e-Paper/RaspberryPi_JetsonNano/python/examples
python3 epd_10in2_G_test.py
```

## Advanced Configuration

### Different Display Model

If you're using a different Waveshare e-ink display model, you'll need to:

1. Modify `update-display.sh` to use the correct display driver
2. Adjust `DISPLAY_WIDTH` and `DISPLAY_HEIGHT` variables
3. Update the Python script to import the correct `waveshare_epd` module

### Custom Screenshot Resolution

Edit the `DISPLAY_WIDTH` and `DISPLAY_HEIGHT` variables in `update-display.sh`:

```bash
DISPLAY_WIDTH=1200
DISPLAY_HEIGHT=800
```

### Running as Different User

If you want to run the service as a different user, edit the service file:

```bash
sudo systemctl edit trainboard-display.service
```

Add:

```ini
[Service]
User=youruser
Group=yourgroup
Environment="HOME=/home/youruser"
```

## Performance Tips

### Reduce Memory Usage

The update script uses these Chromium flags to minimize memory:

- `--single-process` - Run in a single process
- `--disable-dev-shm-usage` - Don't use /dev/shm
- `--disable-gpu` - Disable GPU acceleration

### Extend Display Lifespan

- Use longer update intervals (e.g., 5 minutes instead of 2)
- Increase `FULL_REFRESH_INTERVAL` to reduce full refreshes
- Consider disabling updates during nighttime hours

### Faster Updates

- Decrease `FULL_REFRESH_INTERVAL` for fewer full refreshes
- Use only partial refreshes (may cause ghosting over time)

## Further Reading

See the main documentation: [RASPBERRY_PI_SETUP.md](../../RASPBERRY_PI_SETUP.md)

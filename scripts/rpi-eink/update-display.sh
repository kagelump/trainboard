#!/bin/bash
# update-display.sh
# Script to capture trainboard screenshot and display on e-ink screen
# This script runs periodically to update the e-ink display with fresh train data

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${APP_DIR:-$HOME/trainboard}"
DISPLAY_DIR="${DISPLAY_DIR:-$HOME/e-Paper/RaspberryPi_JetsonNano/python}"
SCREENSHOT_PATH="${SCREENSHOT_PATH:-$APP_DIR/screenshot.png}"
LOG_FILE="${LOG_FILE:-$HOME/log/trainboard-display.log}"
HTTP_PORT="${HTTP_PORT:-8080}"
DISPLAY_WIDTH=960
DISPLAY_HEIGHT=640

# Counter file for tracking refreshes
COUNTER_FILE="$HOME/.config/trainboard/refresh_counter"
mkdir -p "$(dirname "$COUNTER_FILE")"

# Full refresh interval (every N updates)
FULL_REFRESH_INTERVAL=10

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

# Error handler
error_exit() {
    log "ERROR: $1"
    exit 1
}

log "Starting display update..."

# Check if required directories exist
if [ ! -d "$APP_DIR" ]; then
    error_exit "Application directory not found: $APP_DIR"
fi

if [ ! -d "$DISPLAY_DIR" ]; then
    error_exit "E-Paper display directory not found: $DISPLAY_DIR"
fi

# Start local web server if not already running
if ! pgrep -f "http-server.*$HTTP_PORT" > /dev/null; then
    log "Starting local web server on port $HTTP_PORT..."
    cd "$APP_DIR/dist" || error_exit "dist directory not found"
    nohup npx http-server -p "$HTTP_PORT" > /tmp/trainboard-server.log 2>&1 &
    sleep 10
fi

# Wait up to 15s for local web server to respond (retry loop)
log "Waiting for local web server to respond on port $HTTP_PORT..."
for i in $(seq 1 15); do
    if curl -s -f "http://localhost:$HTTP_PORT" > /dev/null; then
        break
    fi
    sleep 1
done

if ! curl -s -f "http://localhost:$HTTP_PORT" > /dev/null; then
    error_exit "Web server is not responding on port $HTTP_PORT after retries"
fi

log "Capturing screenshot from http://localhost:$HTTP_PORT..."

# Prefer Puppeteer capture if node and the capture script are available
NODE_CMD=$(command -v node || true)
CAPTURE_SCRIPT="$APP_DIR/scripts/rpi-eink/capture-and-log.js"
if [ -n "$NODE_CMD" ] && [ -f "$CAPTURE_SCRIPT" ]; then
    # Determine owner of APP_DIR to run node as that user if possible
    OWNER=$(stat -c '%U' "$APP_DIR" 2>/dev/null || echo "${SUDO_USER:-$(whoami)}")
    log "Using Puppeteer capture via node (user: $OWNER)"
    if ! sudo -u "$OWNER" "$NODE_CMD" "$CAPTURE_SCRIPT" "http://localhost:$HTTP_PORT" "$SCREENSHOT_PATH" "$DISPLAY_WIDTH" "$DISPLAY_HEIGHT" >>"$LOG_FILE" 2>&1; then
        log "Puppeteer capture failed; check $LOG_FILE for details"
        tail -n 200 "$LOG_FILE" | sed 's/^/    /' | while IFS= read -r line; do log "$line"; done
        error_exit "Puppeteer capture failed"
    fi
else
    # Fallback: use Chromium under Xvfb with verbose logging and a timeout
    CHROMIUM_LOG="/tmp/chromium-screenshot.log"
    : > "$CHROMIUM_LOG"
    if ! timeout 30s xvfb-run -a --server-args="-screen 0 ${DISPLAY_WIDTH}x${DISPLAY_HEIGHT}x24" \
        chromium \
        --headless \
        --enable-logging=stderr \
        --v=1 \
        --no-sandbox \
        --disable-gpu \
        --disable-dev-shm-usage \
        --disable-software-rasterizer \
        --disable-extensions \
        --disable-setuid-sandbox \
        --single-process \
        --window-size=${DISPLAY_WIDTH},${DISPLAY_HEIGHT} \
        --screenshot="$SCREENSHOT_PATH" \
        "http://localhost:$HTTP_PORT" \
        >"$CHROMIUM_LOG" 2>&1; then
        log "Chromium capture failed; see $CHROMIUM_LOG for details"
        tail -n 200 "$CHROMIUM_LOG" | sed 's/^/    /' | while IFS= read -r line; do log "$line"; done
        error_exit "Failed to capture screenshot"
    fi
fi

# Verify screenshot was created
if [ ! -f "$SCREENSHOT_PATH" ]; then
    error_exit "Screenshot file not created: $SCREENSHOT_PATH"
fi

log "Screenshot captured: $SCREENSHOT_PATH ($(du -h "$SCREENSHOT_PATH" | cut -f1))"

# Increment refresh counter
if [ -f "$COUNTER_FILE" ]; then
    COUNTER=$(cat "$COUNTER_FILE")
else
    COUNTER=0
fi
COUNTER=$((COUNTER + 1))
echo "$COUNTER" > "$COUNTER_FILE"

# Determine if we should do a full refresh
if [ $((COUNTER % FULL_REFRESH_INTERVAL)) -eq 0 ]; then
    REFRESH_MODE="full"
    log "Performing full refresh (counter: $COUNTER)"
else
    REFRESH_MODE="partial"
    log "Performing partial refresh (counter: $COUNTER)"
fi

# Display on e-ink screen
log "Updating e-ink display (mode: $REFRESH_MODE)..."

cd "$DISPLAY_DIR" || error_exit "Failed to change to display directory"

# Create Python script for displaying the image
cat > /tmp/display_trainboard.py << 'PYTHON_SCRIPT'
#!/usr/bin/python3
# -*- coding:utf-8 -*-

import sys
import os
import logging
from PIL import Image

# Add the lib directory to the path
libdir = os.path.join(os.path.dirname(os.path.realpath(__file__)), 'lib')
if os.path.exists(libdir):
    sys.path.append(libdir)

# Import the appropriate e-Paper driver
try:
    from waveshare_epd import epd10in2_G
except ImportError:
    logging.error("Failed to import e-Paper library")
    sys.exit(1)

def main():
    # Get parameters from command line
    if len(sys.argv) < 3:
        print("Usage: display_trainboard.py <image_path> <refresh_mode>")
        sys.exit(1)

    image_path = sys.argv[1]
    refresh_mode = sys.argv[2]  # 'full' or 'partial'

    logging.basicConfig(level=logging.INFO)

    try:
        logging.info("Initializing e-Paper display...")
        epd = epd10in2_G.EPD()

        # Initialize the display
        if refresh_mode == 'full':
            logging.info("Performing full initialization...")
            epd.init()
            epd.Clear()
        else:
            logging.info("Performing partial initialization...")
            epd.init()

        # Load and prepare the image
        logging.info(f"Loading image: {image_path}")
        image = Image.open(image_path)

        # Resize to display dimensions if needed
        display_width = 960
        display_height = 640

        if image.size != (display_width, display_height):
            logging.info(f"Resizing image from {image.size} to ({display_width}, {display_height})")
            # Use Image.LANCZOS for compatibility with older PIL versions
            try:
                image = image.resize((display_width, display_height), Image.Resampling.LANCZOS)
            except AttributeError:
                # Fallback for older PIL versions
                image = image.resize((display_width, display_height), Image.LANCZOS)

        # Convert to mode compatible with the 4-color display
        # The display supports: White, Black, Red, Yellow
        if image.mode != 'RGB':
            logging.info(f"Converting image from {image.mode} to RGB")
            image = image.convert('RGB')

        # Display the image
        logging.info("Displaying image on e-Paper...")
        epd.display(epd.getbuffer(image))

        # Sleep the display to save power
        logging.info("Putting display to sleep...")
        epd.sleep()

        logging.info("Display update complete!")

    except IOError as e:
        logging.error(f"IO Error: {e}")
        sys.exit(1)
    except KeyboardInterrupt:
        logging.info("Interrupted by user")
        epd10in2_G.epdconfig.module_exit()
        sys.exit(0)
    except Exception as e:
        logging.error(f"Unexpected error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
PYTHON_SCRIPT

chmod +x /tmp/display_trainboard.py

# Run the display update
sudo python3 /tmp/display_trainboard.py "$SCREENSHOT_PATH" "$REFRESH_MODE" \
    || error_exit "Failed to update e-ink display"

log "Display update completed successfully!"

# Clean up old screenshots (keep last 5)
cd "$APP_DIR" || exit
ls -t screenshot*.png 2>/dev/null | tail -n +6 | xargs -r rm

log "Update cycle finished."
exit 0

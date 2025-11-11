#!/bin/bash
# update-display.sh
# Script to capture trainboard screenshot and display on e-ink screen
# This script runs periodically to update the e-ink display with fresh train data

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${APP_DIR:-$HOME/trainboard}"
DISPLAY_DIR="${DISPLAY_DIR:-$HOME/e-Paper/E-paper_Separate_Program/10in2_e-Paper_G/RaspberryPi_JetsonNano/python/lib}"
SCREENSHOT_PATH="${SCREENSHOT_PATH:-$APP_DIR/screenshot.png}"
LOG_FILE="${LOG_FILE:-$HOME/log/trainboard-display.log}"
TRAINBOARD_URL="${TRAINBOARD_URL:-https://trainboard.hinoka.org}"
DISPLAY_WIDTH=960
DISPLAY_HEIGHT=640

# Default Puppeteer wait settings: wait for a train-row element before capturing.
# This can be overridden by setting WAIT_FOR_SELECTOR, WAIT_TIMEOUT_MS, or
# WAIT_AFTER_LOAD_MS in the environment or systemd unit.
export WAIT_FOR_FUNCTION="${WAIT_FOR_FUNCTION:-window.__DEPARTURES_RENDERED === true}"
export WAIT_TIMEOUT_MS="${WAIT_TIMEOUT_MS:-20000}"
export WAIT_AFTER_LOAD_MS="${WAIT_AFTER_LOAD_MS:-5000}"

# Counter file for tracking refreshes
COUNTER_FILE="$HOME/.config/trainboard/refresh_counter"
mkdir -p "$(dirname "$COUNTER_FILE")"

# Full refresh interval (every N updates)
FULL_REFRESH_INTERVAL=4000

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

log "Capturing screenshot..."

# Prefer direct rendering if available (fastest, no browser needed)
RENDER_SCRIPT="$APP_DIR/scripts/rpi-eink/render-to-image.ts"

log "Using direct Node.js renderer (no browser needed)"
if npx tsx "$RENDER_SCRIPT" "$SCREENSHOT_PATH" "$DISPLAY_WIDTH" "$DISPLAY_HEIGHT" >>"$LOG_FILE" 2>&1; then
    log "Direct rendering completed successfully"
else
    log "Direct rendering failed, falling back to browser-based capture"
    error_exit "Direct rendering failed"
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

export PYTHONPATH="$DISPLAY_DIR:$PYTHONPATH"

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
    from waveshare_epd import epd10in2g
except ImportError as e:
    logging.error("Failed to import e-Paper library")
    raise e

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
        epd = epd10in2g.EPD()

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
        epd10in2g.epdconfig.module_exit()
        sys.exit(0)
    except Exception as e:
        logging.error(f"Unexpected error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
PYTHON_SCRIPT

chmod +x /tmp/display_trainboard.py

# Run the display update
python3 /tmp/display_trainboard.py "$SCREENSHOT_PATH" "$REFRESH_MODE" \
    || error_exit "Failed to update e-ink display"

log "Display update completed successfully!"

# Clean up old screenshots (keep last 5)
cd "$APP_DIR" || exit
ls -t screenshot*.png 2>/dev/null | tail -n +6 | xargs -r rm

log "Update cycle finished."
exit 0

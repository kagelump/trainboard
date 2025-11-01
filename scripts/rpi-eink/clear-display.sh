#!/bin/bash
# clear-display.sh
# Script to clear the e-ink display
# Useful for troubleshooting or when you want to blank the screen

set -e

DISPLAY_DIR="${DISPLAY_DIR:-$HOME/e-Paper/RaspberryPi_JetsonNano/python}"

echo "Clearing e-ink display..."

cd "$DISPLAY_DIR" || {
    echo "ERROR: Display directory not found: $DISPLAY_DIR"
    exit 1
}

# Create Python script to clear the display
cat > /tmp/clear_display.py << 'PYTHON_SCRIPT'
#!/usr/bin/python3
# -*- coding:utf-8 -*-

import sys
import os
import logging

# Add the lib directory to the path
libdir = os.path.join(os.path.dirname(os.path.realpath(__file__)), 'lib')
if os.path.exists(libdir):
    sys.path.append(libdir)

try:
    from waveshare_epd import epd10in2_G
except ImportError:
    logging.error("Failed to import e-Paper library")
    sys.exit(1)

def main():
    logging.basicConfig(level=logging.INFO)
    
    try:
        logging.info("Initializing e-Paper display...")
        epd = epd10in2_G.EPD()
        
        logging.info("Clearing display...")
        epd.init()
        epd.Clear()
        
        logging.info("Putting display to sleep...")
        epd.sleep()
        
        logging.info("Display cleared successfully!")
        
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

chmod +x /tmp/clear_display.py

# Run the clear script
sudo python3 /tmp/clear_display.py || {
    echo "ERROR: Failed to clear display"
    exit 1
}

echo "Display cleared successfully!"
exit 0

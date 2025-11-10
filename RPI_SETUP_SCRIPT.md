# Raspberry Pi One-Command Setup Script

This script provides automated installation of the Trainboard application on a Raspberry Pi with e-ink display support.

## Usage

### Quick Start (Recommended)

```bash
curl https://trainboard.hinoka.org/rpi_setup.sh | sudo sh
```

### Manual Download and Execute

If you prefer to review the script first:

```bash
curl -O https://trainboard.hinoka.org/rpi_setup.sh
less rpi_setup.sh  # Review the script
chmod +x rpi_setup.sh
sudo ./rpi_setup.sh
```

## Prerequisites

Before running this script, ensure:

1. **Fresh Raspberry Pi OS** installed (Raspberry Pi OS Lite 64-bit recommended)
2. **SSH enabled** - Create empty `ssh` file in boot partition
3. **WiFi configured** - Create `wpa_supplicant.conf` in boot partition:

   ```
   ctrl_interface=DIR=/var/run/wpa_supplicant GROUP=netdev
   update_config=1
   country=JP

   network={
       ssid="YOUR_WIFI_SSID"
       psk="YOUR_WIFI_PASSWORD"
       key_mgmt=WPA-PSK
   }
   ```

4. **Internet connection** - Script downloads packages and repositories
5. **Run as root** - Script must be run with sudo

## What the Script Does

The automated setup script performs the following steps:

### 1. System Configuration

- ✓ Detects Raspberry Pi hardware
- ✓ Enables SPI interface (required for e-ink display)
- ✓ Configures user permissions (spi, gpio, video groups)

### 2. Software Installation

- ✓ Updates system packages
- ✓ Installs Chromium browser (for rendering screenshots)
- ✓ Installs Xvfb (virtual display server)
- ✓ Installs Python 3 and required libraries (PIL, NumPy)
- ✓ Installs Node.js 20.x and npm
- ✓ Installs BCM2835 library (GPIO control)

### 3. E-Paper Library Setup

- ✓ Clones Waveshare e-Paper library
- ✓ Installs Python dependencies
- ✓ Configures display drivers

### 4. Trainboard Application

- ✓ Clones trainboard repository
- ✓ Installs npm dependencies
- ✓ Builds production bundle
- ✓ Creates default configuration file

### 5. Service Configuration

- ✓ Installs systemd service files
- ✓ Configures automatic display updates
- ✓ Sets up logging

## Environment Variables

Customize the installation with environment variables:

```bash
# Install for a different user (default: pi)
curl https://trainboard.hinoka.org/rpi_setup.sh | sudo TRAINBOARD_USER=myuser sh

# Use a forked repository
curl https://trainboard.hinoka.org/rpi_setup.sh | \
  sudo TRAINBOARD_REPO=https://github.com/yourname/trainboard.git sh
```

Available variables:

- `TRAINBOARD_USER` - User account to install for (default: `pi`)
- `TRAINBOARD_REPO` - Git repository URL (default: `https://github.com/kagelump/trainboard.git`)

## After Installation

Once the script completes, follow these steps:

### 1. Configure the Application

Edit the configuration file:

```bash
nano ~/trainboard/defaults.json
```

Set your preferred defaults:

```json
{
  "DEFAULT_RAILWAY": "odpt.Railway:Tokyu.Toyoko",
  "DEFAULT_STATION_NAME": "武蔵小杉 (TY11)",
  "API_BASE_URL": "https://api-challenge.odpt.org/api/v4/"
}
```

### 2. Test the Display

Run a manual update to verify everything works:

```bash
sudo ~/trainboard/scripts/rpi-eink/update-display.sh
```

### 3. Enable Automatic Updates

Enable the systemd timer to update the display automatically:

```bash
sudo systemctl enable trainboard-display.timer
sudo systemctl start trainboard-display.timer
```

### 4. Check Status

Monitor the service:

```bash
# Check timer status
sudo systemctl status trainboard-display.timer

# View live logs
sudo journalctl -u trainboard-display.service -f
```

## Troubleshooting

### SPI Not Enabled

If the script reports SPI is not enabled:

1. The script will add `dtparam=spi=on` to `/boot/config.txt` or `/boot/firmware/config.txt`
2. Reboot the Pi: `sudo reboot`
3. Run the script again after reboot

### Permission Denied

Make sure to run with `sudo`:

```bash
sudo ./rpi_setup.sh
```

### Display Not Working

1. Check SPI is loaded: `lsmod | grep spi_bcm2835`
2. Test the display: `cd ~/e-Paper/RaspberryPi_JetsonNano/python/examples && python3 epd_10in2_G_test.py`
3. Check service logs: `sudo journalctl -u trainboard-display.service -xe`

### Network Issues

Ensure the Pi has internet connectivity:

```bash
ping -c 3 google.com
```

## Manual Installation

If you prefer manual installation or need more control, see [RASPBERRY_PI_SETUP.md](../RASPBERRY_PI_SETUP.md) for detailed step-by-step instructions.

## Uninstallation

To remove the installation:

```bash
# Stop and disable services
sudo systemctl stop trainboard-display.timer
sudo systemctl disable trainboard-display.timer
sudo systemctl disable trainboard-display.service
sudo rm /etc/systemd/system/trainboard-display.*
sudo systemctl daemon-reload

# Remove application and libraries
rm -rf ~/trainboard
rm -rf ~/e-Paper

# Remove log file
sudo rm /var/log/trainboard-display.log

# (Optional) Remove system packages if no longer needed
sudo apt remove chromium-browser xvfb python3-pip python3-pil python3-numpy
```

## Support

For issues, questions, or contributions:

- See detailed documentation: [RASPBERRY_PI_SETUP.md](../RASPBERRY_PI_SETUP.md)
- Report issues: [GitHub Issues](https://github.com/kagelump/trainboard/issues)
- Main project: [Trainboard on GitHub](https://github.com/kagelump/trainboard)

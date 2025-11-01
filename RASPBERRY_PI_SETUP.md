# Raspberry Pi E-Ink Display Setup

This guide provides instructions for setting up the Trainboard application on a Raspberry Pi Zero 2 W with a Waveshare 10.2inch e-Paper HAT (G) display (White/Black/Red/Yellow).

## Hardware Requirements

- Raspberry Pi Zero 2 W
- Waveshare 10.2inch e-Paper HAT (G) - [Product Link](https://www.waveshare.com/10.2inch-e-paper-hat-g.htm?sku=31124)
- MicroSD card (16GB or larger recommended)
- Power supply for Raspberry Pi
- (Optional) Case for protection

## Overview

The setup consists of:
1. Installing and configuring Raspberry Pi OS
2. Installing required software (Chromium, Xvfb, Python libraries)
3. Configuring the trainboard application
4. Setting up automatic display refresh
5. Configuring auto-start on boot

## Part 1: General Raspberry Pi Setup

### 1.1 Install Raspberry Pi OS

1. Download [Raspberry Pi Imager](https://www.raspberrypi.com/software/)
2. Flash Raspberry Pi OS Lite (64-bit) to your microSD card
3. **Before ejecting the SD card**, enable SSH and configure WiFi:

#### Enable SSH
Create an empty file named `ssh` in the boot partition:
```bash
# On Linux/Mac:
touch /Volumes/bootfs/ssh
# On Windows, create an empty file named 'ssh' (no extension) in the boot drive
```

#### Configure WiFi
Create a file named `wpa_supplicant.conf` in the boot partition:
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

Replace `YOUR_WIFI_SSID` and `YOUR_WIFI_PASSWORD` with your actual WiFi credentials. Change `country=JP` to your country code if different.

4. Insert the SD card into your Raspberry Pi and power it on
5. Wait about 60-90 seconds for the Pi to boot up

### 1.2 Connect via SSH

Find your Pi's IP address (check your router, or use a network scanner like `nmap`), then connect:

```bash
ssh pi@<IP_ADDRESS>
# Default password is 'raspberry'
```

### 1.3 Initial Configuration

```bash
# Update the system
sudo apt update
sudo apt upgrade -y

# Change the default password for security
passwd

# Optional: Configure hostname, locale, timezone using raspi-config
sudo raspi-config
# Navigate to System Options > Hostname to change the hostname
# Navigate to Localisation Options to set timezone and locale
```

### 1.4 Enable SPI Interface

The e-ink display uses the SPI interface, which needs to be enabled:

```bash
sudo raspi-config
```

- Navigate to: `Interface Options` → `SPI` → Select `Yes`
- Reboot when prompted, or reboot manually: `sudo reboot`

## Part 2: Software Environment Setup

After the Pi reboots, reconnect via SSH and install the required software:

### 2.1 Install System Dependencies

```bash
# Install Node.js (for building the app if needed)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Chromium browser and virtual display
sudo apt install -y chromium-browser xvfb

# Install Python dependencies for e-ink display
sudo apt install -y python3-pip python3-pil python3-numpy
sudo apt install -y git

# Install BCM2835 library (required for Waveshare e-Paper)
cd /tmp
wget http://www.airspayce.com/mikem/bcm2835/bcm2835-1.71.tar.gz
tar zxvf bcm2835-1.71.tar.gz
cd bcm2835-1.71/
sudo ./configure && sudo make && sudo make check && sudo make install
```

### 2.2 Install Waveshare E-Paper Library

```bash
# Clone the Waveshare e-Paper library
cd ~
git clone https://github.com/waveshare/e-Paper.git
cd e-Paper/RaspberryPi_JetsonNano/python
sudo pip3 install -r requirements.txt --break-system-packages
```

Note: The `--break-system-packages` flag is needed for newer versions of Raspberry Pi OS that use externally-managed Python environments.

## Part 3: Trainboard Application Setup

### 3.1 Clone and Configure the Application

```bash
# Create application directory
mkdir -p ~/trainboard
cd ~/trainboard

# Clone the repository
git clone https://github.com/kagelump/trainboard.git .

# Install dependencies and build
npm install
npm run build

# Create configuration file
cp config.example.json config.json
```

### 3.2 Configure the Application

Edit `config.json` with your settings:

```bash
nano config.json
```

Update the file with your ODPT API key and preferred station:

```json
{
  "ODPT_API_KEY": "YOUR_ODPT_API_KEY_HERE",
  "DEFAULT_RAILWAY": "odpt.Railway:Tokyu.Toyoko",
  "DEFAULT_STATION_NAME": "武蔵小杉 (TY11)",
  "API_BASE_URL": "https://api-challenge.odpt.org/api/v4/"
}
```

**Getting an ODPT API Key:**
1. Visit [ODPT Developer Portal](https://developer.odpt.org/)
2. Sign up for a developer account
3. For Tokyu lines, register for the [Challenge 2025](https://developer.odpt.org/challengeinfo) to get access
4. Copy your API key to the config file above

### 3.3 Install E-Ink Display Scripts

The repository includes helper scripts in `scripts/rpi-eink/`:

```bash
# Make scripts executable
chmod +x ~/trainboard/scripts/rpi-eink/*.sh
```

## Part 4: E-Ink Display Configuration

### 4.1 Test the Display

First, verify that the e-Paper display is working:

```bash
cd ~/e-Paper/RaspberryPi_JetsonNano/python/examples
python3 epd_10in2_G_test.py
```

You should see test patterns on the display. If not, check:
- SPI is enabled (`sudo raspi-config`)
- Display is properly connected to GPIO pins
- Display power is on

### 4.2 Configure Display Refresh

The trainboard uses a two-step process:
1. Capture a screenshot of the web app using Chromium in headless mode
2. Convert and display the image on the e-ink screen

Create the display configuration directory:

```bash
mkdir -p ~/.config/trainboard
```

## Part 5: Automatic Display Updates

### 5.1 Install the Update Service

Copy the systemd service file:

```bash
sudo cp ~/trainboard/scripts/rpi-eink/trainboard-display.service /etc/systemd/system/
sudo cp ~/trainboard/scripts/rpi-eink/trainboard-display.timer /etc/systemd/system/
```

Edit the service file if your paths are different:

```bash
sudo nano /etc/systemd/system/trainboard-display.service
```

### 5.2 Enable and Start the Service

```bash
# Reload systemd to recognize new services
sudo systemctl daemon-reload

# Enable the timer to start on boot
sudo systemctl enable trainboard-display.timer

# Start the timer now
sudo systemctl start trainboard-display.timer

# Check status
sudo systemctl status trainboard-display.timer
```

The display will now update automatically according to the timer schedule (default: every 2 minutes).

### 5.3 Manual Display Update

To manually update the display at any time:

```bash
sudo systemctl start trainboard-display.service
```

Or run the script directly:

```bash
~/trainboard/scripts/rpi-eink/update-display.sh
```

## Part 6: Refresh Strategy and Display Lifecycle

### 6.1 E-Ink Display Characteristics

E-ink displays have unique characteristics:
- **Slow refresh**: Full refresh takes ~20 seconds
- **Limited lifespan**: Each pixel has a finite number of refresh cycles
- **Ghosting**: Previous images may leave traces without full refresh
- **Partial refresh**: Faster but can accumulate ghosting over time
- **Color limitations**: 4-color display shows White/Black/Red/Yellow

### 6.2 Recommended Refresh Schedule

The default configuration refreshes every 2 minutes with:
- Partial refresh for most updates (faster, less wear)
- Full refresh every 10th update (clears ghosting)

To adjust the refresh rate, edit the timer:

```bash
sudo systemctl edit trainboard-display.timer
```

Add:
```ini
[Timer]
OnBootSec=1min
OnUnitActiveSec=5min
```

This changes the refresh to every 5 minutes.

### 6.3 Display Sleep/Wake

To save power and extend display life, you can disable updates during certain hours:

Edit the timer to add time conditions:
```bash
sudo systemctl edit trainboard-display.timer
```

## Troubleshooting

### Display Not Updating

1. Check if the service is running:
   ```bash
   sudo systemctl status trainboard-display.service
   sudo journalctl -u trainboard-display.service -f
   ```

2. Check if Chromium can access the site:
   ```bash
   chromium-browser --headless --disable-gpu --screenshot=/tmp/test.png http://localhost:8080
   ls -lh /tmp/test.png
   ```

3. Verify the web server is running:
   ```bash
   curl http://localhost:8080
   ```

### SPI/GPIO Issues

```bash
# Check if SPI is enabled
lsmod | grep spi
# Should show: spi_bcm2835

# Check GPIO permissions
ls -l /dev/spidev0.0
# User should have access, add to spi group if needed:
sudo usermod -a -G spi,gpio pi
```

### API/Network Issues

1. Check internet connectivity:
   ```bash
   ping -c 3 google.com
   ```

2. Test the API key:
   ```bash
   curl "https://api-challenge.odpt.org/api/v4/odpt:Railway?acl:consumerKey=YOUR_API_KEY"
   ```

### Display Shows Garbled/Wrong Content

1. Clear the display completely:
   ```bash
   cd ~/e-Paper/RaspberryPi_JetsonNano/python/examples
   python3 epd_10in2_G_clear.py
   ```

2. Verify image conversion is working:
   ```bash
   file ~/trainboard/screenshot.png
   # Should show PNG image data
   ```

## Performance Optimization

### Reduce Memory Usage

The Pi Zero 2 W has limited RAM. To optimize:

1. Disable swap if not needed:
   ```bash
   sudo dphys-swapfile swapoff
   sudo dphys-swapfile uninstall
   sudo systemctl disable dphys-swapfile
   ```

2. Use Chromium's memory-saving flags (already in the update script):
   - `--disable-dev-shm-usage`
   - `--single-process`

### Faster Boot Time

Edit `/boot/cmdline.txt` and add `quiet` to reduce boot messages:
```bash
sudo nano /boot/cmdline.txt
```

## Maintenance

### Updating the Application

```bash
cd ~/trainboard
git pull
npm install
npm run build
sudo systemctl restart trainboard-display.timer
```

### Viewing Logs

```bash
# Service logs
sudo journalctl -u trainboard-display.service -f

# System logs
sudo journalctl -xe

# Display update script output
cat /var/log/trainboard-display.log
```

## Advanced Configuration

### Custom Display Rotation

If you need to rotate the display, edit the Python display script to add rotation parameters.

### Multiple Stations

To cycle through multiple stations, modify the update script to rotate through different config files.

### Remote Configuration

Set up a web interface or SSH access to change station settings without physical access to the Pi.

## References

- [Waveshare 10.2inch e-Paper HAT (G) Wiki](https://www.waveshare.com/wiki/10.2inch_e-Paper_HAT_(G))
- [ODPT Developer Documentation](https://developer.odpt.org/)
- [Raspberry Pi Documentation](https://www.raspberrypi.com/documentation/)

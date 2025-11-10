#!/bin/bash
# rpi_setup.sh
# One-command setup script for Trainboard on Raspberry Pi with e-ink display
# Usage: curl https://trainboard.hinoka.org/rpi_setup.sh | sudo sh
#
# This script performs:
# 1. System configuration (SPI, permissions)
# 2. Software installation (Node.js, Chromium, Python deps, BCM2835)
# 3. E-Paper library setup
# 4. Trainboard application installation
# 5. Systemd service configuration
#
# Environment variables:
#   TRAINBOARD_REPO - Repository URL (default: https://github.com/kagelump/trainboard.git)
#   TRAINBOARD_USER - User to install for (default: pi)
#   SKIP_SPI_CHECK - Set to 1 to skip SPI check (use with caution)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
# By default we install as the `pi` user to match typical Raspberry Pi images.
# For improved security and isolation it's recommended to specify a dedicated
# user (for example: TRAINBOARD_USER=trainboard). The script will create the
# user if it doesn't already exist.
TRAINBOARD_USER="${TRAINBOARD_USER:-pi}"
TRAINBOARD_REPO="${TRAINBOARD_REPO:-https://github.com/kagelump/trainboard.git}"
# USER_HOME, APP_DIR and EPAPER_DIR are computed after ensuring the user exists
USER_HOME=''
APP_DIR=''
EPAPER_DIR=''

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $*"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $*"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $*"
}

# Check if running as root
check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_error "This script must be run as root (use sudo)"
        exit 1
    fi
}

# Check if running on Raspberry Pi
check_platform() {
    if [ ! -f /proc/device-tree/model ]; then
        log_warn "Cannot detect Raspberry Pi model. Proceeding anyway..."
        return
    fi

    model=$(cat /proc/device-tree/model)
    log_info "Detected: $model"
}

# Enable SPI interface
enable_spi() {
    log_step "Enabling SPI interface..."

    # Check if already enabled
    if lsmod | grep -q spi_bcm2835; then
        log_info "SPI interface is already enabled"
        return 0
    fi

    # Enable SPI in /boot/config.txt
    if ! grep -q "^dtparam=spi=on" /boot/config.txt 2>/dev/null && \
       ! grep -q "^dtparam=spi=on" /boot/firmware/config.txt 2>/dev/null; then
        # Try new location first (Raspberry Pi OS Bookworm)
        if [ -f /boot/firmware/config.txt ]; then
            echo "dtparam=spi=on" >> /boot/firmware/config.txt
            log_info "SPI enabled in /boot/firmware/config.txt"
        elif [ -f /boot/config.txt ]; then
            echo "dtparam=spi=on" >> /boot/config.txt
            log_info "SPI enabled in /boot/config.txt"
        else
            log_error "Could not find config.txt"
            return 1
        fi

        log_warn "SPI has been enabled but requires a reboot to take effect"
        log_warn "After reboot, run this script again to continue installation"
        log_info "Reboot now? (y/N)"
        read -r response
        if [[ "$response" =~ ^[Yy]$ ]]; then
            reboot
        fi
        exit 0
    fi

    # Load SPI module now
    modprobe spi_bcm2835 || log_warn "Failed to load SPI module (may require reboot)"
}

# Configure user permissions
setup_permissions() {
    log_step "Configuring user permissions..."

    # Add user to necessary groups (may fail on some systems, warn only)
    if id "$TRAINBOARD_USER" >/dev/null 2>&1; then
        usermod -a -G spi,gpio,video "$TRAINBOARD_USER" || log_warn "Failed to add user to groups"
        log_info "User $TRAINBOARD_USER added to spi, gpio, and video groups"
    else
        log_warn "User $TRAINBOARD_USER does not exist; skipping group modification"
    fi
}

# Ensure the install user exists. If not, create a dedicated system user.
ensure_user_exists() {
    if id "$TRAINBOARD_USER" >/dev/null 2>&1; then
        log_info "Install user exists: $TRAINBOARD_USER"
    else
        log_step "Creating install user: $TRAINBOARD_USER"
        # Create a regular user with home directory and bash shell
        useradd -m -s /bin/bash "$TRAINBOARD_USER" || {
            log_error "Failed to create user $TRAINBOARD_USER"
            exit 1
        }
        log_info "Created user: $TRAINBOARD_USER"
    fi

    # Recompute home and application paths now that the user exists
    USER_HOME=$(eval echo ~$TRAINBOARD_USER)
    APP_DIR="$USER_HOME/trainboard"
    EPAPER_DIR="$USER_HOME/e-Paper"
}

# Update system packages
update_system() {
    log_step "Updating system packages..."
    apt update
    log_info "System package list updated"
}

# Install system dependencies
install_system_deps() {
    log_step "Installing system dependencies..."

    apt install -y \
        chromium \
        xvfb \
        python3-pip \
        python3-pil \
        python3-numpy \
        git \
        curl \
        wget \
        build-essential || {
            log_error "Failed to install system dependencies"
            exit 1
        }

    log_info "System dependencies installed"
}

# Install Node.js
install_nodejs() {
    log_step "Installing Node.js..."

    if command -v node &> /dev/null; then
        log_info "Node.js is already installed: $(node --version)"
        return 0
    fi

    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs || {
        log_error "Failed to install Node.js"
        exit 1
    }

    log_info "Node.js installed: $(node --version)"
}

# Install BCM2835 library
install_bcm2835() {
    log_step "Installing BCM2835 library..."

    if [ -f /usr/local/lib/libbcm2835.a ]; then
        log_info "BCM2835 library is already installed"
        return 0
    fi

    cd /tmp
    wget -q http://www.airspayce.com/mikem/bcm2835/bcm2835-1.71.tar.gz
    tar zxf bcm2835-1.71.tar.gz
    cd bcm2835-1.71/
    ./configure && make && make check && make install || {
        log_error "Failed to install BCM2835 library"
        exit 1
    }
    rm -rf /tmp/bcm2835-1.71*

    log_info "BCM2835 library installed"
}

# Setup Waveshare e-Paper library
setup_epaper_library() {
    log_step "Setting up Waveshare e-Paper library..."

    if [ -d "$EPAPER_DIR" ]; then
        log_info "E-Paper library already exists at $EPAPER_DIR"
        return 0
    fi

    sudo -u "$TRAINBOARD_USER" git clone https://github.com/waveshare/e-Paper.git "$EPAPER_DIR" || {
        log_error "Failed to clone e-Paper library"
        exit 1
    }

    # The Waveshare e-Paper repository does not reliably include a single
    # top-level requirements.txt. Rather than attempting to find and install
    # a repo-specific requirements file (which can cause failures), install a
    # small, well-known set of Python packages that the e-Paper examples use.
    log_info "Installing common Python packages required by Waveshare examples"
    if pip3 install Pillow numpy spidev RPi.GPIO --break-system-packages; then
        log_info "Installed common Python packages (Pillow, numpy, spidev, RPi.GPIO)"
    else
        log_error "Failed to install common Python packages for e-Paper"
        exit 1
    fi

    log_info "E-Paper library setup complete"
}

# Setup trainboard application
setup_trainboard() {
    log_step "Setting up Trainboard application..."

    if [ -d "$APP_DIR" ]; then
        log_warn "Trainboard directory already exists at $APP_DIR"
        log_info "Pulling latest changes..."
        cd "$APP_DIR"
        sudo -u "$TRAINBOARD_USER" git pull || log_warn "Failed to pull updates"
    else
        log_info "Cloning trainboard from $TRAINBOARD_REPO..."
        sudo -u "$TRAINBOARD_USER" git clone "$TRAINBOARD_REPO" "$APP_DIR" || {
            log_error "Failed to clone trainboard"
            exit 1
        }
    fi

    cd "$APP_DIR"

    log_info "Installing npm dependencies..."
    sudo -u "$TRAINBOARD_USER" npm install || {
        log_error "Failed to install npm dependencies"
        exit 1
    }

    log_info "Building application..."
    sudo -u "$TRAINBOARD_USER" npm run build || {
        log_error "Failed to build application"
        exit 1
    }

    # Create defaults.json if it doesn't exist
    if [ ! -f "$APP_DIR/defaults.json" ]; then
        log_info "Creating defaults.json..."
        sudo -u "$TRAINBOARD_USER" cp "$APP_DIR/config.example.json" "$APP_DIR/defaults.json"
    fi

    log_info "Trainboard application installed"
}

# Setup systemd services
setup_services() {
    log_step "Setting up systemd services..."

    # Make scripts executable
    chmod +x "$APP_DIR/scripts/rpi-eink/"*.sh

    # Copy service files
    cp "$APP_DIR/scripts/rpi-eink/trainboard-display.service" /etc/systemd/system/
    cp "$APP_DIR/scripts/rpi-eink/trainboard-display.timer" /etc/systemd/system/

    # Update service file to use correct user
    sed -i "s/User=pi/User=$TRAINBOARD_USER/g" /etc/systemd/system/trainboard-display.service

    # Reload systemd
    systemctl daemon-reload

    log_info "Systemd services installed"
}

# Setup logging
setup_logging() {
    log_step "Setting up logging..."

    touch /var/log/trainboard-display.log
    chown "$TRAINBOARD_USER:$TRAINBOARD_USER" /var/log/trainboard-display.log

    sudo -u "$TRAINBOARD_USER" mkdir -p "$USER_HOME/.config/trainboard"

    log_info "Logging configured"
}

# Display next steps
show_next_steps() {
    echo ""
    echo "======================================"
    log_info "Installation Complete!"
    echo "======================================"
    echo ""
    log_info "Next steps:"
    echo ""
    echo "  1. Configure the application:"
    echo "     Edit $APP_DIR/defaults.json"
    echo "     (Set DEFAULT_RAILWAY, DEFAULT_STATION_NAME, API_BASE_URL)"
    echo ""
    echo "  2. Test the display manually:"
    echo "     sudo $APP_DIR/scripts/rpi-eink/update-display.sh"
    echo ""
    echo "  3. Enable automatic updates:"
    echo "     sudo systemctl enable trainboard-display.timer"
    echo "     sudo systemctl start trainboard-display.timer"
    echo ""
    echo "  4. Check status:"
    echo "     sudo systemctl status trainboard-display.timer"
    echo "     sudo journalctl -u trainboard-display.service -f"
    echo ""
    log_info "For detailed documentation, see:"
    echo "  $APP_DIR/RASPBERRY_PI_SETUP.md"
    echo ""
}

# Main installation flow
main() {
    echo ""
    echo "=========================================="
    echo "  Trainboard Raspberry Pi Setup Script"
    echo "=========================================="
    echo ""

    check_root
    check_platform

    log_info "Starting installation for user: $TRAINBOARD_USER"
    log_info "Installation directory: $APP_DIR"
    echo ""

    # System configuration
    enable_spi
    ensure_user_exists
    setup_permissions

    # Software installation
    update_system
    install_system_deps
    install_nodejs
    install_bcm2835

    # Application setup
    setup_epaper_library
    setup_trainboard

    # Service configuration
    setup_services
    setup_logging

    # Completion
    show_next_steps
}

# Run main installation
main "$@"

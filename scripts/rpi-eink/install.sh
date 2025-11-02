#!/bin/bash
# install.sh
# Automated installation script for Trainboard on Raspberry Pi with e-ink display
# This script should be run on a fresh Raspberry Pi OS installation
#
# Environment variables:
#   TRAINBOARD_REPO - Repository URL to clone (default: https://github.com/kagelump/trainboard.git)
#
# Example:
#   TRAINBOARD_REPO=https://github.com/yourfork/trainboard.git ./install.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
APP_DIR="$HOME/trainboard"
EPAPER_DIR="$HOME/e-Paper"

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

# Check if running on Raspberry Pi
check_platform() {
    if [ ! -f /proc/device-tree/model ]; then
        log_warn "Cannot detect Raspberry Pi model. Proceeding anyway..."
        return
    fi

    model=$(cat /proc/device-tree/model)
    log_info "Detected: $model"
}

# Check if SPI is enabled
check_spi() {
    if lsmod | grep -q spi_bcm2835; then
        log_info "SPI interface is enabled"
        return 0
    else
        log_error "SPI interface is NOT enabled"
        log_error "Please enable SPI using: sudo raspi-config"
        log_error "Navigate to: Interface Options -> SPI -> Yes"
        return 1
    fi
}

# Install system dependencies
install_system_deps() {
    log_info "Updating system packages..."
    sudo apt update

    log_info "Installing system dependencies..."
    sudo apt install -y \
        chromium-browser \
        xvfb \
        python3-pip \
        python3-pil \
        python3-numpy \
        git \
        curl \
        wget || {
            log_error "Failed to install system dependencies"
            exit 1
        }

    log_info "System dependencies installed successfully"
}

# Install Node.js
install_nodejs() {
    if command -v node &> /dev/null; then
        log_info "Node.js is already installed: $(node --version)"
        return 0
    fi

    log_info "Installing Node.js 20.x..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs || {
        log_error "Failed to install Node.js"
        exit 1
    }

    log_info "Node.js installed: $(node --version)"
    log_info "npm installed: $(npm --version)"
}

# Install BCM2835 library
install_bcm2835() {
    if [ -f /usr/local/lib/libbcm2835.a ]; then
        log_info "BCM2835 library is already installed"
        return 0
    fi

    log_info "Installing BCM2835 library..."
    cd /tmp
    # Note: The BCM2835 library website only offers HTTP, not HTTPS
    # Using wget's certificate check and verifying integrity would be ideal in production
    wget -q http://www.airspayce.com/mikem/bcm2835/bcm2835-1.71.tar.gz
    tar zxf bcm2835-1.71.tar.gz
    cd bcm2835-1.71/
    sudo ./configure && sudo make && sudo make check && sudo make install || {
        log_error "Failed to install BCM2835 library"
        exit 1
    }
    cd ~
    rm -rf /tmp/bcm2835-1.71*

    log_info "BCM2835 library installed successfully"
}

# Clone and setup Waveshare e-Paper library
setup_epaper_library() {
    if [ -d "$EPAPER_DIR" ]; then
        log_info "E-Paper library directory already exists: $EPAPER_DIR"
        log_warn "Skipping clone. To reinstall, remove the directory first."
        return 0
    fi

    log_info "Cloning Waveshare e-Paper library..."
    git clone https://github.com/waveshare/e-Paper.git "$EPAPER_DIR" || {
        log_error "Failed to clone e-Paper library"
        exit 1
    }

    log_info "Installing Python dependencies for e-Paper..."
    cd "$EPAPER_DIR/RaspberryPi_JetsonNano/python"
    # Note: --break-system-packages is needed for Raspberry Pi OS bookworm and later
    # which uses externally-managed Python environments. In production, consider
    # using a virtual environment instead for better isolation.
    sudo pip3 install -r requirements.txt --break-system-packages || {
        log_error "Failed to install Python dependencies"
        exit 1
    }

    log_info "E-Paper library setup complete"
}

# Clone and setup trainboard application
setup_trainboard() {
    # Allow customization of repository URL for forks
    REPO_URL="${TRAINBOARD_REPO:-https://github.com/kagelump/trainboard.git}"

    if [ -d "$APP_DIR" ]; then
        log_warn "Trainboard directory already exists: $APP_DIR"
        read -p "Remove and reinstall? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            rm -rf "$APP_DIR"
        else
            log_info "Skipping trainboard installation"
            return 0
        fi
    fi

    log_info "Cloning trainboard repository from $REPO_URL..."
    git clone "$REPO_URL" "$APP_DIR" || {
        log_error "Failed to clone trainboard repository"
        exit 1
    }

    log_info "Installing trainboard dependencies..."
    cd "$APP_DIR"
    npm install || {
        log_error "Failed to install npm dependencies"
        exit 1
    }

    log_info "Building trainboard..."
    npm run build || {
        log_error "Failed to build trainboard"
        exit 1
    }

    log_info "Trainboard setup complete"
}

# Configure trainboard
configure_trainboard() {
    if [ -f "$APP_DIR/defaults.json" ]; then
        log_info "defaults.json already exists"
        return 0
    fi

    log_info "Creating defaults.json from example..."
    cp "$APP_DIR/config.example.json" "$APP_DIR/defaults.json"

    log_warn "Please edit $APP_DIR/defaults.json to adjust API_BASE_URL or defaults as needed"
    log_warn "Do NOT add secret API keys to defaults.json if you want them private; use the settings modal in the browser or deploy the Cloudflare proxy instead"
}

# Setup systemd services
setup_services() {
    log_info "Installing systemd service and timer..."

    # Make scripts executable
    chmod +x "$APP_DIR/scripts/rpi-eink/"*.sh

    # Copy service files
    sudo cp "$APP_DIR/scripts/rpi-eink/trainboard-display.service" /etc/systemd/system/
    sudo cp "$APP_DIR/scripts/rpi-eink/trainboard-display.timer" /etc/systemd/system/

    # Reload systemd
    sudo systemctl daemon-reload

    log_info "Systemd services installed"
    log_info "To enable auto-start: sudo systemctl enable trainboard-display.timer"
    log_info "To start now: sudo systemctl start trainboard-display.timer"
}

# Create log directory
setup_logging() {
    log_info "Setting up logging..."
    sudo touch /var/log/trainboard-display.log
    sudo chown $USER:$USER /var/log/trainboard-display.log
    mkdir -p "$HOME/.config/trainboard"
}

# Test the installation
test_installation() {
    log_info "Testing installation..."

    # Test web server
    log_info "Testing web server..."
    cd "$APP_DIR/dist"
    npx http-server -p 8080 > /tmp/test-server.log 2>&1 &
    SERVER_PID=$!
    sleep 3

    if curl -s -f http://localhost:8080 > /dev/null; then
        log_info "✓ Web server test passed"
    else
        log_error "✗ Web server test failed"
    fi

    kill $SERVER_PID 2>/dev/null || true

    # Test e-Paper library
    log_info "Testing e-Paper library..."
    if python3 -c "import sys; sys.path.append('$EPAPER_DIR/RaspberryPi_JetsonNano/python/lib'); from waveshare_epd import epd10in2_G" 2>/dev/null; then
        log_info "✓ E-Paper library import test passed"
    else
        log_error "✗ E-Paper library import test failed"
    fi
}

# Main installation flow
main() {
    echo "======================================"
    echo "Trainboard E-Ink Display Installation"
    echo "======================================"
    echo

    log_info "Starting installation process..."

    check_platform

    # Check SPI
    if ! check_spi; then
        log_error "Installation cannot continue without SPI enabled"
        log_error "Please enable SPI and run this script again"
        exit 1
    fi

    # Install components
    install_system_deps
    install_nodejs
    install_bcm2835
    setup_epaper_library
    setup_trainboard
    configure_trainboard
    setup_services
    setup_logging

    # Test
    test_installation

    echo
    echo "======================================"
    log_info "Installation complete!"
    echo "======================================"
    echo
    log_info "Next steps:"
    echo "  1. Edit $APP_DIR/defaults.json to change defaults (do NOT add private API keys)"
    echo "  2. Test the display: $APP_DIR/scripts/rpi-eink/update-display.sh"
    echo "  3. Enable auto-start: sudo systemctl enable trainboard-display.timer"
    echo "  4. Start the timer: sudo systemctl start trainboard-display.timer"
    echo
    log_info "For more information, see: $APP_DIR/RASPBERRY_PI_SETUP.md"
}

# Run main installation
main

#!/bin/sh
set -e

REPO="harryisfish/gitt"
INSTALL_DIR="/usr/local/bin"

# Detect OS
OS=$(uname -s)
case "$OS" in
    Darwin) os="apple-darwin" ;;
    Linux)  os="unknown-linux-gnu" ;;
    *)      echo "Error: unsupported OS: $OS"; exit 1 ;;
esac

# Detect architecture
ARCH=$(uname -m)
case "$ARCH" in
    x86_64|amd64)  arch="x86_64" ;;
    arm64|aarch64)  arch="aarch64" ;;
    *)              echo "Error: unsupported architecture: $ARCH"; exit 1 ;;
esac

TARGET="${arch}-${os}"
echo "Detected platform: ${TARGET}"

# Get latest version
LATEST=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" | grep '"tag_name"' | sed -E 's/.*"([^"]+)".*/\1/')
if [ -z "$LATEST" ]; then
    echo "Error: failed to get latest version"
    exit 1
fi
echo "Latest version: ${LATEST}"

# Download
URL="https://github.com/${REPO}/releases/download/${LATEST}/gitt-${TARGET}.tar.gz"
echo "Downloading ${URL}..."

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

curl -fsSL "$URL" -o "${TMP}/gitt.tar.gz"
tar xzf "${TMP}/gitt.tar.gz" -C "$TMP"

# Install
if [ -w "$INSTALL_DIR" ]; then
    mv "${TMP}/gitt" "${INSTALL_DIR}/gitt"
else
    echo "Installing to ${INSTALL_DIR} (requires sudo)..."
    sudo mv "${TMP}/gitt" "${INSTALL_DIR}/gitt"
fi

chmod +x "${INSTALL_DIR}/gitt"
echo "Installed gitt to ${INSTALL_DIR}/gitt"
echo "Run 'gitt' to start!"

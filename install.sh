#!/bin/sh
set -e

REPO="harryisfish/gitt"

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
LATEST=$(curl -fsSL -H "Accept: application/vnd.github+json" "https://api.github.com/repos/${REPO}/releases/latest" | grep '"tag_name"' | sed -E 's/.*"([^"]+)".*/\1/')
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

# Install: prefer user dir, fallback to /usr/local/bin
if [ -w "/usr/local/bin" ]; then
    INSTALL_DIR="/usr/local/bin"
else
    INSTALL_DIR="${HOME}/.local/bin"
    mkdir -p "$INSTALL_DIR"
fi

mv "${TMP}/gitt" "${INSTALL_DIR}/gitt"
chmod +x "${INSTALL_DIR}/gitt"

echo "Installed gitt to ${INSTALL_DIR}/gitt"

# Check if in PATH
case ":$PATH:" in
    *":${INSTALL_DIR}:"*) ;;
    *) echo "Note: add ${INSTALL_DIR} to your PATH:"; echo "  export PATH=\"${INSTALL_DIR}:\$PATH\"" ;;
esac

echo "Run 'gitt' to start!"

#!/bin/sh
set -e

REPO="harryisfish/gitt"

# Colors
BOLD='\033[1m'
DIM='\033[2m'
CYAN='\033[36m'
GREEN='\033[32m'
YELLOW='\033[33m'
RED='\033[31m'
RESET='\033[0m'

info()  { printf "  %b%s%b\n" "$DIM" "$1" "$RESET"; }
step()  { printf "  %b>%b %s\n" "$CYAN" "$RESET" "$1"; }
ok()    { printf "  %b✓%b %b\n" "$GREEN" "$RESET" "$1"; }
warn()  { printf "  %b!%b %s\n" "$YELLOW" "$RESET" "$1"; }
err()   { printf "  %b✗%b %s\n" "$RED" "$RESET" "$1"; exit 1; }

# Banner
printf "\n"
printf "  %b%bgitt%b %b— lightweight TUI git status monitor%b\n" "$BOLD" "$CYAN" "$RESET" "$DIM" "$RESET"
printf "  %b─────────────────────────────────────%b\n" "$DIM" "$RESET"
printf "\n"

# Detect platform
OS=$(uname -s)
case "$OS" in
    Darwin) os="apple-darwin" ;;
    Linux)  os="unknown-linux-gnu" ;;
    *)      err "Unsupported OS: $OS" ;;
esac

ARCH=$(uname -m)
case "$ARCH" in
    x86_64|amd64)  arch="x86_64" ;;
    arm64|aarch64)  arch="aarch64" ;;
    *)              err "Unsupported architecture: $ARCH" ;;
esac

TARGET="${arch}-${os}"
ok "Platform: ${BOLD}${TARGET}${RESET}"

# Get latest version
step "Checking latest version..."
LATEST=$(curl -fsSL -H "Accept: application/vnd.github+json" "https://api.github.com/repos/${REPO}/releases/latest" 2>/dev/null | grep '"tag_name"' | sed -E 's/.*"([^"]+)".*/\1/')
if [ -z "$LATEST" ]; then
    err "Failed to get latest version (GitHub API may be rate-limited)"
fi
ok "Latest version: ${BOLD}${LATEST}${RESET}"

# Download
URL="https://github.com/${REPO}/releases/download/${LATEST}/gitt-${TARGET}.tar.gz"
step "Downloading..."

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

curl -fsSL "$URL" -o "${TMP}/gitt.tar.gz" || err "Download failed"
tar xzf "${TMP}/gitt.tar.gz" -C "$TMP" || err "Extract failed"
ok "Downloaded"

# Install
if [ -w "/usr/local/bin" ]; then
    INSTALL_DIR="/usr/local/bin"
else
    INSTALL_DIR="${HOME}/.local/bin"
    mkdir -p "$INSTALL_DIR"
fi

step "Installing to ${INSTALL_DIR}"
mv "${TMP}/gitt" "${INSTALL_DIR}/gitt"
chmod +x "${INSTALL_DIR}/gitt"
ok "Installed"

# PATH check
printf "\n"
case ":$PATH:" in
    *":${INSTALL_DIR}:"*)
        printf "  %b%bReady!%b Run %bgitt%b to start.\n" "$GREEN" "$BOLD" "$RESET" "$CYAN" "$RESET"
        ;;
    *)
        warn "${INSTALL_DIR} is not in your PATH"
        info "Add this to your shell profile:"
        printf "\n"
        printf "    %bexport PATH=\"%s:\$PATH\"%b\n" "$BOLD" "$INSTALL_DIR" "$RESET"
        printf "\n"
        ;;
esac

printf "\n"

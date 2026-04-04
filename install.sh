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

info()  { printf "  ${DIM}%s${RESET}\n" "$1"; }
step()  { printf "  ${CYAN}>${RESET} %s\n" "$1"; }
ok()    { printf "  ${GREEN}✓${RESET} %s\n" "$1"; }
warn()  { printf "  ${YELLOW}!${RESET} %s\n" "$1"; }
err()   { printf "  ${RED}✗${RESET} %s\n" "$1"; exit 1; }

# Banner
printf "\n"
printf "  ${BOLD}${CYAN}gitt${RESET} ${DIM}— lightweight TUI git status monitor${RESET}\n"
printf "  ${DIM}─────────────────────────────────────${RESET}\n"
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
step "Downloading ${DIM}${URL}${RESET}"

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

step "Installing to ${BOLD}${INSTALL_DIR}${RESET}"
mv "${TMP}/gitt" "${INSTALL_DIR}/gitt"
chmod +x "${INSTALL_DIR}/gitt"
ok "Installed"

# PATH check
printf "\n"
case ":$PATH:" in
    *":${INSTALL_DIR}:"*)
        printf "  ${GREEN}${BOLD}Ready!${RESET} Run ${CYAN}gitt${RESET} to start.\n"
        ;;
    *)
        warn "${INSTALL_DIR} is not in your PATH"
        info "Add this to your shell profile:"
        printf "\n"
        printf "    ${BOLD}export PATH=\"${INSTALL_DIR}:\$PATH\"${RESET}\n"
        printf "\n"
        ;;
esac

printf "\n"

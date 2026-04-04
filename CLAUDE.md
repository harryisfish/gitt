# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Always reply me in Chinese.

## Project Overview

Gitt is a lightweight TUI git status monitor, designed to run in a small tmux split pane alongside CLI code editors (Claude Code, Codex, etc.). Built with Rust.

## Build and Development Commands

```bash
# Build (debug)
cargo build

# Build (release)
cargo build --release

# Run directly
cargo run

# Install globally
cargo install --path .
```

## Key Architecture

### Tech Stack
- **ratatui** — TUI rendering framework
- **crossterm** — terminal backend (keyboard, mouse, raw mode)
- **git2** — libgit2 bindings for git operations (no shell dependency)
- **anyhow** — error handling

### File Structure

```
src/
├── main.rs   # Entry point: terminal setup, event loop (2s tick refresh)
├── app.rs    # App state: tab management, keyboard/mouse event handling
├── git.rs    # Git operations: status, branches, log via libgit2
└── ui.rs     # UI rendering: tabs, status/branch/log views, footer
```

### Core Design

- **Tab-based UI**: Status (default) | Branch | Log
- **Mouse support**: click tabs, click list items, scroll wheel
- **Auto-refresh**: polls git state every 2 seconds
- **Minimal footprint**: designed for ~25 column width in a split pane
- **Event loop**: crossterm events with 2s tick rate for auto-refresh

### Tab Details

| Tab | Content |
|-----|---------|
| Status | File changes: staged (green), unstaged (yellow), untracked (red) |
| Branch | Local branches with current branch highlighted, ahead/behind counts |
| Log | Recent 50 commits with hash, message, relative time |

### Key Bindings

- `q` / `Ctrl+C` — quit
- `1/2/3` — switch tabs
- `Tab` / `Shift+Tab` — cycle tabs
- `j/k` or `↑/↓` — navigate list
- `r` — manual refresh

# Gitt

A lightweight TUI git status monitor, designed for tmux split panes alongside CLI code editors.

```
┌ gitt ── Status │ Branch │ Log ──┐
│  M src/main.rs            +3 -1 │
│  M Cargo.toml             +1 -0 │
│  ? .env                         │
│  A readme.md              +20   │
│─────────────────────────────────│
│ main  +3 ~1 ?1                  │
└─────────────────────────────────┘
```

## Why Gitt?

When you switch from VS Code / Cursor to terminal-based editors like Claude Code or Codex, you lose the built-in Git panel — no more file status, branch info, or commit history at a glance.

Gitt brings that back. It runs in a tmux split pane beside your editor, giving you a always-visible Git overview without leaving the terminal. Think of it as your **VS Code Git panel, but for the terminal workflow**.

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/harryisfish/gitt/main/install.sh | sh
```

Or install from crates.io:

```bash
cargo install gitt-monitor
```

Or build from source:

```bash
cargo install --git https://github.com/harryisfish/gitt.git
```

## Usage

```bash
# Run in any git repo
gitt
```

Best used in a tmux split pane:

```bash
tmux split-window -h -l 30% 'gitt'
```

## Features

- **Status tab** — staged, unstaged, and untracked files at a glance
- **Branch tab** — local branches with ahead/behind counts
- **Log tab** — recent commits with hash, message, and relative time
- **Mouse support** — click tabs, select items, scroll
- **Auto-refresh** — polls git state every 2 seconds
- **Minimal footprint** — works in ~25 column width

## Key Bindings

| Key | Action |
|-----|--------|
| `q` / `Ctrl+C` | Quit |
| `1` `2` `3` | Switch tab |
| `Tab` / `Shift+Tab` | Cycle tabs |
| `j` `k` / `↑` `↓` | Navigate |
| `r` | Refresh |

## License

[MIT](./LICENSE)

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Always reply me in Chinese.

## Project Overview

Gitt is a CLI tool for Git branch management, focusing on cleaning up deleted and stale local branches. It provides both automatic and interactive modes with safety features like worktree protection and merge status checking.

## Build and Development Commands

```bash
# Install dependencies
pnpm install

# Build the project (compiles TypeScript to dist/)
pnpm build

# Start in development mode (runs TypeScript directly with tsx)
pnpm start

# Development with watch mode
pnpm dev

# Link locally for testing (builds and creates global symlink)
pnpm dev:link

# Unlink after testing
pnpm dev:unlink
```

## Key Architecture

### Three-Phase Operation Model

All branch cleanup operations follow a three-phase pattern (see `src/commands/clean.ts`):

1. **Discovery Phase**: Fetch updates, analyze branches, check merge status
2. **Interaction/Filtering Phase**: Interactive selection or automatic filtering based on merge status
3. **Execution Phase**: Delete selected branches

### Main Branch Detection Priority

The tool uses a priority system to determine the main branch (`src/utils/git.ts:getMainBranch`):

1. `.gitt` config file (`mainBranch` field)
2. Git config `gitt.mainBranch`
3. Remote HEAD (`origin/HEAD`)
4. Common local branches (`main`, then `master`)

### Configuration System

Configuration is stored in `.gitt` file at project root with the following structure:

```typescript
interface GittConfig {
    mainBranch?: string;       // Preferred main branch name
    ignoreBranches?: string[]; // Glob patterns for branches to never delete
    staleDays?: number;        // Custom threshold for stale detection
}
```

The config system (`src/utils/config.ts`) merges changes with existing config to preserve other settings.

### Branch Detection Modes

**Default Mode** (`gone` branches):
- Uses `git branch -vv` to find branches with `[origin/xxx: gone]` in their labels
- These are local branches whose remote tracking branches were deleted

**Stale Mode** (`--stale` flag):
- Uses `git log -1 --format=%at <branch>` to get last commit timestamp
- Calculates days since last commit
- Default threshold: 90 days (customizable)

### Safety Features

**Worktree Protection** (`src/utils/git.ts:getWorktrees`):
- Parses `git worktree list` output to find branches in use
- Automatically excludes these branches from deletion
- Prevents "fatal: Cannot delete branch ... checked out at ..." errors

**Merge Status Checking** (`src/utils/git.ts:isBranchMerged`):
- Uses `git branch --merged <mainBranch>` to check merge status
- In automatic mode: only deletes merged branches
- In interactive mode: shows merge status and only pre-checks merged branches

**Branch Ignore Patterns**:
- Uses `minimatch` for glob pattern matching
- Filters out ignored branches before presenting options

## File Structure

```
src/
├── index.ts              # Entry point: CLI arg parsing, update checks, command routing
├── commands/
│   ├── clean.ts          # Core branch cleanup logic (three-phase operation)
│   └── config.ts         # set-main and ignore commands
├── utils/
│   ├── git.ts            # Git operations wrapper (main branch, merge check, worktrees)
│   └── config.ts         # .gitt config file read/write operations
└── errors.ts             # Custom error types and colored output helpers
```

## Important Implementation Details

### Error Handling
- Uses custom error classes: `GitError`, `UserCancelError`
- `handleError()` in `src/errors.ts` provides unified error handling with colored terminal output
- SIGINT/SIGTERM handlers convert interrupts to `UserCancelError` for clean exits

### Git Operations
- All Git operations use `simple-git` library
- Always fetch with `--prune` before analyzing branches to ensure remote state is current
- Before cleanup, switches to main branch and syncs with remote (`git fetch origin <main>` + `git pull`)

### Interactive Mode
- Uses `@inquirer/prompts` (specifically `checkbox`)
- Pre-checks merged branches by default for safety
- Shows merge status and reason (Remote deleted / Stale) in branch list

### Task Visualization
- Uses `listr2` for progress indication during multi-step operations
- Discovery phase and deletion phase each have their own task lists
- Deletion tasks are run sequentially (not concurrent) for stability

### Update Notifications
- Uses `update-notifier` with dynamic import (`eval('import(...)')`) to avoid TypeScript transpilation issues
- Checks for updates on every run but silently fails if unavailable

## Testing the Tool

When testing changes:

1. Always use `pnpm dev:link` to test the CLI globally
2. Test in a real Git repository with multiple branches
3. Use `--dry-run` first to preview changes
4. Test both modes: default (gone branches) and stale mode
5. Test with worktrees if modifying worktree detection
6. Remember to `pnpm dev:unlink` when done

## Common Development Patterns

When adding a new command:
1. Create command handler in `src/commands/`
2. Add command parsing logic in `src/index.ts` main()
3. Update help text in `printHelp()`
4. Use existing error handling patterns from `errors.ts`

When adding Git operations:
1. Add utility functions to `src/utils/git.ts`
2. Use try-catch and return sensible defaults on errors
3. Always use the `simpleGit()` instance from simple-git

When modifying config:
1. Update `GittConfig` interface in `src/utils/config.ts`
2. Use `writeConfigFile()` to merge with existing config (never overwrite)
3. Config changes should be reflected immediately on next run

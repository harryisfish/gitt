# Gitt

A command-line tool to delete local branches that have been deleted on the remote repository.

## Installation

Using npm:

```bash
npm install -g @harryisfish/gitt
```

Using pnpm:

```bash
pnpm add -g @harryisfish/gitt
```

## Usage

### Basic Commands

```bash
# Default behavior (auto-clean deleted branches)
gitt

# Interactive mode (select branches to delete)
gitt -i
# or
gitt --interactive

# Dry run (preview what would be deleted)
gitt -d
# or
gitt --dry-run

# Check version
gitt -v
# or
gitt --version

# Show help
gitt -h
# or
gitt --help
```

### Stale Branch Cleaning (NEW)

Clean up branches that haven't been updated for a long time:

```bash
# Find branches inactive for 90+ days (default)
gitt --stale

# Custom threshold (e.g., 30 days)
gitt --stale 30

# Preview stale branches without deleting
gitt --stale --dry-run

# Interactively select stale branches to delete
gitt --stale -i
```

**Note:** Stale branch detection:
- Checks the last commit date on each branch
- Automatically excludes the main branch
- Protects branches in use by Git worktrees
- Can be combined with interactive (`-i`) and dry-run (`-d`) modes


## Features

### 🔄 Auto Update Notification
Gitt automatically checks for updates on each run and notifies you when a new version is available.

### 🌳 Worktree Protection
Branches currently checked out in Git worktrees are automatically protected from deletion to prevent errors.

### 🧹 Smart Branch Cleanup
- **Remote-deleted branches**: Automatically detect and clean branches removed from remote
- **Stale branches**: Find and remove branches inactive for X days
- **Merge status check**: Safely handles both merged and unmerged branches
- **Interactive mode**: Manual selection with clear indicators
- **Dry-run mode**: Preview changes before applying

### 🛡️ Branch Protection
- Honors `.gitt` ignore patterns
- Respects Git worktree usage
- Never touches the main branch

## Configuration

### Main Branch Detection

Gitt automatically detects your main branch in the following order:
1. **`.gitt` configuration file** (Project level)
2. **Git config** `gitt.mainBranch` (User/System level)
3. **Remote HEAD** (e.g., `origin/HEAD`)
4. **Common names** (`main`, `master`)

### Setting the Main Branch

You can explicitly set the main branch for your project using the command:

```bash
gitt set-main <branch-name>
```

Example:
```bash
gitt set-main master
```

gitt set-main master
```

This will create a `.gitt` file in your project root with your preference.

### Branch Protection

You can prevent specific branches from being deleted by adding them to the ignore list.

**Using command (Recommended):**
```bash
gitt ignore "release/*"
gitt ignore "test-branch"
```

**Manual Configuration:**
You can also manually edit the `.gitt` configuration file:
```json
{
  "mainBranch": "main",
  "ignoreBranches": [
    "release/*",
    "test-branch",
    "feature/important-*"
  ]
}
```
Supports glob patterns (e.g., `*`).

## Documentation

- [Development Guide](./docs/DEVELOPMENT.md)
- [Contributing Guide](./docs/CONTRIBUTING.md)
- [Architecture Documentation](./docs/ARCHITECTURE.md)

## FAQ

### Q: What should I do when encountering "insufficient permissions" error?
A: Please ensure you have access permissions to the repository and have properly configured SSH keys or Git credentials.

### Q: How to handle merge conflicts?
A: When merge conflicts occur, Gitt will prompt you to resolve them manually. After resolution, use `gitt commit` to continue and complete the merge operation.

## Development

For detailed development guidelines, please refer to the [Development Guide](./docs/DEVELOPMENT.md).

## License

[MIT](./LICENSE)

---

If you find this project helpful, please give it a star ⭐️
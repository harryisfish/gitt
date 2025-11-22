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

```bash
gitt
```

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

This will create a `.gitt` file in your project root with your preference.

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
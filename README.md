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

Gitt automatically uses your Git global configuration. No additional setup required.

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
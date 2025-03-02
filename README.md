# Gitt

一个简单但功能强大的 Git 命令行工具，帮助你更轻松地管理 Git 仓库。

## 安装

使用 npm：

```bash
npm install -g @harryisfish/gitt
```

使用 pnpm：

```bash
pnpm add -g @harryisfish/gitt
```

## 使用方法

安装完成后，你可以在终端中使用 `gitt` 命令：

```bash
gitt
```

## 配置

Gitt 会自动使用你的 Git 全局配置。无需额外配置。

## 常见问题

### Q: 遇到 "权限不足" 错误怎么办？
A: 请确保你有相应仓库的访问权限，并且已经正确配置了 SSH 密钥或者 Git 凭证。

### Q: 如何处理合并冲突？
A: 当发生合并冲突时，Gitt 会提示你手动解决冲突。解决后，使用 `gitt` 继续完成合并操作。

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

[MIT](./LICENSE)

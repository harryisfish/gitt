# Gitt

一个简单但功能强大的 Git 命令行工具，帮助你更轻松地管理 Git 仓库。

愿景：
在代码管理中，我常常需要在本地 Repo 和远端 Repo 间处理代码版本。往往我需要很多输入很多很长的的命令才能达成目的。`gitt` 的愿景是提供一个简单的命令行界面，帮助你快速调用常用的 G it 命令。

## 特性

- 🚀 简化 本地 Repo 和远端 Repo 间 常用的 Git 操作
- 🎯 智能命令提示
- 🔄 自动化工作流
- 🛡️ 安全的操作验证

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

```bash
gitt
```

## 配置

Gitt 会自动使用你的 Git 全局配置。无需额外配置。

## 文档

- [开发文档](./docs/DEVELOPMENT.md)
- [贡献指南](./docs/CONTRIBUTING.md)
- [架构文档](./docs/ARCHITECTURE.md)

## 常见问题

### Q: 遇到 "权限不足" 错误怎么办？
A: 请确保你有相应仓库的访问权限，并且已经正确配置了 SSH 密钥或者 Git 凭证。

### Q: 如何处理合并冲突？
A: 当发生合并冲突时，Gitt 会提示你手动解决冲突。解决后，使用 `gitt commit` 继续完成合并操作。

## 开发相关

详细的开发指南请参考 [开发文档](./docs/DEVELOPMENT.md)。

## 许可证

[MIT](./LICENSE)

---

如果你觉得这个项目有帮助，欢迎 star ⭐️

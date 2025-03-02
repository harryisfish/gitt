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

## 开发相关

### 开发指南

如果你想参与开发，可以按照以下步骤进行：

#### 1. 克隆项目

```bash
git clone <项目地址>
cd gitt
pnpm install
```

#### 2. 开发模式运行

```bash
# 1. 构建并创建全局链接
pnpm dev:link

# 2. 创建一个测试用的 Git 仓库
mkdir test-repo
cd test-repo
git init
git remote add origin <你的测试仓库地址>

# 3. 现在你可以在这个测试仓库中运行
gitt

# 4. 测试完成后，取消全局链接
pnpm dev:unlink
```

### 版本发布

如果你是项目维护者，可以使用以下命令进行版本更新和发布：

#### 更新版本号

```bash
# 补丁号：修复 bug，小变动，如 v1.0.0 -> v1.0.1
npm version patch

# 次版本号：增加新功能，如 v1.0.0 -> v1.1.0
npm version minor

# 主版本号：不兼容的修改，如 v1.0.0 -> v2.0.0
npm version major
```

#### 发布包

```bash
npm publish
```

### 提交规范

提交代码时，请遵循以下 commit 规范：

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

type 类型：
- feat: 新功能
- fix: 修复 bug
- docs: 文档更新
- style: 代码格式调整
- refactor: 重构代码
- test: 添加测试
- chore: 构建过程或辅助工具的变动

## 许可证

[MIT](./LICENSE)

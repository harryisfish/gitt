# Gitt

这是一个命令行工具，用于帮助你管理 Git 仓库与远端仓库，如保持同步、推送、拉取等。

## 技术
1. 使用 Node.js 开发
2. 使用 TypeScript 开发
3. 使用 pnpm 包管理器

## 功能
1. 清理远程已删除的分支 - 自动清理那些在远程仓库已经被删除的本地分支

## 安装

使用 pnpm 安装（推荐）：
```bash
pnpm add -g gitt
```

或者使用 npm 安装：
```bash
npm install -g gitt
```

## 开发

1. 安装依赖
```bash
pnpm install
```

2. 开发模式运行
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

3. 构建
```bash
pnpm build
```

## 使用

在任何 Git 仓库目录下，运行：

```bash
gitt
```

然后使用方向键选择要执行的操作，按回车确认。

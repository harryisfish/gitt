# Gitt 开发文档

本文档将指导你如何参与 Gitt 项目的开发。

## 目录

- [Gitt 开发文档](#gitt-开发文档)
  - [目录](#目录)
  - [开发环境设置](#开发环境设置)
    - [前置要求](#前置要求)
    - [初始环境配置](#初始环境配置)
  - [项目结构](#项目结构)
  - [开发流程](#开发流程)
  - [测试指南](#测试指南)
    - [单元测试](#单元测试)
    - [代码覆盖率](#代码覆盖率)
  - [构建和发布](#构建和发布)
    - [本地构建](#本地构建)
    - [发布新版本](#发布新版本)
  - [调试技巧](#调试技巧)
    - [本地调试](#本地调试)
    - [常见问题解决](#常见问题解决)

## 开发环境设置

### 前置要求

- Node.js >= 16
- pnpm >= 8.0.0
- Git

### 初始环境配置

1. 克隆项目

```bash
git clone <repository-url>
cd gitt
```

2. 安装依赖

```bash
pnpm install
```

3. 设置开发环境

```bash
# 构建项目并创建全局链接
pnpm dev:link

# 现在你可以在任何目录使用 gitt 命令进行测试
gitt

# 开发完成后，取消全局链接
pnpm dev:unlink
```

## 项目结构

```
gitt/
├── src/                # 源代码目录
│   ├── commands/       # 命令实现
│   ├── utils/          # 工具函数
│   └── index.ts        # 入口文件
├── tests/              # 测试文件
├── dist/               # 构建输出目录
├── docs/              # 文档
└── scripts/           # 构建和开发脚本
```

## 开发流程

1. **创建功能分支**

```bash
git checkout -b feature/your-feature-name
```

2. **开发阶段**

```bash
# 启动开发模式
pnpm dev

# 运行测试
pnpm test

# 运行 lint 检查
pnpm lint
```

3. **提交代码**

我们使用 Conventional Commits 规范：

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

类型（type）必须是以下之一：

- feat: 新功能
- fix: 修复
- docs: 文档更新
- style: 代码格式（不影响代码运行的变动）
- refactor: 重构（既不是新增功能，也不是修复 bug）
- perf: 性能优化
- test: 增加测试
- chore: 构建过程或辅助工具的变动

4. **创建 Pull Request**

- 确保所有测试通过
- 更新相关文档
- 请求代码审查

## 测试指南

### 单元测试

```bash
# 运行所有测试
pnpm test

# 运行特定测试文件
pnpm test <test-file-name>

# 监听模式
pnpm test:watch
```

### 代码覆盖率

```bash
pnpm test:coverage
```

## 构建和发布

### 本地构建

```bash
pnpm build
```

### 发布新版本

1. 更新版本号

```bash
# 补丁版本 (1.0.0 -> 1.0.1)
npm version patch

# 次要版本 (1.0.0 -> 1.1.0)
npm version minor

# 主要版本 (1.0.0 -> 2.0.0)
npm version major
```

2. 发布到 npm

```bash
npm publish
```

## 调试技巧

### 本地调试

1. 使用 VS Code 调试

在 `.vscode/launch.json` 中已配置好调试设置，可直接使用。

2. 命令行调试

```bash
# 启用调试日志
DEBUG=gitt* gitt <command>
```

### 常见问题解决

1. 依赖安装问题
   - 清除 node_modules 并重新安装
   ```bash
   pnpm clean
   pnpm install
   ```

2. 构建错误
   - 检查 TypeScript 配置
   - 清理构建缓存
   ```bash
   pnpm clean:build
   pnpm build
   ``` 
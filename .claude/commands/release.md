---
description: 创建新版本发布，自动更新版本号、生成 changelog、创建 tag 并推送
argument-hint: <version>
allowed-tools: Bash(git:*), Bash(pnpm:*), Bash(npm:*), Read, Write, Glob, Grep
---

# Release

帮助创建 Gitt 项目的新版本发布。

## 参数

- `$ARGUMENTS`: 新版本号（如 1.7.0）

## 发布流程

请按以下步骤执行发布：

### 1. 前置检查

- 运行 `git status` 确认工作区干净
- 运行 `git branch --show-current` 确认在 main 分支
- 运行 `pnpm test` 确保测试通过
- 运行 `pnpm build` 确保构建成功

### 2. 更新版本

- 读取 `package.json`，将 `version` 字段更新为 `$ARGUMENTS`

### 3. 提交和打 Tag

```bash
git add package.json
git commit -m "chore: bump version to $ARGUMENTS"
git tag -a "v$ARGUMENTS" -m "Release v$ARGUMENTS"
```

### 4. 推送到远程

```bash
git push origin main
git push origin "v$ARGUMENTS"
```

推送 tag 后，GitHub Actions 会自动发布到 npm（通过 Trusted Publishing）。

## 安全检查

在执行任何操作前，请确认：

- [ ] 工作区无未提交的更改
- [ ] 当前在 main 分支
- [ ] 所有测试通过
- [ ] 版本号格式正确（semver: X.Y.Z）

如果任何检查失败，停止并告知用户。

## 示例

```
/release 1.7.0
```

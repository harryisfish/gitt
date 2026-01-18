# 自动更新功能实现计划

## 需求分析

### 用户需求
1. **自动检测更新** - 每次运行 gitt 时自动检测是否有新版本
2. **自动更新** - 检测到新版本后自动执行更新（无需用户确认）
3. **手动更新命令** - 提供 `gitt update` 命令让用户主动触发更新

### 现有功能
- `update-notifier` 已集成，用于检测更新并显示通知
- `gitt upgrade` 命令已实现交互式更新流程
- 配置系统支持 `.gitt` 文件存储项目级配置

## 实现方案

### 1. 全局配置支持

**新增文件**: `src/utils/globalConfig.ts`

```typescript
interface GlobalConfig {
    autoUpdate: boolean;        // 是否启用自动更新 (默认: false)
    lastUpdateCheck: number;    // 上次检查更新的时间戳
    updateCheckInterval: number; // 检查间隔(小时, 默认: 24)
}
```

**配置文件位置**: `~/.gittrc` (JSON 格式)

### 2. 自动更新流程

**修改文件**: `src/index.ts`

在 `main()` 函数中替换现有的 `update-notifier` 逻辑：

```
运行 gitt 命令
    ↓
检查是否启用 autoUpdate
    ↓ (启用)
距离上次检查是否超过 updateCheckInterval?
    ↓ (超过)
静默检查是否有新版本
    ↓ (有新版本)
自动执行更新 (无交互)
    ↓
更新 lastUpdateCheck 时间戳
    ↓
继续执行原命令
```

### 3. 新增命令

#### `gitt update` - 立即更新
```bash
gitt update          # 检查并更新到最新版本（无交互确认）
gitt update --check  # 仅检查，不自动更新
```

#### `gitt config` - 配置管理
```bash
gitt config auto-update on    # 启用自动更新
gitt config auto-update off   # 禁用自动更新
gitt config list              # 显示当前配置
```

### 4. 与现有 `upgrade` 命令的区别

| 命令 | 行为 | 用途 |
|------|------|------|
| `gitt upgrade` | 交互式，显示 changelog，需确认 | 用户想了解更新内容 |
| `gitt update` | 静默执行，无需确认 | 快速更新 |
| 自动更新 | 后台静默执行 | 保持最新版本 |

## 文件修改清单

### 新增文件
1. `src/utils/globalConfig.ts` - 全局配置读写
2. `src/commands/update.ts` - update 命令实现
3. `src/commands/configGlobal.ts` - config 命令实现

### 修改文件
1. `src/index.ts` - 添加自动更新逻辑和新命令注册
2. `src/commands/upgrade.ts` - 提取可复用的更新函数

## 实现步骤

### 步骤 1: 全局配置系统
- 创建 `~/.gittrc` 配置文件读写逻辑
- 实现配置验证和默认值

### 步骤 2: 提取更新核心逻辑
- 从 `upgrade.ts` 提取 `silentUpdate()` 函数（无交互版本）
- 保持 `upgradeCommand()` 用于交互式更新

### 步骤 3: 实现 `gitt update` 命令
- 静默检查并更新
- 支持 `--check` 选项仅检查

### 步骤 4: 实现 `gitt config` 命令
- `auto-update on/off` 开关
- `list` 显示配置

### 步骤 5: 集成自动更新到主流程
- 在 `main()` 中添加自动更新检查
- 仅在启用且间隔满足时触发

### 步骤 6: 更新帮助文档
- 更新 help 文本
- 更新 CLAUDE.md

## 用户体验

### 首次使用
```bash
$ gitt
✔ Fetch main from remote
✔ Analyze branches
✓ No branches need to be cleaned up

💡 Tip: Run "gitt config auto-update on" to enable automatic updates
```

### 启用自动更新后
```bash
$ gitt
⬆ Updating gitt v1.6.3 → v1.7.0...
✔ Updated successfully

✔ Fetch main from remote
...
```

### 手动更新
```bash
$ gitt update
✔ Already on the latest version (v1.6.3)

$ gitt update
⬆ Updating v1.6.3 → v1.7.0...
✔ Updated to v1.7.0
```

## 安全考虑

1. **自动更新默认关闭** - 用户需主动启用
2. **更新频率限制** - 默认 24 小时检查一次，避免频繁请求
3. **更新失败不阻塞** - 自动更新失败时静默跳过，不影响正常使用
4. **权限问题处理** - 全局安装可能需要 sudo，提供清晰提示

## 问题待确认

1. 自动更新是否需要支持 `major` 版本升级？（可能有破坏性变更）
2. 是否需要支持回滚功能？
3. 配置文件位置是否需要支持 XDG 规范？（`~/.config/gitt/config.json`）

# Agent Migrate

跨平台 Agent 配置迁移工具，支持 OpenClaw 和 Hermes Agent 的完整配置、记忆、工作空间迁移。

## 功能

- **导出**：将 OpenClaw / Hermes Agent 的配置、记忆、技能、工作空间打包为 `.agent-mig` 迁移文件
- **导入**：从迁移文件恢复所有配置到目标电脑
- **自动安装**：导入时自动检测并安装未安装的框架
- **跨平台**：支持 Windows / macOS / Linux
- **系统检测**：显示当前系统环境和框架安装状态

## 支持的框架

| 框架 | 配置目录 | 迁移内容 |
|------|---------|---------|
| OpenClaw | `~/.openclaw/` | openclaw.json, .env, sessions, memory, skills, workspace |
| Hermes Agent | `~/.hermes/` | config.yaml, .env, SOUL.md, MEMORY.md, USER.md, sessions, memory, skills, workspace, logs, cron |

## 安装要求

- **Node.js** >= 18.0
- npm >= 9.0

## 快速使用

### 1. 在源电脑上导出配置

```bash
# 导出所有已检测到的框架
node src/index.js export

# 指定输出文件
node src/index.js export --output ./my-migration.agent-mig

# 只导出特定框架
node src/index.js export --openclaw
node src/index.js export --hermes
```

### 2. 将迁移文件复制到目标电脑

将生成的 `.agent-mig` 文件通过 U盘、网络传输等方式复制到目标电脑。

### 3. 在目标电脑上导入配置

```bash
# 导入配置
node src/index.js import ./my-migration.agent-mig

# 自动安装缺失的框架
node src/index.js import ./my-migration.agent-mig --auto-install

# 只导入特定框架
node src/index.js import ./my-migration.agent-mig --openclaw
node src/index.js import ./my-migration.agent-mig --hermes
```

## 查看系统状态

```bash
node src/index.js status
```

输出示例：
```
=== agent-migrate v1.0.0 - System Status ===

Platform:        windows (x64)
Home Directory:  C:\Users\username
Node.js:         v24.14.0
npm:             11.9.0
Python:          Python 3.10.8

--- Frameworks ---
OpenClaw:        Installed
  Config Dir:    C:\Users\username\.openclaw
Hermes Agent:    Installed
  Config Dir:    C:\Users\username\.hermes
```

## 完整命令行选项

```
Usage:
  node src/index.js <command> [options]

Commands:
  status                    显示系统状态和已安装的框架
  export [options]          导出 Agent 配置到迁移文件
  import <file> [options]   从迁移文件导入 Agent 配置

Export Options:
  --output <path>           输出文件路径
  --openclaw                包含 OpenClaw 配置
  --hermes                  包含 Hermes Agent 配置
  --all                     包含所有检测到的框架（默认）

Import Options:
  --force                   覆盖现有配置
  --auto-install            自动安装缺失的框架
  --openclaw                只导入 OpenClaw 配置
  --hermes                  只导入 Hermes Agent 配置
  --all                     导入所有检测到的框架（默认）
```

## 迁移文件格式

`.agent-mig` 文件是 ZIP 压缩包，内部结构：

```
my-migration.agent-mig
├── manifest.json          # 元数据（版本、平台、日期等）
├── openclaw/              # OpenClaw 配置数据
│   ├── openclaw.json
│   ├── .env
│   ├── sessions/
│   ├── memory/
│   └── skills/
└── hermes/                # Hermes Agent 配置数据
    ├── config.yaml
    ├── .env
    ├── SOUL.md
    ├── MEMORY.md
    ├── sessions/
    ├── memory/
    ├── skills/
    └── workspace/
```

## 开发 / 打包

### 安装依赖

```bash
npm install
```

### 运行测试

```bash
npm test
```

### 打包为独立包

```bash
# 当前平台
node scripts/build.js

# 指定平台
node scripts/build.js windows
node scripts/build.js linux

# 所有平台
node scripts/build.js all
```

## 项目结构

```
agent-migrate/
├── src/
│   ├── index.js         # CLI 入口
│   ├── platform.js      # 平台检测
│   ├── detector.js      # 框架和环境检测
│   ├── archive.js       # ZIP 归档创建和提取
│   ├── openclaw.js      # OpenClaw 导出/导入
│   ├── hermes.js        # Hermes Agent 导出/导入
│   └── installer.js     # 框架自动安装
├── scripts/
│   └── build.js         # 打包脚本
├── tests/
│   └── test.js          # 集成测试
└── package.json
```

## 注意事项

- 迁移前请确保源电脑上 Agent 框架正常运行
- 跨平台迁移（如 Windows -> macOS）支持，但 API 密钥和路径配置可能需要手动调整
- 迁移文件包含 `.env` 等敏感文件，请妥善保管
- `--auto-install` 依赖网络连接到 npm registry

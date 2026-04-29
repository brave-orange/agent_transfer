# Agent Migrate

<p align="center">
  <img src="logo-128.png" alt="Agent Migrate Logo" width="128" height="128"/>
</p>

<p align="center">
  <strong>跨平台 Agent 配置迁移工具</strong>
</p>

<p align="center">
  一键导出 / 导入 OpenClaw 和 Hermes Agent 的完整配置、记忆、技能与工作空间。支持 CLI 命令行与 Electron 桌面 GUI 两种模式，跨 Windows / macOS / Linux 三平台。
</p>

<p align="center">
  <a href="https://nodejs.org">
    <img src="https://img.shields.io/badge/Node.js-%3E%3D18-green?logo=node.js" alt="Node.js"/>
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License"/>
  </a>
  <a href="#">
    <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey" alt="Platforms"/>
  </a>
</p>

---

## Features

- **一键导出** — 将 Agent 配置、记忆、会话、技能、工作空间打包为 `.agent-mig` 迁移文件
- **一键导入** — 从迁移文件完整恢复到目标电脑
- **自动安装** — 导入时检测并自动安装缺失的框架
- **跨平台** — Windows / macOS / Linux 无缝迁移
- **双模式** — Electron 桌面 GUI（零门槛）与 CLI 命令行（自动化）
- **安全检查** — 内置 Node.js / npm / Python 依赖检测
- **开源免费** — MIT License

## Supported Frameworks

| 框架 | 配置目录 | 迁移内容 |
|------|---------|---------|
| **OpenClaw** | `~/.openclaw/` | openclaw.json, .env, sessions, memory, skills, workspace |
| **Hermes Agent** | `~/.hermes/` | config.yaml, .env, SOUL.md, MEMORY.md, USER.md, sessions, memory, skills, workspace, logs, cron |

## Quick Start

### Electron GUI 桌面模式（推荐）

1. 从 [Releases](../../releases) 下载对应平台的安装包
2. 安装后打开 **Agent Migrate**
3. 在 **导出** 页面选择要迁移的框架，点击导出
4. 将生成的 `.agent-mig` 文件复制到目标电脑
5. 在目标电脑打开 **导入** 页面，选择文件并导入

### CLI 命令行模式

```bash
# 安装依赖
npm install

# 查看系统状态
node src/index.js status

# 导出所有框架配置
node src/index.js export

# 导入配置（自动安装缺失框架）
node src/index.js import ./my-migration.agent-mig --auto-install
```

## Development

### 环境要求

- Node.js >= 18.0
- npm >= 9.0

### 安装

```bash
git clone <repository-url>
cd agent-migrate
npm install
```

### 开发模式

```bash
# CLI 模式
npm start                    # node src/index.js status

# Electron GUI 开发模式
npm run electron:dev
```

### 测试

```bash
npm test
```

### 打包

```bash
# Electron 桌面应用打包（Windows）
npx electron-packager . Agent-Migrate --platform=win32 --arch=x64 --out=dist --overwrite --icon=logo.ico

# electron-builder 打包（安装包）
npm run electron:build -- --win nsis
npm run electron:build -- --mac dmg
npm run electron:build -- --linux AppImage

# 便携包
node scripts/build.js
```

## Project Structure

```
agent-migrate/
├── electron/                # Electron GUI 应用
│   ├── main.js              # 主进程（窗口管理、IPC、子进程）
│   ├── preload.js           # 安全桥接（contextBridge）
│   └── renderer/            # 渲染进程（界面）
│       ├── index.html       # 页面结构
│       ├── styles.css       # 深色主题样式
│       └── app.js           # 交互逻辑
├── src/                     # 核心模块
│   ├── index.js             # CLI 入口
│   ├── platform.js          # 平台 / 架构 / 路径检测
│   ├── detector.js          # 系统与环境检测
│   ├── archive.js           # ZIP 归档创建与提取
│   ├── openclaw.js          # OpenClaw 导出/导入
│   ├── hermes.js            # Hermes Agent 导出/导入
│   └── installer.js         # 框架自动安装
├── scripts/
│   ├── build.js             # 便携包构建脚本
│   └── icons.js             # 图标生成脚本
├── tests/
│   └── test.js              # 集成测试（导出/导入/还原）
├── dist/                    # 打包输出
├── logo.svg                 # Logo 源文件
└── package.json
```

## Migration File Format

`.agent-mig` 文件本质上是 ZIP 压缩包，内部结构如下：

```
my-migration.agent-mig
├── manifest.json          # 元数据（工具版本、平台、导出日期、框架列表）
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

## CLI Reference

```
Usage:
  node src/index.js <command> [options]

Commands:
  status                    显示系统状态和已安装的框架
  export [options]          导出 Agent 配置到迁移文件
  import <file> [options]   从迁移文件导入 Agent 配置

Export Options:
  --output <path>           输出文件路径（默认: ./agent-migration-<timestamp>.agent-mig）
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

## Notes

- 迁移前请确保源电脑上 Agent 框架正常运行
- 跨平台迁移（如 Windows -> macOS）完全支持，但 API 密钥和路径配置可能需要手动调整
- 迁移文件包含 `.env` 等敏感信息，请妥善保管
- `--auto-install` 需要网络连接以从 npm registry 拉取包

## License

[MIT](LICENSE)

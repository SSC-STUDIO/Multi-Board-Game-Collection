# 项目结构

本文档记录了完整的Steam发布标准项目结构。

## 📁 目录树

```
五子棋 · Gomoku/
│
├── 📄 index.html                 # Web应用入口
├── 📄 main.js                    # Electron主进程
│
├── 📦 src/                       # 源代码目录
│   ├── main.js                  # Web应用入口
│   │
│   ├── app/                     # 应用层
│   │   └── GomokuApp.js        # 应用主控制器
│   │
│   ├── game/                    # 游戏逻辑层
│   │   ├── ai.js               # AI算法实现
│   │   ├── rules.js            # 游戏规则
│   │   └── state.js            # 状态管理
│   │
│   ├── ui/                      # 表现层
│   │   ├── dom.js              # DOM操作
│   │   └── render.js           # 渲染引擎
│   │
│   ├── utils/                   # 工具层
│   │   ├── board.js            # 棋盘工具
│   │   └── formatters.js       # 格式化工具
│   │
│   ├── config/                  # 配置层
│   │   └── gameConfig.js       # 游戏配置
│   │
│   └── styles/                  # 样式文件
│       ├── main.css            # 主样式入口
│       ├── base.css            # 基础样式
│       ├── layout.css          # 布局样式
│       ├── components.css      # 组件样式
│       └── responsive.css      # 响应式样式
│
├── 🎨 assets/                   # 游戏资源
│   ├── icons/                  # 游戏图标(待制作)
│   ├── screenshots/            # 游戏截图(待制作)
│   ├── trailers/               # 预告片(待制作)
│   ├── achievements/           # 成就图标(待制作)
│   ├── ASSETS_MANIFEST.md      # 资源清单(中文)
│   └── ASSETS_MANIFEST_EN.md   # 资源清单(英文)
│
├── 🌍 locales/                  # 本地化文件
│   ├── zh-CN.json              # 简体中文
│   └── en-US.json              # 英语(美式)
│
├── 🎮 steam/                    # Steam配置
│   ├── STEAM_CONFIG.md         # Steam商店配置
│   ├── achievements.json       # 成就配置
│   └── cloud_config.json       # 云存档配置
│
├── 📚 docs/                     # 文档目录
│   ├── DEVELOPER_GUIDE.md      # 开发者指南
│   ├── STEAM_INTEGRATION.md    # Steam集成指南
│   └── STEAM_RELEASE_CHECKLIST.md # Steam发布清单
│
├── 🛠️ tools/                    # 工具脚本
│   ├── build.mjs               # 构建脚本
│   ├── serve.mjs               # 本地服务器
│   └── check.mjs               # 代码检查
│
├── 📦 builds/                   # 构建输出
│   ├── web/                    # Web版本
│   └── desktop/                # 桌面版本
│
├── 📄 配置文件
│   ├── package.json            # NPM配置
│   ├── electron.json           # Electron打包配置
│   ├── version.json            # 版本信息
│   ├── steam_appid.txt         # Steam应用ID
│   ├── .env.example            # 环境变量模板
│   └── .gitignore              # Git忽略配置
│
└── 📝 项目文档
    ├── README.md               # 项目介绍
    ├── LICENSE                 # MIT许可证
    ├── CHANGELOG.md            # 更新日志
    └── CONTRIBUTING.md         # 贡献指南
```

## 📂 目录说明

### `/src` - 源代码
包含所有游戏源代码,采用分层架构:
- **应用层**: 应用编排和流程控制
- **游戏层**: 核心游戏逻辑(AI、规则、状态)
- **表现层**: UI渲染和DOM操作
- **工具层**: 通用工具函数
- **配置层**: 游戏配置和常量

### `/assets` - 游戏资源
存放所有游戏资源文件:
- **icons/**: 各种尺寸的游戏图标
- **screenshots/**: 游戏截图
- **trailers/**: 游戏预告片
- **achievements/**: Steam成就图标

### `/locales` - 本地化
多语言支持文件:
- **zh-CN.json**: 简体中文翻译
- **en-US.json**: 英语翻译

### `/steam` - Steam配置
Steamworks集成相关文件:
- **STEAM_CONFIG.md**: Steam商店配置文档
- **achievements.json**: 成就系统配置
- **cloud_config.json**: 云存档配置

### `/docs` - 文档
项目相关文档:
- **DEVELOPER_GUIDE.md**: 开发者技术文档
- **STEAM_INTEGRATION.md**: Steam集成指南
- **STEAM_RELEASE_CHECKLIST.md**: 发布准备清单

### `/tools` - 工具脚本
开发和构建工具:
- **build.mjs**: 构建Web版本
- **serve.mjs**: 本地开发服务器
- **check.mjs**: 代码检查工具

### `/builds` - 构建输出
存放构建产物:
- **web/**: Web版本构建输出
- **desktop/**: 桌面版本构建输出

## 🔧 配置文件说明

### `package.json`
NPM项目配置,包含:
- 项目元信息
- 依赖列表
- 构建脚本

### `electron.json`
Electron打包配置,定义:
- 应用ID和名称
- 打包目标平台
- 安装程序配置

### `version.json`
版本管理,包含:
- 应用版本号
- 平台支持信息
- Steam应用ID
- 更新日志

### `steam_appid.txt`
Steam应用ID配置文件,用于:
- Steamworks初始化
- 开发环境测试

### `.env.example`
环境变量模板,包含:
- Steam配置
- 服务器配置
- 调试配置

## 📝 文档文件说明

### `README.md`
项目主要介绍文档,包含:
- 游戏简介和特性
- 系统要求
- 快速开始指南
- 开发相关说明

### `LICENSE`
开源许可证(MIT),定义:
- 使用权限
- 责任声明
- 版权信息

### `CHANGELOG.md`
版本更新日志,记录:
- 版本历史
- 功能变更
- Bug修复

### `CONTRIBUTING.md`
贡献指南,说明:
- 如何报告Bug
- 如何提交功能建议
- 如何贡献代码

## 🎯 使用指南

### 开发
```bash
# 安装依赖
npm install

# 启动开发服务器
npm run serve

# 代码检查
npm run check
```

### 构建
```bash
# 构建Web版本
npm run build

# 构建Windows桌面版
npm run build:win

# 构建macOS桌面版
npm run build:mac

# 构建Linux桌面版
npm run build:linux

# 构建所有平台
npm run build:all
```

### 运行
```bash
# 运行Electron应用
npm start

# 开发模式运行
npm run start:dev
```

## 📊 文件统计

- **源代码文件**: 13个JavaScript文件
- **样式文件**: 5个CSS文件
- **配置文件**: 6个JSON配置
- **文档文件**: 7个Markdown文档
- **本地化文件**: 2个语言文件
- **总计**: 约33个核心文件

## 🔍 关键文件

### 必须文件(Steam发布)
✅ `index.html` - Web入口
✅ `package.json` - 项目配置
✅ `README.md` - 项目文档
✅ `LICENSE` - 许可证
✅ `steam_appid.txt` - Steam应用ID
✅ `electron.json` - 打包配置

### 重要文档
✅ `CHANGELOG.md` - 更新日志
✅ `CONTRIBUTING.md` - 贡献指南
✅ `docs/DEVELOPER_GUIDE.md` - 开发指南
✅ `docs/STEAM_INTEGRATION.md` - Steam集成

### 待制作资源
⬜ `assets/icons/*` - 游戏图标
⬜ `assets/screenshots/*` - 游戏截图
⬜ `assets/achievements/*` - 成就图标

---

**注意**: 本文档会随着项目进展持续更新。
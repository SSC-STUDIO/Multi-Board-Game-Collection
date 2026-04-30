<div align="center">

# 🎮 五子棋 · Gomoku

**一款精致的五子棋游戏**

[![Steam](https://img.shields.io/badge/Steam-即将推出-blue?logo=steam&logoColor=white)](https://store.steampowered.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Version](https://img.shields.io/badge/Version-1.0.0-orange.svg)](version.json)

[English](#english) | [简体中文](#简体中文)

<img src="assets/screenshots/screenshot_01.png" alt="游戏截图" width="600"/>

</div>

---

## 简体中文

### 🎯 游戏简介

五子棋 · Gomoku 是一款现代化的五子棋游戏,为玩家提供沉浸式的对弈体验。无论是休闲娱乐还是策略竞技,都能满足您的需求。

### ✨ 核心特性

#### 🎮 多样化的游戏模式
- **人人对战** - 与好友面对面博弈,享受真人对抗的乐趣
- **人机对战** - 挑战智能AI,测试你的棋艺水平
- **练习模式** - 轻松探索棋局变化,提升战术技巧

#### 📋 灵活的规则选择
- **经典规则** - 连五即胜,简单直接,适合新手入门
- **禁手规则** - 黑方禁止三三、四四、长连,更具策略深度,适合高手竞技

#### 🤖 智能AI系统
- **轻松** - 适合新手练习,轻松获胜
- **进阶** - 中等难度,需要一定技巧
- **大师** - 高难度挑战,需要深思熟虑

#### 💡 实用辅助功能
- **悔棋** - 回退不当落子,重新思考策略
- **提示** - AI推荐最佳落子位置
- **换边** - 随时切换执子方
- **认输** - 投子认负,快速结束对局

#### 🎨 精美的界面设计
- 现代化UI设计,赏心悦目
- 流畅的动画效果,丝滑体验
- 实时局势分析,洞察棋局
- 完整的棋谱记录,复盘学习

#### 📊 丰富的统计信息
- 实时手数统计
- 当前玩家显示
- 最后一手标记
- 局势阶段分析
- 对局节奏提示

### 🎮 游戏玩法

#### 基本规则
- 黑子先行,白子后手
- 轮流落子,连成五子获胜
- 可以横向、纵向、斜向连线

#### 禁手规则(可选)
- **三三禁手**: 黑方同时形成两个活三
- **四四禁手**: 黑方同时形成两个四
- **长连禁手**: 黑方形成六子或更多连线

### 💻 系统要求

#### 最低配置
- **操作系统**: Windows 7 SP1 / macOS 10.13 / Linux (任意主流发行版)
- **处理器**: Intel Core i3 或同等性能
- **内存**: 2 GB RAM
- **显卡**: 支持现代浏览器的集成显卡
- **存储空间**: 100 MB 可用空间

#### 推荐配置
- **操作系统**: Windows 10 / macOS 12 / Linux (Ubuntu 20.04+)
- **处理器**: Intel Core i5 或更高
- **内存**: 4 GB RAM
- **显卡**: 支持现代浏览器的独立显卡
- **存储空间**: 200 MB 可用空间

### 🚀 快速开始

#### Web版本
```bash
# 克隆仓库
git clone https://github.com/yourusername/gomoku.git
cd gomoku

# 安装依赖(可选)
npm install

# 启动本地服务器
npm run serve

# 浏览器访问
# http://localhost:4173
```

#### Android APK
```bash
npm install
npm run android:build:debug
```

可直接安装的 APK 输出到 `output/android/Gomoku-1.0.0-debug.apk`，原始 Gradle 产物在 `android/app/build/outputs/apk/debug/app-debug.apk`。LLM 本地服务地址说明见 [Android APK 文档](docs/ANDROID.md)。

#### 桌面版本(Steam)
1. 访问Steam商店页面(即将开放)
2. 购买并下载游戏
3. 安装后即可开始游戏

### 🛠️ 开发相关

#### 技术栈
- **前端**: 原生JavaScript (ES Modules)
- **样式**: 原生CSS (CSS Variables)
- **架构**: 分层模块化设计
- **打包**: Capacitor (Android APK)、Electron (桌面版本)

#### 项目结构
```text
.
├── index.html              # 主入口
├── capacitor.config.json   # Capacitor Android 配置
├── android                 # Android 原生工程
├── src
│   ├── main.js            # 应用入口
│   ├── app                # 应用层
│   ├── game               # 游戏逻辑层
│   ├── ui                 # 表现层
│   ├── utils              # 工具层
│   ├── config             # 配置层
│   └── styles             # 样式文件
├── assets                 # 游戏资源
├── locales                # 本地化文件
├── steam                  # Steam配置
└── docs                   # 文档
```

#### 本地开发
```bash
# 运行开发服务器
npm run serve

# 运行代码检查
npm run check

# 构建Web版本
npm run build

# 构建桌面版本
npm run build:desktop
```

详细开发文档请查看 [开发者指南](docs/DEVELOPER_GUIDE.md)。

### 📝 更新日志

查看 [CHANGELOG.md](CHANGELOG.md) 了解详细的版本更新历史。

#### v1.0.0 (即将发布)
- 🎮 完整的五子棋游戏核心
- 👥 人人对战、人机对战、练习模式
- 📋 经典规则和禁手规则
- 🤖 三种AI难度等级
- 🎨 现代化UI设计
- 💡 完整的辅助功能

### 🤝 贡献指南

我们欢迎所有形式的贡献! 请查看 [CONTRIBUTING.md](CONTRIBUTING.md) 了解如何:

- 🐛 报告Bug
- 💡 提出新功能建议
- 📝 改进文档
- 🎨 设计游戏资源
- 🔧 贡献代码

### 📄 许可证

本项目采用 [MIT License](LICENSE) 开源协议。

您可以自由地:
- ✅ 商业使用
- ✅ 修改代码
- ✅ 分发副本
- ✅ 私人使用

唯一的要求是保留原始版权声明。

### 🎯 未来计划

#### v1.1 (计划中)
- 在线多人对战
- 更多AI难度等级
- 自定义主题
- Steam成就系统

#### v1.2 (计划中)
- 对局回放系统
- 棋谱导入导出
- Steam排行榜
- 音效系统

#### v2.0 (远期计划)
- 完整的在线竞技系统
- 天梯排名系统
- 赛季模式
- 教学模式
- 多语言支持

### 🌟 游戏特色

#### 为什么选择五子棋 · Gomoku?

1. **零门槛上手** - 简单直观的界面,新手也能快速开始
2. **深度策略** - 禁手规则让游戏更具竞技性
3. **智能AI** - 多难度AI适合各级别玩家
4. **完全免费** - Web版本永久免费,Steam版本同样免费
5. **开源透明** - MIT许可证,代码完全开源
6. **持续更新** - 定期添加新功能和优化

### 📞 联系我们

- **GitHub Issues**: [提交问题](https://github.com/yourusername/gomoku/issues)
- **Steam社区**: (即将开放)
- **官方网站**: (即将开放)

### 🙏 致谢

感谢所有为这个项目做出贡献的开发者、设计师和玩家!

特别感谢:
- 五子棋爱好者社区
- Steam平台
- Electron框架
- 所有开源项目贡献者

---

## English

### 🎯 About

Gomoku is a modern five-in-a-row game that provides an immersive gaming experience. Whether for casual entertainment or strategic competition, it meets your needs.

### ✨ Key Features

#### 🎮 Multiple Game Modes
- **Player vs Player** - Face-to-face competition with friends
- **Player vs AI** - Challenge intelligent AI opponents
- **Practice Mode** - Explore game variations freely

#### 📋 Flexible Rules
- **Classic Rules** - Connect five to win, simple and direct
- **Renju Rules** - Black forbidden from 3-3, 4-4, and overline, more strategic depth

#### 🤖 Intelligent AI System
- **Easy** - Suitable for beginners
- **Medium** - Requires some skill
- **Master** - High difficulty challenge

#### 💡 Practical Assistance
- **Undo** - Take back moves
- **Hint** - AI recommends best moves
- **Swap Sides** - Switch colors anytime
- **Resign** - Concede the game

#### 🎨 Beautiful UI Design
- Modern UI design
- Smooth animations
- Real-time game analysis
- Complete move history

### 🚀 Quick Start

```bash
# Clone repository
git clone https://github.com/yourusername/gomoku.git
cd gomoku

# Start local server
npm run serve

# Visit in browser
# http://localhost:4173
```

### Android APK

```bash
npm install
npm run android:build:debug
```

The debug APK is generated at `android/app/build/outputs/apk/debug/app-debug.apk`.
The side-load friendly copy is `output/android/Gomoku-1.0.0-debug.apk`.
See [Android APK docs](docs/ANDROID.md) for install steps and LLM endpoint notes.

### 💻 System Requirements

#### Minimum
- **OS**: Windows 7 SP1 / macOS 10.13 / Linux
- **Processor**: Intel Core i3 or equivalent
- **Memory**: 2 GB RAM
- **Storage**: 100 MB available space

#### Recommended
- **OS**: Windows 10 / macOS 12 / Linux (Ubuntu 20.04+)
- **Processor**: Intel Core i5 or better
- **Memory**: 4 GB RAM
- **Storage**: 200 MB available space

### 📝 Changelog

See [CHANGELOG.md](CHANGELOG.md) for detailed version history.

### 🤝 Contributing

We welcome all forms of contribution! Please see [CONTRIBUTING.md](CONTRIBUTING.md) to learn how to:

- 🐛 Report bugs
- 💡 Suggest new features
- 📝 Improve documentation
- 🎨 Design game assets
- 🔧 Contribute code

### 📄 License

This project is licensed under the [MIT License](LICENSE).

---

<div align="center">

**如果喜欢这个项目,请给我们一个 ⭐️ Star!**

Made with ❤️ by [Your Name]

[Steam](https://store.steampowered.com/) | [GitHub](https://github.com/yourusername/gomoku) | [Documentation](docs/DEVELOPER_GUIDE.md)

</div>

# 项目结构

本文档描述仓库的目录拓扑与各层职责。架构原则：**每款游戏自洽成模块，共享设施单独分层**。

## 根目录

```
.
├── index.html               # Web 入口（启动器 + 两款游戏面板）
├── sw.js                    # PWA Service Worker（预缓存清单 + 缓存策略）
├── manifest.json            # PWA manifest
├── electron-main.js         # Electron 主进程（package.json "main" 与 electron.json 共用）
├── electron-preload.js      # Electron 预加载脚本
├── electron.json            # electron-builder 打包配置
├── capacitor.config.json    # Capacitor Android 配置
├── vite.config.js           # Vite 构建配置（builds/web 输出）
├── vitest.config.js         # Vitest 测试配置
├── version.json             # 版本与更新日志
├── package.json
├── src/                     # 源代码（见下）
├── android/                 # Android 原生工程（Capacitor 生成）
├── assets/                  # 图标、截图、纹理等静态资源
├── docs/                    # 文档（本文件所在；docs/notes/ 为开发过程笔记归档）
├── steam/                   # Steam 商店/成就/云存档配置
├── tools/                   # 构建与开发脚本（serve/check/build/clean 等）
├── ai/                      # Agent 工作流提示词与任务计划
└── .bugs/                   # Bug 跟踪工作流（NEW → IN_PROGRESS → RESOLVED → ARCHIVED）
```

被 git 忽略的本地目录：`node_modules/`、`builds/`（构建输出）、`output/`（APK 产物）、`chrome/`（本地浏览器缓存）。

## src/ 分层

```
src/
├── main.js                  # 应用入口：DOMContentLoaded 后挂载启动器
│
├── app/                     # 跨游戏应用壳
│   ├── BoardGameApp.js      # 共享生命周期骨架（围棋使用）
│   └── controllers/
│       ├── LauncherController.js   # 启动器网格渲染与进入游戏
│       └── CoachController.js      # LLM 教练控制器（两款游戏共用）
│
├── games/                   # 每款游戏一个自洽目录
│   ├── registry.js          # 注册表：元数据 + 懒加载 enter() 工厂
│   ├── gomoku/
│   │   ├── GomokuApp.js     # 应用主类（装配 DOM/控制器/渲染器/音效）
│   │   ├── state.js         # 状态工厂（不可变快照）
│   │   ├── rules.js         # 规则引擎（胜负、禁手）
│   │   ├── ai.js            # AI（三档难度 + 引导分析）
│   │   ├── controllers/     # 五子棋专属控制器
│   │   │   ├── GameController.js       # 对局流程与 AI 调度
│   │   │   ├── SettingsController.js   # 设置面板与 LLM 配置
│   │   │   ├── ImmersiveHudManager.js  # 沉浸式 HUD 显隐
│   │   │   └── InteractionManager.js   # 棋盘交互（选点→确认）
│   │   └── render3d/
│   │       └── GomokuRenderer3D.js     # 五子棋 3D 渲染器
│   └── go/
│       ├── GoApp.js         # 围棋应用（基于 BoardGameApp）
│       ├── state.js / rules.js / ai.js
│       ├── scoring.js       # 中国/日本规则计分
│       └── render3d/
│           └── GoRenderer3D.js         # 围棋 3D 渲染器
│
├── render3d/                # 共享 3D 引擎（Three.js），经 index.js 桶文件出口
│   ├── index.js
│   ├── SceneManager.js      # 场景/相机/渲染循环 + IBL 环境光照
│   ├── BoardBuilder.js      # 通用棋盘网格
│   ├── StoneBuilder.js      # 通用棋子网格
│   ├── MaterialFactory.js   # PBR 材质工厂
│   ├── CameraController.js  # 相机预设与轨道控制
│   ├── LightingSetup.js     # 灯光预设
│   ├── AnimationManager.js  # 落子/高亮动画
│   ├── InteractionHandler.js# 射线拾取交互
│   ├── EnvironmentBuilder.js# 桌面布景装配与氛围切换
│   ├── ParticleSystem.js    # 粒子效果
│   └── scenes/
│       ├── tabletop.js      # 共用桌面布景 + 三种氛围（家/公园/比赛）
│       └── props.js         # 桌面道具
│
├── ui/                      # 表现层：dom.js（引用/事件）、render.js（渲染）、
│                            # confirmDialog.js、devPanel.js
├── config/                  # gameConfig / sceneConfig / renderConfig
├── utils/                   # board（坐标）、formatters、i18n（中/英）
├── audio/SoundManager.js    # Web Audio 音效
├── services/                # llmCoach（教练 API）、aiCommentary（解说）、
│                            # boardImageAnalyzer（棋盘识图）
├── locales/                 # zh.json / en.json（i18n 运行时 fetch）
├── styles/                  # main / base / layout / components / responsive
└── test-setup.js            # Vitest 全局设置
```

## 约定

- **测试同目录**：`<module>.test.js` 与源文件放在一起，Vitest 通过 `src/**/*.test.js` 收集。
- **依赖方向**：`games/<game>/` 的纯逻辑（state/rules/ai）只依赖 `config/` 与 `utils/`；应用类可依赖共享层；`render3d/` 只依赖 `config/` 与 Three.js；禁止共享层反向依赖某个具体游戏（例外：CoachController 按 gameType 调用各游戏的指导函数）。
- **新增游戏**：在 `src/games/<id>/` 下建自洽目录（App/state/rules/ai/render3d），在 `registry.js` 登记元数据与懒加载入口，并把运行时文件补进 `sw.js` 预缓存清单。
- **浏览器模块解析**：无打包器，`index.html` 的 import map 将 `three` 与 `three/addons/` 指到 `node_modules/`；新增裸导入需同步 import map。

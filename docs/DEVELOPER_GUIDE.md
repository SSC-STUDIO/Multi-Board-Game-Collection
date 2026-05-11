# 开发者文档

五子棋 · Gomoku 项目技术文档

## 🏗️ 项目架构

### 整体架构

本项目采用现代化的分层架构设计,将应用分为多个独立的模块:

```
┌─────────────────────────────────────────┐
│             表现层 (UI)                  │
│  ┌─────────────┐      ┌──────────────┐  │
│  │   DOM操作    │      │    渲染器    │  │
│  └─────────────┘      └──────────────┘  │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│           应用层 (Application)           │
│  ┌─────────────────────────────────────┐│
│  │        GomokuApp (应用编排)          ││
│  └─────────────────────────────────────┘│
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│            业务层 (Game)                 │
│  ┌────────┐  ┌────────┐  ┌───────────┐  │
│  │ 状态    │  │ 规则    │  │    AI     │  │
│  └────────┘  └────────┘  └───────────┘  │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│           工具层 (Utils)                 │
│  ┌────────────┐  ┌──────────────────┐   │
│  │ 棋盘工具    │  │   格式化工具      │   │
│  └────────────┘  └──────────────────┘   │
└─────────────────────────────────────────┘
```

### 模块说明

#### 1. 表现层 (UI Layer)
**位置**: `src/ui/`, `src/styles/`

**职责**:
- DOM元素查询和操作
- 界面渲染和更新
- 用户交互处理
- 视觉效果展示

**核心文件**:
- `dom.js` - DOM查询和操作工具
- `render.js` - 游戏界面渲染逻辑

#### 2. 应用层 (Application Layer)
**位置**: `src/app/`

**职责**:
- 应用初始化和编排
- 模块协调和通信
- 事件绑定和处理
- 流程控制

**核心文件**:
- `GomokuApp.js` - 主应用类,协调所有模块

#### 3. 业务层 (Game Layer)
**位置**: `src/game/`

**职责**:
- 游戏核心逻辑
- 状态管理
- 规则判断
- AI决策

**核心文件**:
- `state.js` - 游戏状态管理
- `rules.js` - 游戏规则实现
- `ai.js` - AI算法实现

#### 4. 工具层 (Utils Layer)
**位置**: `src/utils/`

**职责**:
- 通用工具函数
- 数据格式化
- 棋盘相关计算

**核心文件**:
- `board.js` - 棋盘坐标计算工具
- `formatters.js` - 数据格式化工具

#### 5. 配置层 (Config Layer)
**位置**: `src/config/`

**职责**:
- 集中管理配置常量
- 文案管理
- 游戏参数设置

**核心文件**:
- `gameConfig.js` - 游戏配置常量

---

## 🎮 核心模块详解

### GomokuApp - 应用主类

**文件**: `src/app/GomokuApp.js`

**职责**: 应用的主控制器,负责初始化所有模块并协调它们的工作。

**核心方法**:
- `constructor()` - 初始化应用
- `bindEvents()` - 绑定所有UI事件
- `startGame()` - 开始新游戏
- `handleCellClick()` - 处理棋盘点击
- `undo()` - 悔棋功能
- `restart()` - 重新开始

**依赖模块**:
- GameState (游戏状态)
- GameRules (游戏规则)
- AI (人工智能)
- Renderer (渲染器)

**示例**:
```javascript
import GomokuApp from './app/GomokuApp.js';

const app = new GomokuApp();
// 应用自动初始化并开始运行
```

---

### GameState - 状态管理

**文件**: `src/game/state.js`

**职责**: 管理游戏的全部状态数据。

**状态结构**:
```javascript
{
  board: Array(15).fill(null).map(() => Array(15).fill(null)),
  currentPlayer: 'black',
  moveHistory: [],
  gameMode: 'pvp',      // 'pvp' | 'pve' | 'practice'
  rule: 'classic',       // 'classic' | 'renju'
  boardSize: 15,
  gameOver: false,
  winner: null
}
```

**核心方法**:
- `createInitialState()` - 创建初始状态
- `makeMove(state, row, col)` - 落子
- `undoMove(state)` - 撤销落子
- `switchPlayer(state)` - 切换玩家

---

### GameRules - 规则引擎

**文件**: `src/game/rules.js`

**职责**: 实现五子棋的所有规则判断。

**核心功能**:
1. **胜负判断**: 检查是否形成五子连珠
2. **禁手判断**: 判断黑方是否违反禁手规则(三三、四四、长连)
3. **有效落子判断**: 检查落子是否合法

**核心方法**:
- `checkWin(board, row, col, player)` - 检查是否获胜
- `checkForbiddenMove(board, row, col)` - 检查是否禁手
- `isValidMove(board, row, col)` - 检查落子是否有效

**禁手规则实现**:
```javascript
// 三三禁手: 同时形成两个活三
// 四四禁手: 同时形成两个四
// 长连禁手: 形成六子或更多连线
```

---

### AI算法

**文件**: `src/game/ai.js`

**职责**: 实现五子棋AI算法。

**算法原理**:
采用 **启发式评分 + 棋型识别** 的决策策略。轻松/进阶难度使用纯贪心评分，大师难度额外使用 minimax + alpha-beta 剪枝搜索。

**评估要素**:
1. **棋型评分** (`getLineScore`):
   - 连五: 500,000分
   - 活四 (openEnds=2): 80,000分
   - 冲四 (openEnds=1): 12,000分
   - 活三 (openEnds=2): 5,200分
   - 眠三 (openEnds=1): 1,000分
   - 活二 (openEnds=2): 380分
   - 眠二 (openEnds=1): 90分

2. **特殊棋型加成** (`getPatternBonus`):
   - 四子棋型匹配: +18,000分
   - 三子棋型匹配: +2,800分

3. **复合威胁加成** (`getCompositeBonus`):
   - 双活三: +120,000分
   - 四三配合: +200,000分
   - 双四: +150,000分
   - 单活四: +25,000分
   - 单活三: +3,000分

4. **位置权重**:
   - 中心偏置: 距离中心越近分数越高

5. **攻防评估**:
   - 进攻得分: 形成威胁棋型 (权重 1.18)
   - 防守得分: 阻止对手威胁 (权重 0.92)

**难度设置**:
- **轻松 (easy)**: 从前6个候选位置中随机选择 (纯贪心评分，无搜索)
- **进阶 (medium)**: 从前3个候选位置按分数权重概率选择 (纯贪心评分，无搜索)
- **大师 (hard)**: 使用 minimax + alpha-beta 剪枝搜索 (深度2-4层)，选择搜索最优位置

**核心方法**:
- `getBestMove(state, color)` - 获取最佳落子位置
- `getMoveGuidance(state, color)` - 获取落子建议和风险分析
- `evaluateMove(state, row, col, color)` - 评估单个位置得分
- `getAIDelay(level)` - 获取AI思考延迟时间

**示例**:
```javascript
import { getBestMove } from './game/ai.js';

const bestMove = getBestMove(gameState, 'black');
// 返回: { row: 7, col: 7 }
```

---

### Renderer - 渲染引擎

**文件**: `src/ui/render.js`

**职责**: 负责游戏界面的渲染和更新。

**渲染内容**:
1. 棋盘网格
2. 棋子(黑子/白子)
3. 最后落子标记
4. 状态信息
5. 棋谱记录

**核心方法**:
- `renderBoard(state)` - 渲染棋盘
- `renderStones(board)` - 渲染棋子
- `renderLastMove(row, col)` - 渲染最后落子标记
- `updateStatus(state)` - 更新状态信息
- `renderMoveHistory(history)` - 渲染棋谱

**优化策略**:
- 使用DocumentFragment减少DOM操作
- 事件委托优化点击处理
- 按需更新,避免全量渲染

---

## 🔧 工具函数

### 棋盘工具 (board.js)

**坐标转换**:
```javascript
// 数字坐标转字母坐标
indexToLetter(0)  // 'A'
indexToLetter(14) // 'O'

// 字母坐标转数字坐标
letterToIndex('A')  // 0
letterToIndex('O')  // 14
```

**坐标验证**:
```javascript
isValidCoordinate(row, col, boardSize)  // true/false
```

### 格式化工具 (formatters.js)

**时间格式化**:
```javascript
formatTime(seconds)  // "3:45"
```

**坐标格式化**:
```javascript
formatCoordinate(7, 7)  // "H8"
```

---

## 📊 数据流

### 用户操作流程

```
用户点击棋盘
    ↓
UI层捕获点击事件
    ↓
应用层处理业务逻辑
    ↓
├─ 检查是否轮到该玩家
├─ 验证落子是否合法
├─ 更新游戏状态
├─ 判断胜负
└─ 切换玩家
    ↓
游戏层返回新状态
    ↓
UI层重新渲染界面
    ↓
如果是对战AI
    ↓
AI计算最佳落子
    ↓
重复上述流程
```

### 状态管理流程

```
初始状态
    ↓
用户操作 → makeMove() → 新状态
    ↓
状态不可变(每次返回新对象)
    ↓
状态变更触发UI更新
```

---

## 🎨 样式系统

### CSS架构

项目采用分层CSS架构:

```
styles/
├── main.css         # 主入口,导入所有样式
├── base.css         # 基础样式(重置、变量、字体)
├── layout.css       # 布局样式(网格、容器)
├── components.css   # 组件样式(按钮、卡片)
└── responsive.css   # 响应式样式(媒体查询)
```

### CSS变量系统

```css
:root {
  /* 颜色变量 */
  --color-primary: #3b82f6;
  --color-success: #10b981;
  --color-danger: #ef4444;

  /* 棋盘颜色 */
  --board-bg: #dcb35c;
  --board-line: #8b7355;

  /* 棋子颜色 */
  --stone-black: #1a1a1a;
  --stone-white: #f5f5f5;

  /* 间距 */
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;
}
```

---

## 🧪 测试

### 运行测试

```bash
npm run check
```

### 测试覆盖范围

1. **规则测试**
   - 胜负判断
   - 禁手判断
   - 有效落子判断

2. **AI测试**
   - 评分函数正确性
   - 不同难度落子策略
   - 棋型识别与复合威胁检测

3. **工具函数测试**
   - 坐标转换
   - 格式化函数

---

## 🔐 安全考虑

### 输入验证
- 所有用户输入都进行验证
- 棋盘坐标范围检查
- 游戏状态验证

### XSS防护
- 不使用`innerHTML`插入用户内容
- 使用`textContent`设置文本
- DOM操作使用安全的API

---

## 📦 打包发布

### Web版本

当前项目是纯静态Web应用,可以直接部署到任何静态服务器。

```bash
# 构建生产版本(复制文件到builds目录)
npm run build

# 生成的文件可以直接上传到Web服务器
```

### Steam版本

使用Electron打包为桌面应用:

```bash
# 安装Electron
npm install --save-dev electron

# 打包
npm run build:steam
```

详细配置见 `steam/STEAM_CONFIG.md`

---

## 🔍 性能优化

### 已实施的优化

1. **DOM优化**
   - 事件委托
   - DocumentFragment批量操作
   - 按需渲染

2. **算法优化**
   - 启发式评分函数
   - 棋型模式识别
   - 位置权重评估

3. **资源优化**
   - 零依赖设计
   - 按需加载模块
   - CSS变量复用

### 性能指标

- 初始化时间: < 100ms
- AI响应时间(大师难度): < 2s
- 内存占用: < 50MB
- 包体积: < 5MB

---

## 🚀 扩展开发

### 添加新游戏模式

1. 在 `gameConfig.js` 添加模式配置
2. 在 `GomokuApp.js` 添加模式处理逻辑
3. 在 UI 中添加模式选择按钮
4. 更新 `rules.js` 实现特殊规则

### 添加新AI算法

1. 在 `ai.js` 中实现新算法
2. 添加评估函数
3. 设置难度参数
4. 测试不同场景

### 添加新UI主题

1. 创建新的CSS变量集
2. 添加主题切换功能
3. 保存用户主题偏好
4. 更新样式文件

---

## 📚 参考资源

### 五子棋算法
- [五子棋AI算法详解](https://www.aaai.org/)
- [启发式评估](https://en.wikipedia.org/wiki/Heuristic_evaluation)

### Web技术
- [MDN Web Docs](https://developer.mozilla.org/)
- [ES Modules](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Guide/Modules)
- [CSS Variables](https://developer.mozilla.org/zh-CN/docs/Web/CSS/Using_CSS_custom_properties)

### Steam开发
- [Steamworks文档](https://partner.steamgames.com/doc)
- [Electron文档](https://www.electronjs.org/docs)

---

## 🤝 贡献

如果您想改进本项目的架构或添加新功能,请查看 [CONTRIBUTING.md](../CONTRIBUTING.md)。

---

## 📄 许可证

本项目采用 MIT 许可证,详见 [LICENSE](../LICENSE)。

---

## 代码注释规范

### 文件级注释
每个源文件顶部需包含 `@module` JSDoc 注释，标明文件职责和所属模块。示例：

```javascript
/** 游戏状态管理：创建和初始化游戏状态 @module game/state */
```

### 导出函数
所有 `export` 导出的函数必须包含 JSDoc，标注 `@param` 和 `@returns`。复杂对象类型使用 `@typedef` 定义。示例：

```javascript
/**
 * 评估指定位置对指定玩家的价值
 * @param {GameState} state - 当前游戏状态
 * @param {number} row - 行坐标
 * @param {number} col - 列坐标
 * @param {string} color - 棋子颜色 ('black' | 'white')
 * @returns {number} 得分值
 */
export function evaluateMove(state, row, col, color) { ... }
```

### 导出常量
所有 `export` 导出的常量必须包含 `@type` JSDoc 注释。示例：

```javascript
/** @type {number} 练习模式的手数限制 */
export const PRACTICE_MOVE_LIMIT = 60;
```

### 非导出函数
内部函数（未 export）的 JSDoc 为可选，但必须有描述性的函数名或在函数体前添加行内注释说明其作用。

### 节标题
大型源文件应使用 `// === Section Name ===` 格式的节标题来划分逻辑区域。搜索算法、评分逻辑等应有独立的节。

### 非明显逻辑
复杂算法必须有行内注释说明"为什么"这么做，而非"做了什么"。例如禁手检测、alpha-beta 剪枝、复合威胁检测等处。

### 参考示例
`src/config/gameConfig.js` 是代码注释规范的正面示例，可作为对标参考。
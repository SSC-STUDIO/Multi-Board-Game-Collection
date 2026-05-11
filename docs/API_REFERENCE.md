# API 参考文档

五子棋 · Gomoku 技术 API 参考

---

## 📋 目录

1. [模块概览](#模块概览)
2. [核心模块](#核心模块)
3. [UI模块](#ui模块)
4. [工具模块](#工具模块)
5. [配置模块](#配置模块)
6. [类型定义](#类型定义)

---

## 模块概览

### 模块结构图

```
┌─────────────────────────────────────────────────────────────┐
│                        index.html                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        main.js                              │
│                   应用入口模块                               │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
    ┌─────────────────┐ ┌─────────┐ ┌─────────────────┐
    │   GomokuApp     │ │  DOM    │ │    Renderer     │
    │   (应用层)       │ │  (UI)   │ │    (UI)         │
    └────────┬────────┘ └─────────┘ └─────────────────┘
             │
    ┌────────┴────────┬──────────────────┐
    ▼                 ▼                  ▼
┌─────────┐    ┌───────────┐    ┌────────────┐
│  State  │    │   Rules   │    │     AI     │
│ (状态)  │    │  (规则)   │    │  (人工智能) │
└─────────┘    └───────────┘    └────────────┘
```

### 文件索引

| 模块 | 文件路径 | 职责 |
|------|----------|------|
| 应用入口 | `src/main.js` | 初始化应用 |
| 应用主控 | `src/app/GomokuApp.js` | 应用逻辑控制 |
| DOM操作 | `src/ui/dom.js` | DOM查询和操作 |
| 渲染器 | `src/ui/render.js` | UI渲染逻辑 |
| 状态管理 | `src/game/state.js` | 游戏状态 |
| 规则引擎 | `src/game/rules.js` | 规则判断 |
| AI算法 | `src/game/ai.js` | AI决策 |
| 棋盘工具 | `src/utils/board.js` | 棋盘计算 |
| 格式化工具 | `src/utils/formatters.js` | 数据格式化 |
| 游戏配置 | `src/config/gameConfig.js` | 配置常量 |

---

## 核心模块

### GomokuApp

应用主控制器，协调所有模块的工作。

```javascript
import { GomokuApp } from './app/GomokuApp.js';

// 创建应用实例
const app = new GomokuApp(document);
```

#### 构造函数

```typescript
constructor(root?: Document | Element): GomokuApp
```

**参数：**
- `root` - DOM根元素，默认为 `document`

**示例：**
```javascript
const app = new GomokuApp();
```

#### 方法

##### startGame()

开始新游戏。

```typescript
startGame(): void
```

**行为：**
1. 清空之前的游戏状态
2. 更新元数据显示
3. 渲染棋盘
4. 显示游戏界面
5. 如果是人机对战且玩家执白，启动AI

---

##### handleCellClick(row, col)

处理棋盘格子点击。

```typescript
handleCellClick(row: number, col: number): void
```

**参数：**
- `row` - 行索引（0 到 size-1）
- `col` - 列索引（0 到 size-1）

**行为：**
1. 检查游戏是否结束
2. 检查是否是玩家回合
3. 检查位置是否已有棋子
4. 检查禁手规则
5. 执行落子并更新状态
6. 检查胜负
7. 如果是人机对战，触发AI回合

---

##### undo()

悔棋功能。

```typescript
undo(): void
```

**行为：**
- 人人对战：撤销最后一步
- 人机对战：撤销两步（玩家和AI各一步）

---

##### showHint()

显示AI提示。

```typescript
showHint(): void
```

**行为：**
1. 计算最佳落子位置
2. 在棋盘上高亮显示建议位置
3. 显示提示消息

---

##### swapSides()

换边功能。

```typescript
swapSides(): void
```

**行为：**
- 人人对战：切换先手方
- 人机对战：切换玩家执子颜色

**限制：** 仅在游戏开始前（无落子记录）可用

---

##### restart()

重新开始游戏。

```typescript
restart(): void
```

**行为：**
1. 清空棋盘
2. 重置游戏状态
3. 重新渲染界面
4. 如果是人机对战且玩家执白，启动AI

---

##### resign()

认输。

```typescript
resign(): void
```

**行为：**
1. 标记游戏结束
2. 判定对方获胜
3. 显示结果界面

---

##### showPreview(cell)

显示落子预览。

```typescript
showPreview(cell: HTMLElement): void
```

**参数：**
- `cell` - 目标格子元素

---

##### clearPreview()

清除落子预览。

```typescript
clearPreview(): void
```

---

##### enterSetup()

返回设置界面。

```typescript
enterSetup(): void
```

---

#### 事件绑定

```typescript
bindEvents(): void
```

绑定所有UI事件：
- 选项按钮点击
- 控制按钮点击
- 棋盘点击
- 棋盘鼠标悬停
- 窗口大小变化

---

### GameState

游戏状态管理模块。

```javascript
import { createGameState, createOptions } from './game/state.js';
```

#### createGameState()

创建初始游戏状态。

```typescript
function createGameState(options: GameOptions): GameState
```

**参数：**
- `options` - 游戏选项配置

**返回：**
```typescript
interface GameState {
    board: (Stone | null)[][];      // 棋盘二维数组
    currentPlayer: Player;           // 当前玩家
    moveHistory: Move[];              // 落子历史
    lastMove: Move | null;           // 最后落子
    gameOver: boolean;               // 游戏是否结束
    winner: Player | null;           // 获胜者
    winningCells: Cell[];            // 获胜连线
    hintMove: Cell | null;           // 提示位置
    aiThinking: boolean;             // AI思考中
    resultSummary: ResultSummary | null; // 结果摘要
    options: GameOptions;            // 游戏选项
}
```

---

##### createOptions()

创建游戏选项默认值。

```typescript
function createOptions(overrides?: Partial<GameOptions>): GameOptions
```

**返回：**
```typescript
interface GameOptions {
    mode: GameMode;     // 'pvp' | 'pve' | 'practice'
    rule: GameRule;     // 'classic' | 'renju'
    size: number;      // 棋盘尺寸 15 | 19
    level: Difficulty;  // 'easy' | 'medium' | 'hard'
    playerColor: Player; // 'black' | 'white'
}
```

**参数：**
- `overrides` - 可选的部分选项覆盖

---

## UI模块

### DOM操作

#### getDOMReferences()

获取所有DOM元素引用。

```typescript
function getDOMReferences(root?: Document | Element): DOMReferences
```

**返回结构：**
```typescript
interface DOMReferences {
    sections: {
        setup: HTMLElement;
        game: HTMLElement;
    };
    board: HTMLElement;
    message: HTMLElement;
    moveList: HTMLElement;
    aiThinking: HTMLElement;
    setupGroups: {
        ai: HTMLElement;
        color: HTMLElement;
    };
    optionGroups: {
        mode: HTMLElement;
        rule: HTMLElement;
        size: HTMLElement;
        level: HTMLElement;
        playerColor: HTMLElement;
    };
    meta: {
        mode: HTMLElement;
        rule: HTMLElement;
        size: HTMLElement;
    };
    status: {
        currentPlayer: HTMLElement;
        moveCount: HTMLElement;
        lastMove: HTMLElement;
        boardPhase: HTMLElement;
    };
    stage: {
        phasePill: HTMLElement;
        title: HTMLElement;
        subtitle: HTMLElement;
        turnSpotlight: HTMLElement;
        turnSpotlightText: HTMLElement;
        momentumText: HTMLElement;
        momentumNote: HTMLElement;
    };
    controls: {
        start: HTMLElement;
        back: HTMLElement;
        undo: HTMLElement;
        hint: HTMLElement;
        swap: HTMLElement;
        restart: HTMLElement;
        resign: HTMLElement;
    };
    result: {
        overlay: HTMLElement;
        badge: HTMLElement;
        title: HTMLElement;
        detail: HTMLElement;
        moves: HTMLElement;
        lastMove: HTMLElement;
        restart: HTMLElement;
        setup: HTMLElement;
    };
}
```

---

#### setActiveButton()

设置选项按钮的激活状态。

```typescript
function setActiveButton(group: HTMLElement, activeButton: HTMLElement): void
```

---

#### setActiveByValue()

根据值设置激活按钮。

```typescript
function setActiveByValue(
    group: HTMLElement,
    attribute: string,
    value: string
): void
```

---

### 渲染器

#### renderBoard()

渲染棋盘。

```typescript
function renderBoard(dom: DOMReferences, state: GameState): void
```

**行为：**
1. 清空现有棋盘
2. 创建新的格子元素
3. 渲染棋子
4. 标记最后落子
5. 标记获胜连线
6. 显示提示位置

---

#### updateStatus()

更新状态栏显示。

```typescript
function updateStatus(dom: DOMReferences, state: GameState): void
```

---

#### updateMoveList()

更新棋谱记录。

```typescript
function updateMoveList(dom: DOMReferences, moveHistory: Move[]): void
```

---

#### showMessage()

显示消息提示。

```typescript
function showMessage(
    dom: DOMReferences,
    text: string,
    type?: 'info' | 'success' | 'error'
): void
```

**参数：**
- `text` - 消息文本
- `type` - 消息类型（info/success/error）

---

#### showResultOverlay()

显示结果覆盖层。

```typescript
function showResultOverlay(
    dom: DOMReferences,
    summary: ResultSummary
): void
```

---

## 游戏规则模块

### checkWin()

检查是否获胜。

```typescript
function checkWin(
    board: Board,
    size: number,
    row: number,
    col: number,
    color: Player
): boolean
```

**返回：** 是否有五子连珠

---

### getWinningLine()

获取获胜连线。

```typescript
function getWinningLine(
    board: Board,
    size: number,
    row: number,
    col: number,
    color: Player
): Cell[]
```

**返回：** 获胜的棋子位置数组

---

### getForbiddenReason()

获取禁手原因。

```typescript
function getForbiddenReason(
    board: Board,
    size: number,
    rule: GameRule,
    row: number,
    col: number,
    color: Player
): string
```

**返回：** 空字符串表示不是禁手，否则返回禁手原因

**禁手类型：**
- `'黑方此处属于长连禁手。'`
- `'黑方此处属于四四禁手。'`
- `'黑方此处属于三三禁手。'`

---

### getLineInfo()

获取线信息。

```typescript
function getLineInfo(
    board: Board,
    size: number,
    row: number,
    col: number,
    dRow: number,
    dCol: number,
    color: Player
): LineInfo
```

**返回：**
```typescript
interface LineInfo {
    count: number;      // 连续棋子数
    openEnds: number;   // 开放端数
}
```

---

## AI模块

### getBestMove()

获取最佳落子位置。

```typescript
function getBestMove(state: GameState, color: Player): Cell | null
```

**参数：**
- `state` - 当前游戏状态
- `color` - AI执子颜色

**返回：** 最佳落子位置或null

**算法说明：**
- **轻松/进阶**：纯贪心策略，对所有候选位置进行启发式评分排序，难度通过随机性差异实现
  - 轻松：从前6个候选中随机选择
  - 进阶：从前3个候选中按分数权重概率选择
- **大师**：minimax 搜索 + alpha-beta 剪枝（深度2-4层，根据手数动态调整），选择搜索最优位置
- 评估因素：棋型得分、复合威胁加成、位置权重、攻防价值

---

### getMoveGuidance()

获取落子建议和风险分析。

```typescript
function getMoveGuidance(state: GameState, color: Player): MoveGuidance | null
```

**参数：**
- `state` - 当前游戏状态
- `color` - 执子颜色

**返回：** 包含建议位置、洞察标签、风险标签和备选方案

---

### getAIDelay()

获取AI思考延迟时间。

```typescript
function getAIDelay(level: Difficulty): number
```

**参数：** AI难度等级

**返回：** 延迟时间（毫秒）

---

### getMoveReview()

评估玩家实际落子与AI建议的偏差。

```typescript
function getMoveReview(state: GameState, row: number, col: number, color: Player): string
```

**参数：**
- `state` - 当前游戏状态
- `row` - 落子行索引
- `col` - 落子列索引
- `color` - 执子颜色

**返回：** 评价标签键名
- `'coachReviewFollowed'` - 与AI推荐一致
- `'coachReviewFlexible'` - 与推荐接近 (ratio >= 0.88)
- `'coachReviewDeviation'` - 偏离推荐 (ratio >= 0.56)
- `'coachReviewPunishable'` - 严重偏离推荐 (ratio < 0.56)

---

## 工具模块

### 棋盘工具

#### isInside()

检查坐标是否在棋盘内。

```typescript
function isInside(size: number, row: number, col: number): boolean
```

---

#### getOpponent()

获取对手颜色。

```typescript
function getOpponent(player: Player): Player
```

---

#### isBoardFull()

检查棋盘是否已满。

```typescript
function isBoardFull(board: Board): boolean
```

---

#### getStarPoints()

获取星位坐标集合。

```typescript
function getStarPoints(size: number): Set<string>
```

---

#### getResponsiveCellSize()

获取响应式格子尺寸。

```typescript
function getResponsiveCellSize(
    boardSize: number,
    viewportWidth: number
): number
```

---

### 格式化工具

#### formatMove()

格式化落子坐标。

```typescript
function formatMove(row: number, col: number): string
```

**示例：** `formatMove(7, 7)` 返回 `'H8'`

---

#### getPlayerLabel()

获取玩家标签文本。

```typescript
function getPlayerLabel(player: Player): string
```

**返回：** `'黑方'` 或 `'白方'`

---

## 配置模块

### gameConfig.js

游戏配置常量。

```javascript
import {
    MODE_LABELS,
    RULE_LABELS,
    AI_DELAY_BY_LEVEL,
    GAME_INTRO_MESSAGES,
    DIRECTIONS,
    FOUR_PATTERNS,
    THREE_PATTERNS
} from './config/gameConfig.js';
```

#### MODE_LABELS

游戏模式标签。

```typescript
const MODE_LABELS: Record<GameMode, string>
```

#### RULE_LABELS

规则标签。

```typescript
const RULE_LABELS: Record<GameRule, string>
```

#### AI_DELAY_BY_LEVEL

AI延迟时间配置。

```typescript
const AI_DELAY_BY_LEVEL: Record<Difficulty, number>
```

#### GAME_INTRO_MESSAGES

游戏介绍消息。

```typescript
const GAME_INTRO_MESSAGES: Record<GameMode, string>
```

#### DIRECTIONS

检查方向数组。

```typescript
const DIRECTIONS: [number, number][]
```

**值：**
```javascript
[[0, 1],   // 水平
 [1, 0],   // 垂直
 [1, 1],   // 对角线 /
 [1, -1]]  // 对角线 \
```

#### FOUR_PATTERNS

四子棋型模式。

```typescript
const FOUR_PATTERNS: string[]
```

#### THREE_PATTERNS

三子棋型模式。

```typescript
const THREE_PATTERNS: string[]
```

---

## 类型定义

### 基本类型

```typescript
// 玩家
type Player = 'black' | 'white';

// 棋子
type Stone = Player;

// 游戏模式
type GameMode = 'pvp' | 'pve' | 'practice';

// 游戏规则
type GameRule = 'classic' | 'renju';

// AI难度
type Difficulty = 'easy' | 'medium' | 'hard';

// 格子位置
interface Cell {
    row: number;
    col: number;
}

// 落子记录
interface Move extends Cell {
    color: Player;
    index: number;
}

// 结果摘要
interface ResultSummary {
    badge: string;
    title: string;
    detail: string;
    moves: number;
    lastMove: string;
    variant: 'result-win' | 'result-draw' | 'result-resign';
}

// 线信息
interface LineInfo {
    count: number;
    openEnds: number;
}

// AI落子建议
interface MoveGuidance {
    row: number;
    col: number;
    score: number;
    insight: string;
    risk: string;
    alternatives: Array<{
        row: number;
        col: number;
        score: number;
        reason: string;
    }>;
}
```

---

## 使用示例

### 基本使用

```javascript
import { GomokuApp } from './app/GomokuApp.js';

// 启动应用
document.addEventListener('DOMContentLoaded', () => {
    const app = new GomokuApp();
});
```

### 自定义游戏选项

```javascript
// 创建带有自定义选项的应用
const options = {
    mode: 'pve',           // 人机对战
    rule: 'renju',         // 禁手规则
    size: 15,              // 15x15棋盘
    level: 'medium',       // 中等难度
    playerColor: 'black'   // 玩家执黑
};

// 注意：当前版本选项通过UI设置
```

### 调用AI获取最佳落子

```javascript
import { getBestMove } from './game/ai.js';
import { createGameState, createOptions } from './game/state.js';

// 创建游戏状态
const state = createGameState(createOptions());

// 获取黑方最佳落子
const bestMove = getBestMove(state, 'black');

if (bestMove) {
    console.log(`最佳落子位置: ${bestMove.row}, ${bestMove.col}`);
}
```

### 检查禁手规则

```javascript
import { getForbiddenReason } from './game/rules.js';

// 检查某位置是否是黑方禁手
const reason = getForbiddenReason(
    board,     // 当前棋盘
    15,        // 棋盘尺寸
    'renju',   // 禁手规则
    7,         // 行
    7,         // 列
    'black'    // 黑方
);

if (reason) {
    console.log(`禁手原因: ${reason}`);
} else {
    console.log('可以落子');
}
```

---

**文档版本：** 1.0.1
**最后更新：** 2026-05-03
# Steamworks 集成指南

本文档说明如何将Steamworks SDK集成到五子棋游戏中。

## 📋 前置要求

1. **Steam开发者账号**
   - 注册Steamworks合作伙伴账号
   - 获取应用ID(App ID)

2. **Steamworks SDK**
   - 下载最新版SDK: https://partner.steamgames.com/doc/sdk
   - 版本要求: 1.53+

3. **Node.js依赖**
   ```bash
   npm install steamworks.js
   # 或
   npm install greenworks
   ```

## 🔧 集成步骤

### 1. 配置Steam应用ID

编辑 `steam_appid.txt`:
```
YOUR_ACTUAL_STEAM_APP_ID
```

### 2. 安装Steamworks SDK

将Steamworks SDK文件放入项目:
```
steam/
├── sdk/
│   ├── redistributable_bin/
│   │   ├── win64/
│   │   │   └── steam_api64.dll
│   │   ├── win32/
│   │   │   └── steam_api.dll
│   │   ├── osx/
│   │   │   └── libsteam_api.dylib
│   │   └── linux64/
│   │   │   └── libsteam_api.so
```

### 3. 配置成就系统

成就配置文件: `steam/achievements.json`

Steamworks控制台配置:
1. 登录Steamworks合作伙伴网站
2. 进入"Steam Features" → "Achievements"
3. 点击"Add Achievement"
4. 按照achievements.json配置添加每个成就
5. 上传成就图标(64×64 PNG)

### 4. 实现成就API

```javascript
// 在游戏代码中集成Steam成就
import Steamworks from 'steamworks.js';

class AchievementManager {
    constructor() {
        this.steamworks = null;
        this.init();
    }

    async init() {
        try {
            this.steamworks = Steamworks.init();
            console.log('Steamworks initialized successfully');
        } catch (error) {
            console.error('Failed to initialize Steamworks:', error);
        }
    }

    unlock(achievementId) {
        if (!this.steamworks) {
            console.warn('Steamworks not initialized');
            return false;
        }

        try {
            this.steamworks.unlockAchievement(achievementId);
            console.log(`Achievement unlocked: ${achievementId}`);
            return true;
        } catch (error) {
            console.error('Failed to unlock achievement:', error);
            return false;
        }
    }

    getAchievements() {
        if (!this.steamworks) return [];

        return this.steamworks.getAchievements();
    }

    getStats() {
        if (!this.steamworks) return {};

        return {
            gamesPlayed: this.steamworks.getStatInt('games_played'),
            gamesWon: this.steamworks.getStatInt('games_won'),
            winningStreak: this.steamworks.getStatInt('winning_streak')
        };
    }

    setStat(statName, value) {
        if (!this.steamworks) return false;

        try {
            this.steamworks.setStatInt(statName, value);
            this.steamworks.storeStats();
            return true;
        } catch (error) {
            console.error('Failed to set stat:', error);
            return false;
        }
    }
}

export default AchievementManager;
```

### 5. 在游戏中触发成就

```javascript
// 在GomokuApp.js中集成成就
import AchievementManager from './achievements/AchievementManager.js';

class GomokuApp {
    constructor() {
        this.achievements = new AchievementManager();
        this.bindEvents();
    }

    onGameWin(winner) {
        // 首胜成就
        const stats = this.achievements.getStats();
        if (stats.gamesWon === 0) {
            this.achievements.unlock('FIRST_WIN');
        }

        // 更新统计
        this.achievements.setStat('games_won', stats.gamesWon + 1);
        this.achievements.setStat('games_played', stats.gamesPlayed + 1);

        // 连胜成就
        const currentStreak = stats.winningStreak + 1;
        this.achievements.setStat('winning_streak', currentStreak);
        if (currentStreak >= 3) {
            this.achievements.unlock('WINNING_STREAK');
        }

        // 快速制胜成就
        const moveCount = this.state.moveHistory.length;
        if (moveCount <= 20) {
            this.achievements.unlock('QUICK_VICTORY');
        }

        // 战略大师成就(禁手规则)
        if (this.state.rule === 'renju' && winner === 'black') {
            this.achievements.unlock('STRATEGY_MASTER');
        }
    }

    onGameEnd() {
        const stats = this.achievements.getStats();

        // 棋道学徒成就
        if (stats.gamesPlayed >= 10) {
            this.achievements.unlock('APPRENTICE');
        }

        // 棋坛霸主成就
        if (stats.gamesPlayed >= 100) {
            this.achievements.unlock('MASTER_PLAYER');
        }
    }

    onPerfectGame() {
        // 完美对局成就(不使用悔棋)
        this.achievements.unlock('PERFECT_GAME');
    }
}
```

### 6. 配置云存档

Steamworks控制台配置:
1. 进入"Steam Features" → "Steam Cloud"
2. 启用云存档
3. 设置存档限制:
   - 最大文件大小: 1MB
   - 文件数量: 5

实现云存档API:
```javascript
class CloudStorage {
    constructor() {
        this.steamworks = null;
    }

    async save(filename, data) {
        try {
            const jsonData = JSON.stringify(data);
            // 使用Steamworks云存档API
            // this.steamworks.saveToCloud(filename, jsonData);
            console.log(`Saved to cloud: ${filename}`);
            return true;
        } catch (error) {
            console.error('Failed to save to cloud:', error);
            return false;
        }
    }

    async load(filename) {
        try {
            // const data = this.steamworks.loadFromCloud(filename);
            // return JSON.parse(data);
            return null;
        } catch (error) {
            console.error('Failed to load from cloud:', error);
            return null;
        }
    }
}

export default CloudStorage;
```

### 7. 打包Steam版本

更新package.json脚本:
```json
{
  "scripts": {
    "build:steam": "electron-builder --config electron.json --target steam",
    "build:win": "electron-builder --config electron.json --win",
    "build:mac": "electron-builder --config electron.json --mac",
    "build:linux": "electron-builder --config electron.json --linux"
  }
}
```

运行构建:
```bash
# Windows版本
npm run build:win

# macOS版本
npm run build:mac

# Linux版本
npm run build:linux

# 所有平台
npm run build:all
```

### 8. 上传到Steam

使用Steam上传工具:

```bash
# 安装Steam SDK上传工具
# 位于 sdk/tools/ContentBuilder/

# 配置上传脚本
steam_sdk/tools/ContentBuilder/steamcmd.sh +login YOUR_STEAM_ACCOUNT +run_app_build YOUR_APP_ID +quit
```

或在Steamworks控制台手动上传:
1. 进入"Admin" → "Upload Build"
2. 选择构建目录: `builds/desktop/`
3. 设置版本号
4. 点击"Upload"

## 📝 Steamworks功能清单

### ✅ 已实现配置
- [x] 成就系统配置
- [x] 云存档配置
- [x] 应用ID配置
- [x] 本地化支持

### 🔧 待实现功能
- [ ] Steamworks SDK集成代码
- [ ] 成就解锁逻辑
- [ ] 云存档同步逻辑
- [ ] Steam好友集成
- [ ] Steam排行榜
- [ ] Steam创意工坊

## 🎮 测试Steam功能

### 本地测试

1. **安装Steam客户端**
   - 确保Steam客户端正在运行
   - 使用开发者账号登录

2. **测试模式运行**
   ```bash
   npm run start:steam
   ```

3. **验证功能**
   - 成就解锁是否正确触发
   - 云存档是否正确同步
   - Steam overlay是否正常工作

### Steam测试环境

在Steamworks控制台:
1. 创建测试分支
2. 上传测试构建
3. 邀请测试用户
4. 获取测试反馈

## 🔍 常见问题

### Steamworks初始化失败
- 检查steam_appid.txt是否正确
- 确保Steam客户端正在运行
- 验证SDK文件是否正确放置

### 成就无法解锁
- 检查成就ID是否与Steamworks配置匹配
- 验证成就图标是否上传
- 检查成就是否已解锁(每个用户只能解锁一次)

### 云存档同步失败
- 检查云存档配额设置
- 验证文件大小是否超限
- 确保文件路径正确

## 📚 参考资料

- [Steamworks SDK文档](https://partner.steamgames.com/doc/sdk)
- [Steam成就API](https://partner.steamgames.com/doc/features/achievements)
- [Steam云存档API](https://partner.steamgames.com/doc/features/cloud)
- [Electron打包指南](https://www.electronjs.org/docs/tutorial/using-electron-builder)

## 🔗 相关链接

- Steamworks合作伙伴网站: https://partner.steamgames.com/
- Steam SDK下载: https://partner.steamgames.com/doc/sdk
- Steam社区论坛: https://steamcommunity.com/groups/steamworks

---

**注意**: 在正式发布前,请确保所有Steamworks功能在测试环境中正常工作。
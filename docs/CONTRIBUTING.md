# 贡献指南

感谢您考虑为五子棋 · Gomoku 项目做出贡献! 🎉

## 📋 贡献方式

有多种方式可以为本项目做出贡献:

### 🐛 报告Bug
如果您发现了bug,请通过以下步骤报告:

1. 在 Issues 中搜索,确认该bug未被报告
2. 创建新的Issue,包含以下信息:
   - 清晰的标题和描述
   - 重现步骤
   - 期望行为和实际行为
   - 截图(如果适用)
   - 您的环境信息(操作系统、浏览器版本等)

### 💡 提出新功能
如果您有新功能建议:

1. 先在 Issues 中讨论您的想法
2. 说明功能的用途和价值
3. 提供实现思路(如果可能)

### 📝 改进文档
文档改进包括:

- 修正拼写错误
- 改进文档结构
- 添加缺失的文档
- 更新过时的信息

### 🎨 提交资源
如果您是设计师,可以贡献:

- 游戏图标设计
- 成就图标设计
- UI主题设计
- 游戏截图制作

### 🔧 代码贡献
直接贡献代码是最直接的方式!

---

## 🛠️ 开发设置

### 克隆项目

```bash
git clone https://github.com/yourusername/gomoku.git
cd gomoku
```

### 运行项目

```bash
npm run serve
```

访问 `http://localhost:4173` 查看游戏。

### 项目结构

```text
.
├─ index.html              # 主入口
├─ src
   ├─ main.js             # 应用入口
   ├─ app
   │  └─ GomokuApp.js     # 应用编排层
   ├─ config
   │  └─ gameConfig.js    # 配置常量
   ├─ game
   │  ├─ ai.js            # AI算法
   │  ├─ rules.js         # 游戏规则
   │  └─ state.js         # 状态管理
   ├─ ui
   │  ├─ dom.js           # DOM操作
   │  └─ render.js        # 渲染逻辑
   ├─ utils
   │  ├─ board.js         # 棋盘工具
   │  └─ formatters.js    # 格式化工具
   └─ styles              # 样式文件
```

### 代码规范

#### JavaScript
- 使用 ES Modules
- 遵循现有的代码风格
- 保持函数简洁和单一职责
- 添加必要的注释
- 使用语义化的变量和函数名

#### 样式
- 遵循现有的CSS命名约定
- 保持样式文件的分层结构
- 使用CSS变量管理颜色和尺寸

---

## 🎯 Pull Request 流程

### 1. Fork 项目
点击右上角的 Fork 按钮。

### 2. 创建分支

```bash
git checkout -b feature/your-feature-name
```

使用清晰的分支命名:
- `feature/xxx` - 新功能
- `fix/xxx` - bug修复
- `doc/xxx` - 文档改进
- `refactor/xxx` - 代码重构

### 3. 进行修改
- 遵循代码规范
- 保持修改最小化和专注
- 添加必要的测试(如果适用)
- 更新相关文档

### 4. 提交更改

```bash
git add .
git commit -m "清晰描述您的更改"
```

提交信息格式:
- 使用清晰、描述性的标题
- 第一行不超过50字符
- 使用中文或英文,保持一致
- 说明"做了什么"和"为什么"

示例:
```
添加AI难度选择功能

- 新增三种AI难度等级(轻松、进阶、大师)
- 更新UI显示当前难度
- 优化AI评估算法以支持不同难度

此功能让玩家可以根据自己的水平选择合适的挑战难度。
```

### 5. 推送到您的Fork

```bash
git push origin feature/your-feature-name
```

### 6. 创建Pull Request
1. 访问原项目仓库
2. 点击 "New Pull Request"
3. 选择您的分支
4. 填写PR描述,包括:
   - 更改内容说明
   - 相关Issue链接(如有)
   - 测试说明
   - 截图(如果适用)

---

## ✅ 代码审查标准

您的PR需要满足以下标准才能被合并:

### 功能性
- ✅ 代码能够正常运行
- ✅ 新功能经过充分测试
- ✅ 没有引入新的bug
- ✅ 不破坏现有功能

### 代码质量
- ✅ 遵循项目代码风格
- ✅ 代码清晰易读
- ✅ 适当的注释
- ✅ 没有冗余代码

### 文档
- ✅ 更新相关文档
- ✅ CHANGELOG更新(如适用)
- ✅ README更新(如适用)

### 性能
- ✅ 没有明显的性能下降
- ✅ 优化算法性能(如适用)

---

## 🎨 设计贡献指南

### 图标设计要求
- PNG格式,透明背景
- 尺寸符合Steam标准
- 视觉风格一致
- 简洁明了

### 成就图标要求
- 64×64 或 128×128 PNG
- 透明背景
- 能清晰表达成就含义

### 截图要求
- 1920×1080 分辨率
- PNG或JPG格式
- 展示游戏核心功能
- 视觉效果良好

---

## 📚 参考资源

### 项目相关
- [README.md](README.md) - 项目介绍
- [CHANGELOG.md](CHANGELOG.md) - 更新日志
- [assets/ASSETS_MANIFEST.md](assets/ASSETS_MANIFEST.md) - 资源清单
- [steam/STEAM_CONFIG.md](steam/STEAM_CONFIG.md) - Steam配置

### 外部资源
- [五子棋规则说明](https://zh.wikipedia.org/wiki/五子棋)
- [Steam开发者文档](https://partner.steamgames.com/doc)
- [ES Modules规范](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Guide/Modules)

---

## 💬 获取帮助

如果您在贡献过程中遇到问题:

1. 查看 Issues 中是否有相关问题
2. 创建新的Issue提问
3. 在Issue中使用清晰的标题和描述

---

## 🙏 行为准则

- 尊重所有贡献者
- 使用包容和友好的语言
- 接受建设性的批评
- 关注对社区最有利的事情
- 对其他社区成员表示同理心

---

## 📄 许可证

通过贡献代码,您同意您的贡献将根据项目的 [MIT License](LICENSE) 进行许可。

---

再次感谢您的贡献! 您的每一份努力都会让这个项目变得更好! 🌟
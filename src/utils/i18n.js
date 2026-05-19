/**
 * 多语言支持模块
 * 支持中英文切换
 */

/**
 * 通过点路径解析嵌套对象
 * @param {Object} obj 对象
 * @param {string} path 点分隔路径
 * @returns {*}
 */
function resolve(obj, path) {
    return path.split('.').reduce((acc, key) => acc?.[key], obj);
}

/**
 * 将嵌套翻译对象展开为叶子键到值的映射
 * 用于向后兼容：当 JSON 使用嵌套命名空间结构时，
 * 仍能通过叶子键名（如 'appTitle'）查到值
 * @param {Object} obj 嵌套对象
 * @returns {Object} 叶子键 → 值的平面映射
 */
function flattenTranslations(obj) {
    const flat = {};
    const walk = (node) => {
        for (const [key, value] of Object.entries(node)) {
            if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
                walk(value);
            } else {
                flat[key] = value;
            }
        }
    };
    walk(obj);
    return flat;
}

const translations = {
    zh: {
        // 设置界面
        appTitle: '多棋类合集 · Board Games',
        setupTitle: '五子棋',
        setupSubtitle: '进入五子棋 3D 棋盘，直接开局。',
        mode: '游戏模式',
        pvp: '人人对战',
        pve: '人机对战',
        practice: '练习模式',
        qi: 'QI 指导',
        rules: '规则',
        classic: '经典',
        renju: '禁手',
        boardSize: '棋盘尺寸',
        scene: '场景',
        sceneHome: '家里',
        scenePark: '公园',
        sceneCompetition: '比赛现场',
        scenePresence: '场景氛围',
        sceneHomeMood: '窗边对局',
        sceneHomeBlurb: '暖灯窗景，适合安静推演。',
        sceneParkMood: '树荫棋桌',
        sceneParkBlurb: '树荫与园路，让视野更开阔。',
        sceneCompetitionMood: '比赛大厅',
        sceneCompetitionBlurb: '顶灯、屏幕与观众席带来正式赛场感。',
        sceneSoundHome: '室内暖光',
        sceneSoundPark: '微风水声',
        sceneSoundCompetition: '馆场底噪',
        aiLevel: 'AI 难度',
        easy: '轻松',
        medium: '进阶',
        hard: '大师',
        yourColor: '执子颜色',
        blackFirst: '黑子（先手）',
        whiteSecond: '白子（后手）',
        startGame: '开始游戏',

        // 游戏界面
        opening: '布局阶段',
        midgame: '中盘阶段',
        endgame: '终盘阶段',
        undo: '悔棋',
        hint: '提示',
        swapSides: '换边',
        restart: '重开',
        resign: '认输',
        resetView: '重置视角',
        currentStone: '当前执子',
        moveCountLabel: '手数',
        hudMeta: '对局参数',
        modeLabel: '模式',
        ruleLabel: '规则',
        boardLabel: '棋盘',
        sceneLabel: '场景',
        spotlightTitle: '局势聚焦',
        momentumPanel: '局势节奏',
        quickTools: '快捷功能',
        immersiveUi: '沉浸 HUD',
        immersiveUiOn: '沉浸开',
        immersiveUiOff: '沉浸关',
        immersiveUiUnavailable: '沉浸 HUD 仅桌面端可用',
        soundOn: '音效开',
        soundOff: '音效关',
        confirmMove: '确认落子',
        cancelSelection: '取消选点',
        selectedPoint: '已选落点',
        coachTitle: 'QI 指导',
        coachRecommended: '推荐点',
        coachReason: '原因',
        coachRisk: '风险',
        coachReview: '复盘',
        coachWaiting: '等待你的回合后生成新建议。',
        coachAlternatives: '候选点',
        coachPlan: '下一步',
        coachConfidence: '置信度',
        coachReanalyze: '重新分析',
        coachUploadImage: '上传棋盘',
        coachImportBoard: '导入棋局',
        coachAnalyzing: '正在识别棋盘...',
        coachAnalyzeSuccess: '识别完成，发现 {count} 枚棋子。',
        coachAnalyzeFailed: '棋盘识别失败。',
        coachImportSuccess: '棋局已导入，共 {count} 手。',
        coachImportConfirm: '导入将替换当前棋局，确定继续？',
        coachPreviewEdit: '预览 & 编辑',
        coachPreviewHint: '点击格子切换棋子颜色（空 → 黑 → 白 → 空）',
        coachPreviewCommit: '确认修改并导入',
        coachPreviewCancel: '退出编辑',
        coachAnalyzeCancel: '取消识别',
        coachAnalyzeCanceled: '已取消识别。',
        coachDropHint: '松开以上传',
        coachConfirmTitle: '导入识别结果',
        coachConfirmCancel: '取消',
        coachConfirmOk: '确定导入',
        coachConfidenceLabel: '置信度 {pct}%',
        coachStoneCount: '{count} 枚棋子',
        coachLlmRequestFailed: 'LLM 请求失败：{reason}',
        devPanelTitle: '开发者面板',
        devPanelSnapshot: '实时快照',
        devPanelLlmLog: 'LLM 请求日志',
        devPanelLlmEmpty: '暂无 LLM 请求记录。',
        devPanelClose: '关闭面板',

        // 多游戏启动器
        launcherTitle: '五种棋类，一座对弈大厅',
        launcherSubtitle: '从连珠、围地到王车与楚河汉界，选择适合当前节奏的一局。',
        launcherWelcome: '棋类大厅',
        launcherAvailableBadge: '已上线',
        launcherComingSoonBadge: '开发中',
        launcherBackToLauncher: '返回大厅',
        launcherEnter: '进入这局',
        comingSoon: '敬请期待',
        launcherCategoryAbstract: '完全信息',
        launcherCategoryStrategy: '策略对弈',
        launcherCategoryImperfectInfo: '暗子博弈',
        launcherTopologyGrid: '方格棋盘',
        launcherTopologyIntersection: '交叉点棋盘',
        launcherTopologyUnique: '特殊棋盘',
        launcherCapability2D: '2D 对局',
        launcherCapability3D: '3D 棋盘',
        launcherCapabilityCoach: 'QI 指导',
        launcherCapabilityImport: '图片导入',
        gameGomokuTitle: '五子棋',
        gameGomokuTagline: '连五即胜，支持禁手、3D 场景、QI 指导与棋盘图片导入。',
        gameGoTitle: '围棋',
        gameGoTagline: '气、提子与数目终局，支持 9/13/19 路、让子和中日计分。',
        gameChessTitle: '国际象棋',
        gameChessTagline: '王车易位、吃过路兵、升变规则完整，适合快速 AI 对战。',
        gameXiangqiTitle: '中国象棋',
        gameXiangqiTagline: '楚河汉界、九宫将帅，车马炮攻防节奏清晰。',
        gameJunqiTitle: '军棋',
        gameJunqiTagline: '二人陆战棋上下布阵、铁路行营与数字裁判；也保留军棋翻翻棋。',

        // 围棋
        goSetupTitle: '开始一局围棋',
        goSetupSubtitle: '选择棋盘尺寸、贴目与模式，准备开子。',
        goBoardSize: '棋盘',
        goMode: '模式',
        goHandicap: '让子',
        goScoringRule: '计分规则',
        goScoringRuleArea: '数子 (中国)',
        goScoringRuleTerritory: '数目 (日本)',
        goScoreBadgeArea: '数子终局',
        goScoreBadgeTerritory: '数目终局',
        goScoreDetailArea: '按中国规则数子。贴目 {komi}。',
        goScoreDetailTerritory: '按日本规则数目。贴目 {komi}。',
        goPass: '虚手',
        go3DToggle: '3D',
        go3DUnavailable: '3D 视图不可用，已切回 2D。',
        goGameStart: '围棋对局开始，黑先白后。',
        goPassedMessage: '{player} 选择虚手。',
        goIllegalOccupied: '这个位置已经有棋子。',
        goIllegalSuicide: '这是自杀手，不可落子。',
        goIllegalKo: '打劫即时禁着点，下一手再考虑。',
        goCapturedBlack: '黑方提子',
        goCapturedWhite: '白方提子',
        goBlackScore: '黑方得分',
        goWhiteScore: '白方得分',
        goScoreBadge: '数子终局',
        goScoreWinnerTitle: '{player} 胜 {margin} 目',
        goScoreDrawTitle: '双方同分，平局',
        goScoreDetail: '按中国规则数子。贴目 {komi}。',
        goResignDetail: '对方认输，本局结束。',

        // 国际象棋
        chessSetupTitle: '开始一局国际象棋',
        chessSetupSubtitle: '选择模式与难度，准备开局。',
        chessMode: '模式',
        chessColorWhite: '执白（先手）',
        chessColorBlack: '执黑（后手）',
        chessYourColor: '执子颜色',
        chessWhite: '白方',
        chessBlack: '黑方',
        chessGameStart: '对局开始，白方先行。',
        chessCheck: '将军',
        chessCheckmate: '将死',
        chessStalemate: '逼和',
        chessDraw: '和棋',
        chessDraw50: '50 步规则和棋',
        chessDrawInsufficient: '子力不足和棋',
        chessDrawDetail: '本局和棋结束。',
        chessCheckmateTitle: '{player} 将死对方',
        chessCheckmateDetail: '胜负已定，本局结束。',
        chessStalemateTitle: '逼和，无合法走法',
        chessStalemateDetail: '虽未被将但已无棋可走，按和棋处理。',
        chessResignDetail: '对方认输，本局结束。',
        chessPromoteTitle: '选择升变',
        chessPromoteQueen: '后',
        chessPromoteRook: '车',
        chessPromoteBishop: '象',
        chessPromoteKnight: '马',
        chessMoveCount: '手数',
        chessLastMove: '最后一手',
        chessCapturedByWhite: '白方吃子',
        chessCapturedByBlack: '黑方吃子',

        // 中国象棋
        xiangqiSetupTitle: '开始一局中国象棋',
        xiangqiSetupSubtitle: '红先黑后，车马炮 将相士，楚河汉界。',
        xiangqiMode: '模式',
        xiangqiYourColor: '执子颜色',
        xiangqiColorRed: '执红（先手）',
        xiangqiColorBlack: '执黑（后手）',
        xiangqiRed: '红方',
        xiangqiBlack: '黑方',
        xiangqiRiverLeft: '楚 河',
        xiangqiRiverRight: '汉 界',
        xiangqiGameStart: '红先落子，鸣锣开棋。',
        xiangqiCheckmateBadge: '绝杀',
        xiangqiCheckmateTitle: '{player} 胜',
        xiangqiCheckmateDetail: '对方将/帅已被将死，本局结束。',
        xiangqiStalemateBadge: '困毙',
        xiangqiStalemateTitle: '{player} 胜',
        xiangqiStalemateDetail: '对方无棋可走，按困毙判负。',
        xiangqiResignDetail: '对方认输，本局结束。',
        xiangqiMoveCount: '手数',
        xiangqiLastMove: '最后一手',

        // 军棋 Junqi
        junqiSetupTitle: '开始一局军棋',
        junqiSetupSubtitle: '默认二人陆战棋：上下布阵、铁路行营、PVE 数字裁判；也可切换军棋翻翻棋。',
        junqiVariant: '变体',
        junqiVariantClassic: '二人陆战棋',
        junqiVariantFlip: '翻翻棋',
        junqiVariantFourKingdom: '四国军棋',
        junqiVariantFourKingdomSoon: '四国（敬请期待）',
        junqiTemplate: '布阵',
        junqiTemplateBalanced: '均衡阵',
        junqiTemplateAttack: '进攻阵',
        junqiTemplateRail: '铁路阵',
        junqiRed: '红方',
        junqiBlack: '黑方',
        junqiFlip: '翻棋',
        junqiFirstFlip: '首翻定色',
        junqiFirstFlipAssigned: '首翻完成：你执 {player}。',
        junqiHintFirstFlip: '这是翻翻棋暗子盘，不是上下布阵。点击任意棋子翻开，翻出的颜色即为你方。',
        junqiHintPlay: '点击己方已翻棋子查看走法。',
        junqiFlipIntro: '军棋翻翻棋开局：暗子随机散置。先翻一枚决定己方色。',
        junqiClassicIntro: '二人陆战棋开局：你执红方，敌方暗子由数字裁判处理。',
        junqiHintClassic: '选择己方棋子查看公路、铁路和工兵转弯走法。',
        junqiFlagCapturedBadge: '军旗被夺',
        junqiFlagCapturedTitle: '{player} 胜',
        junqiFlagCapturedDetail: '军旗被攻占，本局结束。',
        junqiAnnihilationBadge: '全军覆没',
        junqiAnnihilationTitle: '{player} 胜',
        junqiAnnihilationDetail: '对方全部棋子被吃，本局结束。',
        junqiStalemateBadge: '无子可动',
        junqiStalemateTitle: '{player} 胜',
        junqiStalemateDetail: '对方无合法走法，本局结束。',
        junqiResignDetail: '对方认输，本局结束。',
        coachSourceLocal: '本地 AI',
        coachSourceLlm: 'LLM',
        coachStatusLocal: '本地推荐已显示',
        coachStatusLlmLoading: 'LLM 分析中',
        coachStatusLlmReady: 'LLM 已接管讲解',
        coachStatusLlmUnavailable: 'LLM 不可用',
        coachStatusLlmMissing: 'LLM 未配置',
        coachStatusLlmDisabled: 'LLM 未启用',
        coachPlanLocal: '先按推荐点稳住当前要点，再观察对手是否形成直接威胁。',
        llmCoachSetupLabel: 'LLM 教学',
        llmSettingsButton: 'LLM 设置',
        llmSettingsTitle: 'LLM 设置',
        llmEnable: '启用 LLM 教学',
        llmBaseUrl: 'Base URL',
        llmModel: 'Model',
        llmApiKey: 'API Key',
        saveLlmSettings: '保存',
        testLlmConnection: '测试连接',
        clearLlmKey: '清除 Key',
        closeLlmSettings: '关闭 LLM 设置',
        choosePointFirst: '先轻点棋盘选择落点，再确认落子。',

        // 玩家
        black: '黑方',
        white: '白方',
        moves: '手',
        yourTurn: '你的回合',
        aiThinking: 'AI 思考中...',
        aiThinkingNext: 'AI 正在思考下一手。',
        boardAria: '棋盘',

        // 结果
        gameEnd: '对局结束',
        blackWins: '黑方获胜',
        whiteWins: '白方获胜',
        draw: '平局',
        totalMoves: '总手数',
        lastMove: '最后一手',
        playAgain: '再来一局',
        backToSetup: '返回设置',

        // 棋谱
        moveHistory: '棋谱记录',
        noMoves: '暂无棋谱',

        // 消息
        gameStarted: '游戏已开始',
        forbiddenMove: '禁手位置，不能落子',
        forbiddenOverline: '黑方此处属于长连禁手。',
        forbiddenDoubleFour: '黑方此处属于四四禁手。',
        forbiddenDoubleThree: '黑方此处属于三三禁手。',
        cellOccupied: '这个位置已经有棋子了',
        gameOver: '游戏已结束',
        hintSuggestion: '建议落子',
        aiMoved: 'AI 落子',
        introPvp: '人人对战已开始，黑方先行。',
        introPractice: '练习模式已开始，可自由落子与复盘。',
        introPveBlack: '人机对战已开始，你执黑先行。',
        introPveWhite: '人机对战已开始，AI 执黑先行。',
        introQiBlack: 'QI 指导已开始，每回合都会给出推荐点、原因和风险提醒。',
        introQiWhite: 'QI 指导已开始，AI 执黑先行，轮到你时会给出推荐点。',
        gameAlreadyEndedReturn: '对局已经结束，请重新开始或返回设置。',
        aiTurnWait: '现在是 AI 回合，请稍候。',
        selectedMoveConfirm: '已选中 {move}，点击确认落子。',
        selectPointFirstConfirm: '请先在棋盘上选择一个落点。',
        selectionCanceledMessage: '已取消当前选点。',
        coachSuggestedMessage: 'QI 推荐：{move}',
        coachCandidateFocused: '已聚焦候选点 {move}，请在棋盘上确认落子。',
        llmSettingsSaved: 'LLM 设置已保存。',
        llmKeyCleared: 'API Key 已清除。',
        llmTesting: '正在测试连接...',
        llmTestOk: '连接测试成功。',
        llmTestFailed: '连接测试失败。',
        llmConfigIncomplete: '请填写 Base URL、Model 和 API Key。',
        playerWinsMessage: '{player} 获胜。',
        boardFullDrawMessage: '棋盘已满，本局平手。',
        playerTurnMessage: '轮到 {player} 落子。',
        aiThinkingMessage: 'AI 正在思考下一手。',
        aiNoMoveMessage: 'AI 无可落子位置，本局结束。',
        aiPlayedMessage: 'AI 落子：{move}',
        nothingToUndo: '当前没有可悔的棋。',
        undoneMoves: '已悔棋 {count} 手。',
        noHintNeededGameOver: '对局已结束，无需提示。',
        noHintDuringAiTurn: '当前是 AI 回合，暂不提供提示。',
        noHintAvailable: '没有可用提示位置。',
        hintSuggestionMessage: '建议落子：{move}',
        swapOnlyBeforeOpening: '换边仅支持开局前使用。',
        swappedToWhiteAiFirst: '已换边，你现在执白，AI 将先手。',
        swappedToBlack: '已换边，你现在执黑。',
        swappedFirstPlayer: '已切换先手，当前由 {player} 先行。',
        gameRestartedMessage: '棋局已重新开始。',
        gameAlreadyEnded: '对局已经结束。',
        resignWinMessage: '{loser} 认输，{winner} 获胜。',

        // 相机控制
        cameraControls: '左键环绕 | 滚轮缩放',
        cameraPresetDefault: '默认视角',
        cameraPresetTopDown: '俯视视角',
        cameraPresetSide: '侧面视角',
        cameraPresetCorner: '角落视角',
        cameraPresetClose: '近距离视角',
        cameraPresetCustom: '自定义视角',

        // 说明与引导
        helpCenter: '功能说明',
        helpTitle: '把说明集中到这里',
        helpSubtitle: '主界面只保留操作，具体功能统一放在这一页。',
        closeHelp: '关闭说明',
        guideWelcome: '首次打开',
        guideTitle: '开始前看三点',
        guideSubtitle: '详细说明集中在右上角的说明页，这里只保留最必要的引导。',
        guideDismiss: '知道了',
        guideDetails: '查看说明',
        guideBoardTitle: '目标',
        guideBoardBody: '黑先白后，先连成五子。',
        guideDesktopTitle: '桌面操作',
        guideDesktopBody: '左键拖拽环绕，滚轮缩放，悬停可看短提示。',
        guideTouchTitle: '移动端操作',
        guideTouchBody: '轻点选点，再确认落子。',
        guideFeatureTitle: '更多功能',
        guideFeatureBody: 'QI、提示、沉浸 HUD 都在说明页里。',
        helpSectionBasics: '基础',
        helpSectionControls: '操作',
        helpSectionFeatures: '功能',
        helpBasicsBoardTitle: '对局',
        helpBasicsBoardBody: '黑先白后，连五即胜。',
        helpBasicsModesTitle: '模式',
        helpBasicsModesBody: 'PvP、AI、练习、QI 四种模式。',
        helpBasicsSceneTitle: '场景',
        helpBasicsSceneBody: '场景只改呈现，不改规则。',
        helpControlDesktopOrbitTitle: '桌面视角',
        helpControlDesktopOrbitBody: '左键拖拽可沿棋盘四周 360 度环绕，滚轮缩放，镜头不会翻到顶部。',
        helpControlDesktopHudTitle: '桌面 HUD',
        helpControlDesktopHudBody: '开启沉浸 HUD 后，鼠标靠边再显示对应区域。',
        helpControlDesktopTipTitle: '桌面提示',
        helpControlDesktopTipBody: '悬停按钮可以看简短提示。',
        helpControlTouchPlaceTitle: '移动端落子',
        helpControlTouchPlaceBody: '先轻点选点，再确认落子。',
        helpControlTouchHudTitle: '移动端 HUD',
        helpControlTouchHudBody: '左右侧信息卡可以横向滑动查看。',
        helpControlTouchViewTitle: '移动端视角',
        helpControlTouchViewBody: '画面以稳定构图为主，不需要频繁调镜头。',
        helpFeatureHintTitle: '提示',
        helpFeatureHintBody: '给出一个可落点。',
        helpFeatureQiTitle: 'QI',
        helpFeatureQiBody: '显示推荐点、原因和风险。',
        helpFeatureAudioTitle: '音效',
        helpFeatureAudioBody: '可随时开关。',
        helpFeatureImmersiveTitle: '沉浸 HUD',
        helpFeatureImmersiveBody: '仅桌面端可用，靠近边缘时显示。',
        tooltipHelp: '查看功能说明',
        tooltipCloseHelp: '关闭说明页',
        tooltipBackSetup: '返回设置',
        tooltipStartGame: '开始当前配置',
        tooltipResetView: '回到默认镜头',
        tooltipSoundToggle: '切换音效',
        tooltipImmersiveToggle: '切换沉浸 HUD',
        tooltipUndo: '撤回上一步',
        tooltipHint: '显示推荐落点',
        tooltipSwap: '开局前切换先后',
        tooltipRestart: '重新开始这一局',
        tooltipResign: '结束当前对局',
        tooltipLlmSettings: '配置 LLM 教学',
        tooltipCloseLlmSettings: '关闭 LLM 设置',
        tooltipCoachReanalyze: '重新请求本回合分析',

        // 指导原因
        coachReasonWin: '这里可以直接形成致胜连线，优先终结对局。',
        coachReasonBlock: '这里必须先挡住对手的直接成五点，先活下来。',
        coachReasonAttack: '这里能把威胁升级到强攻形，逼迫对手应手。',
        coachReasonShape: '这里能延伸己方连线骨架，后续更容易形成活三或活四。',
        coachReasonCenter: '这里先稳住中心和节奏，后续选择面会更大。',
        coachReasonPressure: '这里能兼顾扩张与压制，让对手的落点变窄。',

        // 指导风险
        coachRiskThreat: '如果忽略这里，对手很可能立刻抢到高威胁点。',
        coachRiskInitiative: '如果拖延这里，先手会松掉，局势会变被动。',
        coachRiskCounter: '如果走偏，这一带会留下明显反击窗口。',
        coachRiskForbidden: '禁手规则下要继续避免过线、三三和四四陷阱。',

        // 指导复盘
        coachReviewFollowed: '这一手和建议一致，节奏保持得很干净。',
        coachReviewFlexible: '你没有完全照做，但这一手仍然保持了不错的质量。',
        coachReviewDeviation: '这手可以继续下，但效率比建议点略低。',
        coachReviewPunishable: '这手给了对方更多反击空间，下一回合要更谨慎。',

        // 局势阶段
        phaseGameOverLabel: '终局已定',
        phaseGameOverPill: '胜负揭晓',
        phaseGameOverTitle: '关键一手已经落定',
        phaseGameOverSubtitle: '复盘这一盘的转折。',
        phaseGameOverBlackSpotlight: '黑方正在塑造攻势',
        phaseGameOverWhiteSpotlight: '白方正在寻找反击点',
        phaseGameOverFinishedSpotlight: '胜负已定，复盘这一盘的关键转折。',
        phaseGameOverMomentumTitle: '终局复盘',
        phaseGameOverMomentumNote: '回看最后几手。',
        phaseOpeningLabel: '布局阶段',
        phaseOpeningPill: '开局布局',
        phaseOpeningTitle: '抢占天元与关键星位',
        phaseOpeningSubtitle: '先立形，再争先手。',
        phaseOpeningBlackSpotlight: '黑方正在塑造攻势',
        phaseOpeningWhiteSpotlight: '白方正在寻找反击点',
        phaseOpeningFinishedSpotlight: '胜负已定，复盘这一盘的关键转折。',
        phaseOpeningMomentumTitle: '棋势未定',
        phaseOpeningMomentumNote: '先看空间与节奏。',
        phaseMidgameLabel: '中盘拉扯',
        phaseMidgamePill: '局势升温',
        phaseMidgameTitle: '攻守开始交错，判断先后手',
        phaseMidgameSubtitle: '连威胁，拆对方。',
        phaseMidgameBlackSpotlight: '黑方正在塑造攻势',
        phaseMidgameWhiteSpotlight: '白方正在寻找反击点',
        phaseMidgameFinishedSpotlight: '胜负已定，复盘这一盘的关键转折。',
        phaseMidgameMomentumTitle: '压力上升',
        phaseMidgameMomentumNote: '留意活三、活四与先手。',
        phaseEndgameLabel: '终盘决胜',
        phaseEndgamePill: '决胜阶段',
        phaseEndgameTitle: '一步失先，可能直接定胜负',
        phaseEndgameSubtitle: '先解最高威胁。',
        phaseEndgameBlackSpotlight: '黑方正在塑造攻势',
        phaseEndgameWhiteSpotlight: '白方正在寻找反击点',
        phaseEndgameFinishedSpotlight: '胜负已定，复盘这一盘的关键转折。',
        phaseEndgameMomentumTitle: '胜负临近',
        phaseEndgameMomentumNote: '优先算直接胜与强制手。',

        // 结果摘要
        resultDrawBadge: '平局',
        resultDrawTitle: '棋盘已满，双方打成均势',
        resultDrawDetail: '这一局没有出现致命破绽，适合回看中盘节奏与关键防点。',
        resultResignBadge: '认输结束',
        resultResignTitle: '{player} 接管胜势',
        resultResignDetail: '局面已经倾斜，认输为这盘对局画上句点。可以直接再开一局继续。',
        resultWinBadge: '连五制胜',
        resultWinTitle: '{player} 完成致胜连线',
        resultWinDetail: '关键连线已经形成，攻守转换在这一手彻底落定。'
    },
    en: {
        // Setup
        appTitle: 'Board Games Collection',
        setupTitle: 'Gomoku',
        setupSubtitle: 'Enter the Gomoku 3D board and start at once.',
        mode: 'Game Mode',
        pvp: 'PvP',
        pve: 'vs AI',
        practice: 'Practice',
        qi: 'QI Coach',
        rules: 'Rules',
        classic: 'Classic',
        renju: 'Renju',
        boardSize: 'Board Size',
        scene: 'Scene',
        sceneHome: 'Home',
        scenePark: 'Park',
        sceneCompetition: 'Tournament',
        scenePresence: 'Venue Mood',
        sceneHomeMood: 'Window-side match',
        sceneHomeBlurb: 'Warm light and a window-side table for quiet play.',
        sceneParkMood: 'Shade table',
        sceneParkBlurb: 'A brighter outdoor board with paths and tree shade.',
        sceneCompetitionMood: 'Match hall',
        sceneCompetitionBlurb: 'Hall lights, screens, and seating frame a formal venue.',
        sceneSoundHome: 'Warm interior',
        sceneSoundPark: 'Breeze and water',
        sceneSoundCompetition: 'Hall ambience',
        aiLevel: 'AI Level',
        easy: 'Easy',
        medium: 'Medium',
        hard: 'Master',
        yourColor: 'Your Color',
        blackFirst: 'Black (First)',
        whiteSecond: 'White (Second)',
        startGame: 'Start Game',

        // Game
        opening: 'Opening',
        midgame: 'Midgame',
        endgame: 'Endgame',
        undo: 'Undo',
        hint: 'Hint',
        swapSides: 'Swap Sides',
        restart: 'Restart',
        resign: 'Resign',
        resetView: 'Reset View',
        currentStone: 'Turn',
        moveCountLabel: 'Moves',
        hudMeta: 'Match Info',
        modeLabel: 'Mode',
        ruleLabel: 'Rules',
        boardLabel: 'Board',
        sceneLabel: 'Scene',
        spotlightTitle: 'Focus',
        momentumPanel: 'Tempo',
        quickTools: 'Quick Tools',
        immersiveUi: 'Immersive HUD',
        immersiveUiOn: 'Immersive On',
        immersiveUiOff: 'Immersive Off',
        immersiveUiUnavailable: 'Immersive HUD is desktop-only',
        soundOn: 'Sound On',
        soundOff: 'Sound Off',
        confirmMove: 'Confirm Move',
        cancelSelection: 'Cancel',
        selectedPoint: 'Selected',
        coachTitle: 'QI Coach',
        coachRecommended: 'Recommended',
        coachReason: 'Reason',
        coachRisk: 'Risk',
        coachReview: 'Review',
        coachWaiting: 'A fresh suggestion will appear when it is your turn again.',
        coachAlternatives: 'Candidates',
        coachPlan: 'Plan',
        coachConfidence: 'Confidence',
        coachReanalyze: 'Reanalyze',
        coachUploadImage: 'Upload Board',
        coachImportBoard: 'Import Position',
        coachAnalyzing: 'Recognizing board...',
        coachAnalyzeSuccess: 'Done — {count} stones detected.',
        coachAnalyzeFailed: 'Board recognition failed.',
        coachImportSuccess: 'Position imported — {count} moves.',
        coachImportConfirm: 'This will replace the current game. Continue?',
        coachPreviewEdit: 'Preview & Edit',
        coachPreviewHint: 'Tap cells to cycle (empty → black → white → empty)',
        coachPreviewCommit: 'Confirm and Import',
        coachPreviewCancel: 'Exit Edit',
        coachAnalyzeCancel: 'Cancel',
        coachAnalyzeCanceled: 'Recognition canceled.',
        coachDropHint: 'Drop to upload',
        coachConfirmTitle: 'Import Recognition',
        coachConfirmCancel: 'Cancel',
        coachConfirmOk: 'Import',
        coachConfidenceLabel: 'Confidence {pct}%',
        coachStoneCount: '{count} stones',
        coachLlmRequestFailed: 'LLM request failed: {reason}',
        devPanelTitle: 'Dev Tools',
        devPanelSnapshot: 'Live Snapshot',
        devPanelLlmLog: 'LLM Request Log',
        devPanelLlmEmpty: 'No LLM requests yet.',
        devPanelClose: 'Close panel',

        // Multi-game launcher
        launcherTitle: 'Five board games, one match hall',
        launcherSubtitle: 'Move from five-in-a-row and territory fights to kings, rivers, and hidden ranks.',
        launcherWelcome: 'Board Game Hall',
        launcherAvailableBadge: 'Live',
        launcherComingSoonBadge: 'In progress',
        launcherBackToLauncher: 'Back to hall',
        launcherEnter: 'Play this game',
        comingSoon: 'Coming soon',
        launcherCategoryAbstract: 'Perfect information',
        launcherCategoryStrategy: 'Strategy duel',
        launcherCategoryImperfectInfo: 'Hidden information',
        launcherTopologyGrid: 'Grid board',
        launcherTopologyIntersection: 'Intersection board',
        launcherTopologyUnique: 'Special board',
        launcherCapability2D: '2D match',
        launcherCapability3D: '3D board',
        launcherCapabilityCoach: 'QI coach',
        launcherCapabilityImport: 'Image import',
        gameGomokuTitle: 'Gomoku',
        gameGomokuTagline: 'Connect five with Renju rules, 3D venues, QI coaching, and board-image import.',
        gameGoTitle: 'Go',
        gameGoTagline: 'Liberties, captures, and final scoring on 9/13/19 boards with handicap support.',
        gameChessTitle: 'Chess',
        gameChessTagline: 'Castling, en passant, and promotion are all covered for quick AI matches.',
        gameXiangqiTitle: 'Xiangqi',
        gameXiangqiTagline: 'River, palace, cannons, horses, and generals in a fast tactical duel.',
        gameJunqiTitle: 'Junqi',
        gameJunqiTagline: 'Classic two-player Luzhanqi with railways, camps, referee-hidden combat, plus Flip Chess.',

        // Go
        goSetupTitle: 'Start a Go match',
        goSetupSubtitle: 'Choose board size, komi and mode before the first stone.',
        goBoardSize: 'Board',
        goMode: 'Mode',
        goHandicap: 'Handicap',
        goScoringRule: 'Scoring',
        goScoringRuleArea: 'Area (Chinese)',
        goScoringRuleTerritory: 'Territory (Japanese)',
        goScoreBadgeArea: 'Area scoring',
        goScoreBadgeTerritory: 'Territory scoring',
        goScoreDetailArea: 'Chinese (area) scoring. Komi {komi}.',
        goScoreDetailTerritory: 'Japanese (territory) scoring. Komi {komi}.',
        goPass: 'Pass',
        go3DToggle: '3D',
        go3DUnavailable: '3D view unavailable; reverted to 2D.',
        goGameStart: 'The Go game begins. Black moves first.',
        goPassedMessage: '{player} passes.',
        goIllegalOccupied: 'This point is occupied.',
        goIllegalSuicide: 'That would be suicide.',
        goIllegalKo: 'Ko — try somewhere else first.',
        goCapturedBlack: 'Black captures',
        goCapturedWhite: 'White captures',
        goBlackScore: 'Black',
        goWhiteScore: 'White',
        goScoreBadge: 'Area scoring',
        goScoreWinnerTitle: '{player} wins by {margin}',
        goScoreDrawTitle: 'The game ends in a draw',
        goScoreDetail: 'Chinese (area) scoring. Komi {komi}.',
        goResignDetail: 'The opponent resigned. The game ends.',

        // Chess
        chessSetupTitle: 'Start a Chess match',
        chessSetupSubtitle: 'Pick mode and difficulty to begin.',
        chessMode: 'Mode',
        chessColorWhite: 'White (first)',
        chessColorBlack: 'Black (second)',
        chessYourColor: 'Your side',
        chessWhite: 'White',
        chessBlack: 'Black',
        chessGameStart: 'Match begins. White moves first.',
        chessCheck: 'Check',
        chessCheckmate: 'Checkmate',
        chessStalemate: 'Stalemate',
        chessDraw: 'Draw',
        chessDraw50: 'Fifty-move rule draw',
        chessDrawInsufficient: 'Insufficient material draw',
        chessDrawDetail: 'The game is a draw.',
        chessCheckmateTitle: '{player} delivers checkmate',
        chessCheckmateDetail: 'The game is decided.',
        chessStalemateTitle: 'Stalemate — no legal moves',
        chessStalemateDetail: 'The side to move has no legal move though not in check.',
        chessResignDetail: 'The opponent resigned. The game ends.',
        chessPromoteTitle: 'Choose promotion',
        chessPromoteQueen: 'Queen',
        chessPromoteRook: 'Rook',
        chessPromoteBishop: 'Bishop',
        chessPromoteKnight: 'Knight',
        chessMoveCount: 'Moves',
        chessLastMove: 'Last move',
        chessCapturedByWhite: 'White captures',
        chessCapturedByBlack: 'Black captures',

        // Xiangqi
        xiangqiSetupTitle: 'Start a Xiangqi match',
        xiangqiSetupSubtitle: 'Red moves first. Chariots, horses, cannons — across the river.',
        xiangqiMode: 'Mode',
        xiangqiYourColor: 'Your side',
        xiangqiColorRed: 'Red (first)',
        xiangqiColorBlack: 'Black (second)',
        xiangqiRed: 'Red',
        xiangqiBlack: 'Black',
        xiangqiRiverLeft: 'Chu River',
        xiangqiRiverRight: 'Han Border',
        xiangqiGameStart: 'Red moves first. Let the match begin.',
        xiangqiCheckmateBadge: 'Checkmate',
        xiangqiCheckmateTitle: '{player} wins',
        xiangqiCheckmateDetail: 'The opposing general is checkmated.',
        xiangqiStalemateBadge: 'Stalemate',
        xiangqiStalemateTitle: '{player} wins',
        xiangqiStalemateDetail: 'Opponent has no legal move — counted as a loss in Xiangqi.',
        xiangqiResignDetail: 'The opponent resigned. The game ends.',
        xiangqiMoveCount: 'Moves',
        xiangqiLastMove: 'Last move',

        // Junqi
        junqiSetupTitle: 'Start Junqi',
        junqiSetupSubtitle: 'Default mode is classic two-player Luzhanqi with top/bottom deployment, railways, camps, and digital referee combat. Flip Chess remains available.',
        junqiVariant: 'Variant',
        junqiVariantClassic: 'Luzhanqi',
        junqiVariantFlip: 'Flip Chess',
        junqiVariantFourKingdom: 'Four-Kingdom',
        junqiVariantFourKingdomSoon: 'Four-Kingdom (soon)',
        junqiTemplate: 'Formation',
        junqiTemplateBalanced: 'Balanced',
        junqiTemplateAttack: 'Attack',
        junqiTemplateRail: 'Railway',
        junqiRed: 'Red',
        junqiBlack: 'Black',
        junqiFlip: 'Flip',
        junqiFirstFlip: 'First flip decides color',
        junqiFirstFlipAssigned: 'First flip done: you play {player}.',
        junqiHintFirstFlip: 'This is the hidden-piece flip board, not a camp-layout board. Tap any piece to flip; the revealed color becomes yours.',
        junqiHintPlay: 'Tap one of your revealed pieces to see its moves.',
        junqiFlipIntro: 'Junqi Flip Chess starts with shuffled hidden pieces. Flip one to set your color.',
        junqiClassicIntro: 'Classic Luzhanqi begins. You play red; enemy pieces stay hidden behind the digital referee.',
        junqiHintClassic: 'Select one of your pieces to inspect road, railway, and engineer-turn moves.',
        junqiFlagCapturedBadge: 'Flag captured',
        junqiFlagCapturedTitle: '{player} wins',
        junqiFlagCapturedDetail: 'The flag was captured. The game ends.',
        junqiAnnihilationBadge: 'Annihilation',
        junqiAnnihilationTitle: '{player} wins',
        junqiAnnihilationDetail: 'All opposing pieces have been captured.',
        junqiStalemateBadge: 'No move',
        junqiStalemateTitle: '{player} wins',
        junqiStalemateDetail: 'The opponent has no legal move.',
        junqiResignDetail: 'The opponent resigned. The game ends.',
        coachSourceLocal: 'Local AI',
        coachSourceLlm: 'LLM',
        coachStatusLocal: 'Local suggestion shown',
        coachStatusLlmLoading: 'LLM analyzing',
        coachStatusLlmReady: 'LLM explanation active',
        coachStatusLlmUnavailable: 'LLM unavailable',
        coachStatusLlmMissing: 'LLM not configured',
        coachStatusLlmDisabled: 'LLM disabled',
        coachPlanLocal: 'Play the recommendation to stabilize the key point, then watch for the opponent’s immediate threats.',
        llmCoachSetupLabel: 'LLM Teaching',
        llmSettingsButton: 'LLM Settings',
        llmSettingsTitle: 'LLM Settings',
        llmEnable: 'Enable LLM teaching',
        llmBaseUrl: 'Base URL',
        llmModel: 'Model',
        llmApiKey: 'API Key',
        saveLlmSettings: 'Save',
        testLlmConnection: 'Test Connection',
        clearLlmKey: 'Clear Key',
        closeLlmSettings: 'Close LLM settings',
        choosePointFirst: 'Tap a point first, then confirm the move.',

        // Players
        black: 'Black',
        white: 'White',
        moves: 'moves',
        yourTurn: 'Your turn',
        aiThinking: 'AI thinking...',
        aiThinkingNext: 'AI is thinking about the next move.',
        boardAria: 'Board',

        // Results
        gameEnd: 'Game Over',
        blackWins: 'Black Wins',
        whiteWins: 'White Wins',
        draw: 'Draw',
        totalMoves: 'Total Moves',
        lastMove: 'Last Move',
        playAgain: 'Play Again',
        backToSetup: 'Back to Setup',

        // History
        moveHistory: 'Move History',
        noMoves: 'No moves yet',

        // Messages
        gameStarted: 'Game started',
        forbiddenMove: 'Forbidden move',
        forbiddenOverline: 'This black move is forbidden because it creates an overline.',
        forbiddenDoubleFour: 'This black move is forbidden because it creates a double-four.',
        forbiddenDoubleThree: 'This black move is forbidden because it creates a double-three.',
        cellOccupied: 'Cell already occupied',
        gameOver: 'Game over',
        hintSuggestion: 'Suggested move',
        aiMoved: 'AI played',
        introPvp: 'The local match has started. Black moves first.',
        introPractice: 'Practice mode has started. You can place stones freely and review lines at will.',
        introPveBlack: 'The AI match has started. You play black and move first.',
        introPveWhite: 'The AI match has started. AI plays black and moves first.',
        introQiBlack: 'QI Coach has started. Each turn now comes with a recommended point, a reason, and a risk note.',
        introQiWhite: 'QI Coach has started. AI plays black first and your guidance appears when your turn begins.',
        gameAlreadyEndedReturn: 'The game is over. Restart or return to setup.',
        aiTurnWait: 'It is the AI turn right now. Please wait.',
        selectedMoveConfirm: 'Selected {move}. Confirm to place the stone.',
        selectPointFirstConfirm: 'Select a point on the board first.',
        selectionCanceledMessage: 'Selection cleared.',
        coachSuggestedMessage: 'QI suggests {move}',
        coachCandidateFocused: 'Focused candidate {move}. Confirm the move on the board.',
        llmSettingsSaved: 'LLM settings saved.',
        llmKeyCleared: 'API key cleared.',
        llmTesting: 'Testing connection...',
        llmTestOk: 'Connection test succeeded.',
        llmTestFailed: 'Connection test failed.',
        llmConfigIncomplete: 'Fill Base URL, Model, and API Key first.',
        playerWinsMessage: '{player} wins.',
        boardFullDrawMessage: 'The board is full. This round is a draw.',
        playerTurnMessage: '{player} to move.',
        aiThinkingMessage: 'AI is thinking about the next move.',
        aiNoMoveMessage: 'AI has no legal move. The game ends here.',
        aiPlayedMessage: 'AI played {move}',
        nothingToUndo: 'There are no moves to undo.',
        undoneMoves: 'Undid {count} move(s).',
        noHintNeededGameOver: 'The game is already over. No hint is needed.',
        noHintDuringAiTurn: 'Hints are unavailable during the AI turn.',
        noHintAvailable: 'No hint is available right now.',
        hintSuggestionMessage: 'Suggested move: {move}',
        swapOnlyBeforeOpening: 'Swap sides is only available before the opening move.',
        swappedToWhiteAiFirst: 'Sides swapped. You are now White and the AI moves first.',
        swappedToBlack: 'Sides swapped. You are now Black.',
        swappedFirstPlayer: 'First move switched. {player} moves first now.',
        gameRestartedMessage: 'The game has been restarted.',
        gameAlreadyEnded: 'The game is already over.',
        resignWinMessage: '{loser} resigns. {winner} wins.',

        // Camera
        cameraControls: 'Left-drag to orbit | Scroll to zoom',
        cameraPresetDefault: 'Default View',
        cameraPresetTopDown: 'Top-Down View',
        cameraPresetSide: 'Side View',
        cameraPresetCorner: 'Corner View',
        cameraPresetClose: 'Close View',
        cameraPresetCustom: 'Custom View',

        // Help and first-run guide
        helpCenter: 'Help',
        helpTitle: 'Put the guidance here',
        helpSubtitle: 'The main interface stays lean. Feature notes live on this page instead.',
        closeHelp: 'Close help',
        guideWelcome: 'First Launch',
        guideTitle: 'Read these three points first',
        guideSubtitle: 'The full explanation lives in the help page at the top right. This card keeps only the essentials.',
        guideDismiss: 'Got it',
        guideDetails: 'Open Help',
        guideBoardTitle: 'Goal',
        guideBoardBody: 'Black moves first. Connect five to win.',
        guideDesktopTitle: 'Desktop',
        guideDesktopBody: 'Left-drag to orbit, scroll to zoom, and hover for short tips.',
        guideTouchTitle: 'Mobile',
        guideTouchBody: 'Tap to select a point, then confirm the move.',
        guideFeatureTitle: 'More',
        guideFeatureBody: 'QI, hints, and immersive HUD are all explained in Help.',
        helpSectionBasics: 'Basics',
        helpSectionControls: 'Controls',
        helpSectionFeatures: 'Features',
        helpBasicsBoardTitle: 'Match',
        helpBasicsBoardBody: 'Black starts. Five in a row wins.',
        helpBasicsModesTitle: 'Modes',
        helpBasicsModesBody: 'PvP, AI, Practice, and QI Coach.',
        helpBasicsSceneTitle: 'Scenes',
        helpBasicsSceneBody: 'Scenes change presentation, not rules.',
        helpControlDesktopOrbitTitle: 'Desktop View',
        helpControlDesktopOrbitBody: 'Left-drag to orbit 360 degrees around the board, scroll to zoom, and the camera stays below the top-down band.',
        helpControlDesktopHudTitle: 'Desktop HUD',
        helpControlDesktopHudBody: 'With immersive HUD on, each region appears only near its screen edge.',
        helpControlDesktopTipTitle: 'Desktop Tips',
        helpControlDesktopTipBody: 'Hover important buttons for short hints.',
        helpControlTouchPlaceTitle: 'Mobile Move Flow',
        helpControlTouchPlaceBody: 'Tap a point first, then confirm the move.',
        helpControlTouchHudTitle: 'Mobile HUD',
        helpControlTouchHudBody: 'The side info cards can be swiped horizontally.',
        helpControlTouchViewTitle: 'Mobile View',
        helpControlTouchViewBody: 'The board keeps a stable view so camera tweaks are rarely needed.',
        helpFeatureHintTitle: 'Hint',
        helpFeatureHintBody: 'Shows one playable recommendation.',
        helpFeatureQiTitle: 'QI Coach',
        helpFeatureQiBody: 'Shows a move, a reason, and a risk note.',
        helpFeatureAudioTitle: 'Sound',
        helpFeatureAudioBody: 'Can be toggled at any time.',
        helpFeatureImmersiveTitle: 'Immersive HUD',
        helpFeatureImmersiveBody: 'Desktop-only. Reveal it by moving near an edge.',
        tooltipHelp: 'Open Help',
        tooltipCloseHelp: 'Close Help',
        tooltipBackSetup: 'Back to setup',
        tooltipStartGame: 'Start with this setup',
        tooltipResetView: 'Return to the default camera',
        tooltipSoundToggle: 'Toggle sound',
        tooltipImmersiveToggle: 'Toggle the immersive HUD',
        tooltipUndo: 'Undo the last move',
        tooltipHint: 'Show a recommended move',
        tooltipSwap: 'Swap sides before the opening',
        tooltipRestart: 'Restart this game',
        tooltipResign: 'End the current game',
        tooltipLlmSettings: 'Configure LLM teaching',
        tooltipCloseLlmSettings: 'Close LLM settings',
        tooltipCoachReanalyze: 'Request a fresh analysis for this turn',

        // Guidance reasons
        coachReasonWin: 'This move finishes the line immediately and should end the game on the spot.',
        coachReasonBlock: 'This point must block the opponent’s direct win before anything else.',
        coachReasonAttack: 'This move upgrades the pressure into a forcing attack and makes the reply narrow.',
        coachReasonShape: 'This point extends your shape cleanly and improves future open-three or open-four chances.',
        coachReasonCenter: 'This keeps the center and the tempo under control while the board is still forming.',
        coachReasonPressure: 'This move expands your influence while reducing the opponent’s comfortable replies.',

        // Guidance risks
        coachRiskThreat: 'Ignoring this area likely hands the opponent an immediate high-threat point.',
        coachRiskInitiative: 'Delaying here can give away the initiative and turn the position passive.',
        coachRiskCounter: 'A weaker move here leaves a clearer counterattack window for the opponent.',
        coachRiskForbidden: 'Under renju rules, keep avoiding overlines and double-three or double-four traps.',

        // Guidance review
        coachReviewFollowed: 'You matched the recommendation and kept the tempo clean.',
        coachReviewFlexible: 'You chose a different move, but the quality is still solid.',
        coachReviewDeviation: 'The move is playable, but it is less efficient than the recommended point.',
        coachReviewPunishable: 'This move gives the opponent more counterplay. The next reply needs extra care.',

        // Phase labels
        phaseGameOverLabel: 'Game Finished',
        phaseGameOverPill: 'Outcome Locked',
        phaseGameOverTitle: 'The decisive move has landed',
        phaseGameOverSubtitle: 'Review the turning point.',
        phaseGameOverBlackSpotlight: 'Black is shaping the initiative',
        phaseGameOverWhiteSpotlight: 'White is looking for counterplay',
        phaseGameOverFinishedSpotlight: 'The winner is set. Review the turning point.',
        phaseGameOverMomentumTitle: 'Final review',
        phaseGameOverMomentumNote: 'Look back at the last few moves.',
        phaseOpeningLabel: 'Opening',
        phaseOpeningPill: 'Opening Shape',
        phaseOpeningTitle: 'Claim the center and key star points',
        phaseOpeningSubtitle: 'Build shape first, then fight for tempo.',
        phaseOpeningBlackSpotlight: 'Black is shaping the initiative',
        phaseOpeningWhiteSpotlight: 'White is looking for counterplay',
        phaseOpeningFinishedSpotlight: 'The winner is set. Review the turning point.',
        phaseOpeningMomentumTitle: 'Shape first',
        phaseOpeningMomentumNote: 'Watch space and tempo.',
        phaseMidgameLabel: 'Midgame',
        phaseMidgamePill: 'Battle Rising',
        phaseMidgameTitle: 'Attack and defense start to overlap',
        phaseMidgameSubtitle: 'Link threats and break shape.',
        phaseMidgameBlackSpotlight: 'Black is shaping the initiative',
        phaseMidgameWhiteSpotlight: 'White is looking for counterplay',
        phaseMidgameFinishedSpotlight: 'The winner is set. Review the turning point.',
        phaseMidgameMomentumTitle: 'Pressure is building',
        phaseMidgameMomentumNote: 'Track open threes, open fours, and forcing moves.',
        phaseEndgameLabel: 'Endgame',
        phaseEndgamePill: 'Winning Threats',
        phaseEndgameTitle: 'One tempo loss can decide everything',
        phaseEndgameSubtitle: 'Answer the biggest threat first.',
        phaseEndgameBlackSpotlight: 'Black is shaping the initiative',
        phaseEndgameWhiteSpotlight: 'White is looking for counterplay',
        phaseEndgameFinishedSpotlight: 'The winner is set. Review the turning point.',
        phaseEndgameMomentumTitle: 'The winning move is near',
        phaseEndgameMomentumNote: 'Prioritize direct wins and forced lines.',

        // Result summaries
        resultDrawBadge: 'Draw',
        resultDrawTitle: 'The board is full and the game is balanced',
        resultDrawDetail: 'No fatal break appeared in this round. It is a good game to review the midgame rhythm and key defensive points.',
        resultResignBadge: 'Resignation',
        resultResignTitle: '{player} takes over the game',
        resultResignDetail: 'The position has already tilted. Resignation closes this round cleanly and you can launch the next one immediately.',
        resultWinBadge: 'Five in a Row',
        resultWinTitle: '{player} completes the winning line',
        resultWinDetail: 'The decisive connection is formed and the initiative fully converts on this move.'
    }
};

class I18n {
    constructor() {
        this.currentLang = this.detectLanguage();
        this.translations = translations;
        this.remoteTranslations = {};
        this.flatRemoteTranslations = {};
        this.listeners = [];
    }

    detectLanguage() {
        // 从 localStorage 获取
        const saved = localStorage.getItem('gomoku-lang');
        if (saved && translations[saved]) {
            return saved;
        }

        // 从浏览器语言检测
        const browserLang = navigator.language.toLowerCase();
        if (browserLang.startsWith('zh')) {
            return 'zh';
        }
        return 'en';
    }

    /**
     * 从远程加载翻译文件
     * @param {string} lang 语言代码
     * @returns {Promise<boolean>}
     */
    async loadTranslations(lang) {
        try {
            const response = await fetch(`src/locales/${lang}.json`);
            if (response.ok) {
                const data = await response.json();
                this.remoteTranslations[lang] = data;
                this.flatRemoteTranslations[lang] = flattenTranslations(data);
                return true;
            }
        } catch { /* ignore */ }
        return false;
    }

    /**
     * 获取翻译文本
     * @param {string} key 翻译键，支持点路径（如 'section.key'）
     * @param {Object} params 插值参数；若包含 count 且值为复数对象则自动选择单复数形式
     * @returns {string}
     */
    t(key, params = {}) {
        let val;

        // 1. 尝试当前语言的远程翻译（点路径或叶子键）
        val = resolve(this.remoteTranslations[this.currentLang], key);
        if (val === undefined) {
            val = this.flatRemoteTranslations[this.currentLang]?.[key];
        }
        if (val !== undefined) {
            return this.interpolate(this._formatPlural(val, params, this.currentLang), params);
        }

        // 2. 尝试当前语言的内置翻译
        val = resolve(this.translations[this.currentLang], key);
        if (val !== undefined) {
            return this.interpolate(this._formatPlural(val, params, this.currentLang), params);
        }

        // 3. 当前语言非英语时尝试英语远程翻译
        if (this.currentLang !== 'en') {
            val = resolve(this.remoteTranslations.en, key);
            if (val === undefined) {
                val = this.flatRemoteTranslations.en?.[key];
            }
            if (val !== undefined) {
                return this.interpolate(this._formatPlural(val, params, 'en'), params);
            }

            // 4. 尝试英语内置翻译
            val = resolve(this.translations.en, key);
            if (val !== undefined) {
                return this.interpolate(this._formatPlural(val, params, 'en'), params);
            }
        }

        // 5. 返回键名作为兜底
        return key;
    }

    /**
     * 处理复数形式
     * @param {*} val 翻译值
     * @param {Object} params 参数
     * @param {string} lang 语言代码
     * @returns {*}
     */
    _formatPlural(val, params, lang) {
        if (typeof val === 'object' && val !== null && val.one && val.other) {
            const count = params.count;
            if (count !== undefined) {
                const rules = new Intl.PluralRules(lang);
                return val[rules.select(count)] || val.other;
            }
            return val.other;
        }
        return val;
    }

    /**
     * 插值替换
     */
    interpolate(text, params) {
        return text.replace(/\{(\w+)\}/g, (_, key) => {
            return params[key] !== undefined ? params[key] : `{${key}}`;
        });
    }

    /**
     * 切换语言
     * @param {string} lang 'zh' | 'en' 或已通过 loadTranslations() 加载的语言
     */
    setLanguage(lang) {
        if (this.translations[lang] || this.remoteTranslations[lang]) {
            this.currentLang = lang;
            localStorage.setItem('gomoku-lang', lang);
            this.notifyListeners();
            this.updateDOM();
        }
    }

    /**
     * 获取当前语言
     * @returns {string}
     */
    getLanguage() {
        return this.currentLang;
    }

    /**
     * 添加语言变更监听器
     * @param {Function} callback
     */
    onChange(callback) {
        this.listeners.push(callback);
    }

    /**
     * 移除语言变更监听器
     * @param {Function} callback
     */
    offChange(callback) {
        const idx = this.listeners.indexOf(callback);
        if (idx > -1) this.listeners.splice(idx, 1);
    }

    /**
     * 通知所有监听器
     */
    notifyListeners() {
        this.listeners.forEach(cb => cb(this.currentLang));
    }

    /**
     * 更新 DOM 元素的文本
     */
    updateDOM() {
        document.documentElement.lang = this.currentLang === 'zh' ? 'zh-CN' : 'en';

        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            el.textContent = this.t(key);
        });

        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            el.setAttribute('title', this.t(key));
        });

        document.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
            const key = el.getAttribute('data-i18n-aria-label');
            el.setAttribute('aria-label', this.t(key));
        });

        document.querySelectorAll('[data-i18n-tooltip]').forEach(el => {
            const key = el.getAttribute('data-i18n-tooltip');
            el.setAttribute('data-tooltip', this.t(key));
        });
    }
}

// 导出单例
export const i18n = new I18n();
export const t = i18n.t.bind(i18n);

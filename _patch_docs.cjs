const fs = require('fs');

// Update devlog.md
let devlog = fs.readFileSync('devlog.md', 'utf8');
if (!devlog.includes('Game-Specific Post-Game Analysis')) {
    devlog += `
## Game-Specific Post-Game Analysis (2026-07-07)

- **LLM Coach `buildPostGameRequest`** now accepts \`gameType\` and injects game-specific strategic prompts for all 5 games (Gomoku, Go, Chess, Xiangqi, Junqi)
- System prompt dynamically selects the right game's role ("expert chess post-game analyst", etc.) and strategy focus (material balance, territory, forbidden moves, etc.)
- User message includes game type label for LLM context
- Removed generic fallback "board game analyst" — every game now gets tailored analysis
- Tests updated: 999 passing across 41 test files
`;
    fs.writeFileSync('devlog.md', devlog, 'utf8');
    console.log('devlog.md updated');
}

// Update CHANGELOG.md
let changelog = fs.readFileSync('CHANGELOG.md', 'utf8');
if (!changelog.includes('Game-specific post-game')) {
    changelog += `
### Game-Specific Post-Game Analysis
- LLM Coach post-game analysis now uses game-specific strategic prompts
- Each of the 5 games (Gomoku, Go, Chess, Xiangqi, Junqi) gets tailored expert analysis
- System prompt dynamically adapts role and strategy focus per game type
`;
    fs.writeFileSync('CHANGELOG.md', changelog, 'utf8');
    console.log('CHANGELOG.md updated');
}

// Update KNOWLEDGE_BASE.md
let kb = fs.readFileSync('KNOWLEDGE_BASE.md', 'utf8');
if (!kb.includes('LLM Post-Game GameType')) {
    kb += `
## Rule: LLM Post-Game GameType Threading

When adding \`gameType\` to LLM Coach request functions:
1. \`buildPostGameRequest(snapshot, boardImageDataUrl, model)\` was generic — always used fallback "board game analyst"
2. Adding \`gameType\` param and a \`POST_GAME_ADVICE\` map per game provides tailored analysis
3. The existing \`buildChatCompletionRequest\` already used \`GAME_COACH_CONFIG[gameType]\` correctly
4. Pattern: always thread \`gameType\` through from \`requestPostGameAnalysis()\` → \`buildPostGameRequest()\` → system message
5. Test: existing test \`should send a post-game analysis request with gameType\` validates the system message contains game-specific text
`;
    fs.writeFileSync('KNOWLEDGE_BASE.md', kb, 'utf8');
    console.log('KNOWLEDGE_BASE.md updated');
}

console.log('Marketing docs updated');

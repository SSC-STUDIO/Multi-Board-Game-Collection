const fs = require('fs');

const file = 'src/styles/main.css';
let css = fs.readFileSync(file, 'utf8');

const startIdx = css.indexOf('@media (prefers-color-scheme: dark)');
if (startIdx === -1) {
  console.log('Dark mode block not found');
  process.exit(1);
}

let depth = 0;
let endIdx = -1;
for (let i = startIdx; i < css.length; i++) {
  if (css[i] === '{') depth++;
  if (css[i] === '}') {
    depth--;
    if (depth === 0) { endIdx = i + 1; break; }
  }
}

var L = [];
L.push('@media (prefers-color-scheme: dark) {');
L.push('    html { color-scheme: dark; }');
L.push('    :root {');
L.push('        --bg-start: #1a1410; --bg-end: #120e08;');
L.push('        --ink: #e8e0d4; --muted: #a89882;');
L.push('        --accent: #e8953e; --accent-deep: #c46828;');
L.push('        --panel: rgba(30,25,18,0.92); --panel-strong: rgba(38,32,24,0.98);');
L.push('        --shadow: 0 18px 40px rgba(0,0,0,0.45);');
L.push('        --wood: #8a6238; --wood-deep: #6a4828;');
L.push('        --heading-color: #f0dcc0;');
L.push('        --card-warm-bg: #2a2218; --card-dark-bg: #1a1410;');
L.push('        --card-dark-mid: #2e2218; --card-warm-light: #8a6238;');
L.push('        --card-warm-pale: #3a2e20;');
L.push('        --card-finished-dark: #5a3a18; --card-finished-light: #8a6238;');
L.push('        --option-active-start: #c46828; --option-active-end: #e8953e;');
L.push('        --option-active-border: #a45820; --option-active-text: #f0dcc0;');
L.push('        --btn-primary-text: #f0dcc0; --btn-ghost-hover: rgba(255,255,255,0.08);');
L.push('        --focus-ring-color: #e8953e;');
L.push('        --control-btn-bg: #2e2218; --control-btn-text: #e8dcc8;');
L.push('        --control-btn-danger: #8a2a2a;');
L.push('        --message-success-text: #6abf72; --message-success-bg: rgba(30,60,35,0.9);');
L.push('        --message-error-text: #e85a5a; --message-error-bg: rgba(60,20,20,0.95);');
L.push('        --panel-card-value-color: #e8d4b8;');
L.push('        --result-title-color: #f0dcc0; --result-stat-value-color: #e8d4b8;');
L.push('        --board-depth-start: #5a4020; --board-depth-end: #2e1e10;');
L.push('        --dot-marker: #8a7a60;');
L.push('    }');
L.push('    body { background: radial-gradient(circle at top, var(--bg-start), var(--bg-end)); }');
L.push('    .hero-kicker { background: rgba(30,25,18,0.76); color: var(--accent); }');
L.push('    .panel { background: var(--panel); }');
L.push('    .stage-copy { background: linear-gradient(135deg, rgba(40,32,22,0.95), rgba(50,38,26,0.9)); }');
L.push('    .status-bar { background: rgba(38,32,24,0.75); }');
L.push('    .board-frame { background: linear-gradient(145deg, rgba(40,32,22,0.7), rgba(50,38,26,0.22)); }');
L.push('    .board-glow { background: radial-gradient(circle at center, rgba(100,70,30,0.22), rgba(100,70,30,0)); }');
L.push('    .result-card { background: linear-gradient(145deg, rgba(35,28,20,0.98), rgba(28,22,16,0.98)); color: #f0dcc0; }');
L.push('    .result-title { color: #f0dcc0; }');
L.push('    .result-detail { color: rgba(240,220,192,0.72); }');
L.push('    .result-stat { background: rgba(255,255,255,0.06); }');
L.push('    .result-stat-value { color: #f0dcc0; }');
L.push('    .message { background: rgba(38,32,24,0.86); color: rgba(240,220,192,0.8); }');
L.push('    .panel-card { background: rgba(38,32,24,0.76); }');
L.push('    .panel-card-accent { background: linear-gradient(145deg, rgba(50,38,26,0.94), rgba(70,50,30,0.7)); }');
L.push('    .ghost-btn:hover { background: rgba(255,255,255,0.08); }');
L.push('    .option-btn { border-color: rgba(160,120,60,0.2); }');
L.push('    .chess-board-shell { background: linear-gradient(140deg, #2a1d12, #120c06); }');
L.push('    .xiangqi-piece { background: radial-gradient(circle at 30% 28%, #e8d4a8, #a07840 72%); }');
L.push('    .junqi-piece-back { background: radial-gradient(circle at 34% 28%, rgba(255,229,154,0.36), transparent 38%), linear-gradient(135deg, #6b5228, #2a1e0e); }');
L.push('    .junqi-piece-face { background: radial-gradient(circle at 30% 28%, #e8d4a8, #a07840 78%); }');
L.push('    .result-win .result-card { background: linear-gradient(145deg, rgba(40,32,22,0.98), rgba(60,42,24,0.98)); }');
L.push('    .result-draw .result-card { background: linear-gradient(145deg, rgba(38,32,26,0.98), rgba(45,38,30,0.98)); }');
L.push('    .result-resign .result-card { background: linear-gradient(145deg, rgba(35,28,20,0.98), rgba(50,35,22,0.98)); }');
L.push('    .move-list { scrollbar-color: #5a4a38 transparent; }');
L.push('}');

const newDarkMode = L.join('\n');
css = css.substring(0, startIdx) + newDarkMode + css.substring(endIdx);
fs.writeFileSync(file, css, 'utf8');
console.log('Dark mode section replaced with CSS-variable-based approach');

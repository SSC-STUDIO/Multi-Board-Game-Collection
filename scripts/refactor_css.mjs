
const fs = require('fs');

// 1. Extend :root in base.css with new semantic tokens
const baseFile = 'src/styles/base.css';
let base = fs.readFileSync(baseFile, 'utf8');

const newTokens = [
  '    /* Semantic design tokens for component theming */',
  '    --heading-color: #4c2610;',
  '    --card-warm-bg: #fffaf2;',
  '    --card-dark-bg: #292525;',
  '    --card-dark-mid: #5b4333;',
  '    --card-warm-light: #c98c52;',
  '    --card-warm-pale: #f3d4af;',
  '    --card-finished-dark: #8c5123;',
  '    --card-finished-light: #d38d45;',
  '    --option-active-start: #f6c37a;',
  '    --option-active-end: #d17b30;',
  '    --option-active-border: #c8722d;',
  '    --option-active-text: #2c1404;',
  '    --btn-primary-text: #fffaf2;',
  '    --btn-ghost-hover: rgba(255, 255, 255, 0.8);',
  '    --stone-black-start: #4a4a4a;',
  '    --stone-black-mid: #1a1a1a;',
  '    --stone-black-end: #0a0a0a;',
  '    --stone-white-start: #ffffff;',
  '    --stone-white-mid: #e8e8e8;',
  '    --stone-white-end: #c8c8c8;',
  '    --focus-ring-color: #ffb347;',
  '    --control-btn-bg: #2f2f2f;',
  '    --control-btn-text: #fff5e8;',
  '    --control-btn-danger: #a43a3a;',
  '    --message-success-text: #2f5f36;',
  '    --message-success-bg: rgba(213, 241, 220, 0.9);',
  '    --message-error-text: #7a2525;',
  '    --message-error-bg: rgba(255, 224, 224, 0.95);',
  '    --panel-card-value-color: #4a2812;',
  '    --result-title-color: #4d2810;',
  '    --result-stat-value-color: #43200d;',
].join('\n');

base = base.replace('    --cell-size: 32px;', '    --cell-size: 32px;\n' + newTokens);
fs.writeFileSync(baseFile, base, 'utf8');
console.log('base.css updated with new tokens');


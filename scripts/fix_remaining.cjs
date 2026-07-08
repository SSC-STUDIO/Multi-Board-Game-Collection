const fs = require('fs');

// Add remaining tokens to base.css
const baseFile = 'src/styles/base.css';
let base = fs.readFileSync(baseFile, 'utf8');
const moreTokens = [
  '    --board-depth-start: #8b6914;',
  '    --board-depth-end: #5a3d0a;',
  '    --dot-marker: #2b1a0a;',
].join('\n');
base = base.replace('    --result-stat-value-color: #43200d;',
  '    --result-stat-value-color: #43200d;\n' + moreTokens);
fs.writeFileSync(baseFile, base, 'utf8');

// Replace remaining in components.css
const compFile = 'src/styles/components.css';
let css = fs.readFileSync(compFile, 'utf8');
css = css.replace(/linear-gradient\(180deg, #8b6914, #5a3d0a\)/g,
  'linear-gradient(180deg, var(--board-depth-start), var(--board-depth-end))');
css = css.replace(/background: #2b1a0a;/g, 'background: var(--dot-marker);');
css = css.replace(/color: #5a4e42;/g, 'color: var(--muted);');
fs.writeFileSync(compFile, css, 'utf8');
console.log('Remaining 3 hardcoded hex colors resolved');

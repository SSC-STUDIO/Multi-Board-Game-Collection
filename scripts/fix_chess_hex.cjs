var fs = require('fs');

// Add chess/junqi piece tokens to base.css
var baseFile = 'src/styles/base.css';
var base = fs.readFileSync(baseFile, 'utf8');
var moreTokens = [
  '    --chess-white: #fdfaf3;',
  '    --chess-white-stroke: #000000;',
  '    --chess-black: #1a1814;',
  '    --chess-black-stroke: rgba(255,255,255,0.3);',
].join('\n');
base = base.replace('    --dot-marker: #2b1a0a;',
  '    --dot-marker: #2b1a0a;\n' + moreTokens);
fs.writeFileSync(baseFile, base, 'utf8');

// Replace in main.css
var mainFile = 'src/styles/main.css';
var css = fs.readFileSync(mainFile, 'utf8');

// chess-piece-w
css = css.replace(
  /color: #fdfaf3;\n\s*text-shadow: 0 0 1px #000, 0 0 1px #000, 0 0 1px #000;/,
  'color: var(--chess-white);\n    text-shadow: 0 0 1px var(--chess-white-stroke), 0 0 1px var(--chess-white-stroke), 0 0 1px var(--chess-white-stroke);'
);
// chess-piece-b
css = css.replace(
  /color: #1a1814;\n\s*text-shadow: 0 0 1px rgba\(255, 255, 255, 0\.3\);/,
  'color: var(--chess-black);\n    text-shadow: 0 0 1px var(--chess-black-stroke);'
);

fs.writeFileSync(mainFile, css, 'utf8');
console.log('Chess piece hex colors replaced with CSS variables');

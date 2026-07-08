var fs = require('fs');

// Add Go stone tokens to base.css
var baseFile = 'src/styles/base.css';
var base = fs.readFileSync(baseFile, 'utf8');
var moreTokens = [
  '    --go-stone-black-start: #4a4a4a;',
  '    --go-stone-black-end: #0a0a0a;',
  '    --go-stone-white-start: #ffffff;',
  '    --go-stone-white-end: #cfc7b8;',
].join('\n');
base = base.replace('    --chess-black-stroke: rgba(20,16,10,0.3);',
  '    --chess-black-stroke: rgba(20,16,10,0.3);\n' + moreTokens);
fs.writeFileSync(baseFile, base, 'utf8');

// Replace in main.css
var mainFile = 'src/styles/main.css';
var css = fs.readFileSync(mainFile, 'utf8');

css = css.replace(
  /radial-gradient\(circle at 35% 30%, #4a4a4a, #0a0a0a 75%\);/,
  'radial-gradient(circle at 35% 30%, var(--go-stone-black-start), var(--go-stone-black-end) 75%);'
);
css = css.replace(
  /radial-gradient\(circle at 35% 30%, #ffffff, #cfc7b8 70%\);/,
  'radial-gradient(circle at 35% 30%, var(--go-stone-white-start), var(--go-stone-white-end) 70%);'
);
css = css.replace(
  /outline: 2px solid #ffb347;/,
  'outline: 2px solid var(--focus-ring-color);'
);

fs.writeFileSync(mainFile, css, 'utf8');
console.log('Go stone hex colors replaced with CSS variables');

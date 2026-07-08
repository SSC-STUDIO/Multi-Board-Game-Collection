const fs = require('fs');

const file = 'src/styles/components.css';
let css = fs.readFileSync(file, 'utf8');

// Replacements map: hardcoded -> CSS variable
const replacements = [
  // stage-title
  [/color: #4c2610;/g, 'color: var(--heading-color);'],
  // turn-spotlight default text color
  [/color: #fffaf2;/g, 'color: var(--card-warm-bg);'],
  // turn-spotlight.turn-black
  [/background: linear-gradient\(135deg, #292525, #5b4333\);/g,
   'background: linear-gradient(135deg, var(--card-dark-bg), var(--card-dark-mid));'],
  // turn-spotlight.turn-white
  [/background: linear-gradient\(135deg, #c98c52, #f3d4af\);/g,
   'background: linear-gradient(135deg, var(--card-warm-light), var(--card-warm-pale));'],
  [/color: #4b2810;/g, 'color: var(--heading-color);'],
  // turn-spotlight.turn-finished
  [/background: linear-gradient\(135deg, #8c5123, #d38d45\);/g,
   'background: linear-gradient(135deg, var(--card-finished-dark), var(--card-finished-light));'],
  // option-btn.active
  [/background: linear-gradient\(135deg, #f6c37a, #d17b30\);/g,
   'background: linear-gradient(135deg, var(--option-active-start), var(--option-active-end));'],
  [/border-color: #c8722d;/g, 'border-color: var(--option-active-border);'],
  [/color: #2c1404;/g, 'color: var(--option-active-text);'],
  // primary-btn text
  // color: #fffaf2 already handled above
  // ghost-btn hover
  [/background: #fffaf2;/g, 'background: var(--card-warm-bg);'],
  // stone black
  [/radial-gradient\(circle at 40% 35%, #4a4a4a, #1a1a1a 50%, #0a0a0a 80%\);/g,
   'radial-gradient(circle at 40% 35%, var(--stone-black-start), var(--stone-black-mid) 50%, var(--stone-black-end) 80%);'],
  // stone white
  [/radial-gradient\(circle at 40% 35%, #ffffff, #e8e8e8 40%, #c8c8c8 80%\);/g,
   'radial-gradient(circle at 40% 35%, var(--stone-white-start), var(--stone-white-mid) 40%, var(--stone-white-end) 80%);'],
  // focus ring
  [/outline: 2px solid #ffb347;/g, 'outline: 2px solid var(--focus-ring-color);'],
  // control-btn
  [/background: #2f2f2f;/g, 'background: var(--control-btn-bg);'],
  [/color: #fff5e8;/g, 'color: var(--control-btn-text);'],
  // control-btn.danger
  [/background: #a43a3a;/g, 'background: var(--control-btn-danger);'],
  // message.success
  [/color: #2f5f36;/g, 'color: var(--message-success-text);'],
  // message.error
  [/color: #7a2525;/g, 'color: var(--message-error-text);'],
  // panel-card-value
  [/color: #4a2812;/g, 'color: var(--panel-card-value-color);'],
  // result-title
  [/color: #4d2810;/g, 'color: var(--result-title-color);'],
  // result-stat-value
  [/color: #43200d;/g, 'color: var(--result-stat-value-color);'],
];

let count = 0;
for (const [pattern, replacement] of replacements) {
  const before = css;
  css = css.replace(pattern, replacement);
  if (css !== before) count++;
}

fs.writeFileSync(file, css, 'utf8');
console.log('components.css refactored: ' + count + ' replacement patterns applied');

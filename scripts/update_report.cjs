var fs = require('fs');
var file = 'Board_Game_Collection_Report.md';
var c = fs.readFileSync(file, 'utf8');
c = c.replace('41 test files', '48 test files');
var oldKeyDiff = '- **1126 Unit Tests** across 48 test files';
var newLines = oldKeyDiff + '\n' +
'- **Premium CSS Design System**: 35+ semantic tokens in :root with zero hardcoded hex in components.css\n' +
'- **Full Dark Mode**: @media (prefers-color-scheme: dark) with comprehensive variable overrides\n' +
'- **Micro-Interactions**: Cell hover scale, panel card lift, board frame glow, piece placement ripple, title gradient shimmer\n' +
'- **Accessibility**: WCAG 2.5.8 touch targets, keyboard navigation with focus rings, skip-link, prefers-reduced-motion';
c = c.replace(oldKeyDiff, newLines);
fs.writeFileSync(file, c, 'utf8');
console.log('Report updated');

var fs = require('fs');
var mainFile = 'src/styles/main.css';
var css = fs.readFileSync(mainFile, 'utf8');

// Add chess piece dark mode token overrides after --dot-marker
css = css.replace(
  '--dot-marker: #8a7a60;',
  '--dot-marker: #8a7a60;\n        --chess-white: #f5f0e8;\n        --chess-white-stroke: #2a2520;\n        --chess-black: #d8d0c0;\n        --chess-black-stroke: rgba(20,16,10,0.3);'
);

fs.writeFileSync(mainFile, css, 'utf8');
console.log('Dark mode chess piece tokens added');

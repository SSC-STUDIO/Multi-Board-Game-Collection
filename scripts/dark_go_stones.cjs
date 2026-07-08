var fs = require('fs');
var mainFile = 'src/styles/main.css';
var css = fs.readFileSync(mainFile, 'utf8');

// Add Go stone dark mode tokens after chess-black-stroke
css = css.replace(
  '--chess-black-stroke: rgba(20,16,10,0.3);',
  '--chess-black-stroke: rgba(20,16,10,0.3);\n        --go-stone-black-start: #3a3a3a;\n        --go-stone-black-end: #050505;\n        --go-stone-white-start: #f0ede4;\n        --go-stone-white-end: #b8b0a0;'
);

fs.writeFileSync(mainFile, css, 'utf8');
console.log('Go stone dark mode tokens added');

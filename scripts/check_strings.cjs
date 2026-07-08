var fs = require('fs');
var files = [
  'src/games/gomoku/GomokuApp.js',
  'src/games/go/GoApp.js',
  'src/games/chess/ChessApp.js',
  'src/games/xiangqi/XiangqiApp.js',
  'src/games/junqi/JunqiApp.js'
];
files.forEach(function(f) {
  try {
    var c = fs.readFileSync(f, 'utf8');
    var lines = c.split('\n');
    lines.forEach(function(l, i) {
      if (l.indexOf('textContent') !== -1 && l.indexOf('=') !== -1) {
        var match = l.match(/textContent\s*=\s*['"](.*?)['"]/);
        if (match && match[1].length > 3 && match[1].indexOf('{') === -1) {
          console.log(f + ':' + (i+1) + ': ' + match[1].substring(0, 80));
        }
      }
    });
  } catch(e) {}
});

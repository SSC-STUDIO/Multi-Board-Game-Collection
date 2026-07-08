var fs = require('fs');
var files = [
  'src/ui/render.js',
  'src/ui/dom.js',
  'src/ui/devPanel.js',
  'src/ui/confirmDialog.js',
  'src/app/controllers/CoachController.js',
  'src/app/controllers/GameController.js',
  'src/app/controllers/SettingsController.js',
  'src/app/controllers/ImmersiveHudManager.js',
  'src/main.js'
];
files.forEach(function(f) {
  try {
    var c = fs.readFileSync(f, 'utf8');
    var lines = c.split('\n');
    lines.forEach(function(l, i) {
      var match = l.match(/textContent\s*=\s*['"](.*?)['"]/);
      if (match && match[1].length > 3 && match[1].indexOf('{') === -1) {
        console.log(f + ':' + (i+1) + ': ' + match[1].substring(0, 100));
      }
      var match2 = l.match(/innerHTML\s*=\s*['"](.*?)['"]/);
      if (match2 && match2[1].length > 5 && match2[1].indexOf('{') === -1 && match2[1].indexOf('<') !== -1) {
        console.log(f + ':' + (i+1) + ' [innerHTML]: ' + match2[1].substring(0, 100));
      }
    });
  } catch(e) {}
});

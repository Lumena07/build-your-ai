const fs = require('fs');
fs.mkdirSync('dist', { recursive: true });
for (const file of ['index.html', 'styles.css', 'modal-fix.css', 'app.js']) fs.copyFileSync(file, `dist/${file}`);
fs.copyFileSync('public/og.png', 'dist/og.png');
console.log('Static prototype ready');

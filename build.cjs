const fs = require('fs');
fs.mkdirSync('dist', { recursive: true });
for (const file of ['index.html', 'styles.css', 'app.js']) fs.copyFileSync(file, `dist/${file}`);
console.log('Static prototype ready');

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'blocks');
const output = path.join(root, 'dist-blocks');
const files = [
  'manifest.json',
  'README.md',
  'eve-teacher/index.js',
  'learning-journey/index.js',
  'classroom-ui/index.js'
];

fs.rmSync(output, { recursive: true, force: true });
for (const relative of files) {
  const from = path.join(source, relative);
  if (!fs.statSync(from).isFile()) throw new Error(`Missing block source: ${relative}`);
  const to = path.join(output, relative);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}
fs.copyFileSync(path.join(root, 'SHIPPABLE-BLOCKS.md'), path.join(output, 'INTEGRATION.md'));
console.log(`Built ${files.length - 2} reusable blocks in ${output}`);

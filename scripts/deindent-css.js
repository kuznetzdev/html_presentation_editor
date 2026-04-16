'use strict';
const fs = require('fs');
const path = require('path');

const stylesDir = path.join(__dirname, '..', 'editor', 'styles');
const files = fs.readdirSync(stylesDir).filter(f => f.endsWith('.css'));

for (const file of files) {
  const filePath = path.join(stylesDir, file);
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  const fixed = lines.map(line => {
    // Strip exactly 6 leading spaces if the line starts with at least 6 spaces
    if (line.startsWith('      ')) {
      return line.slice(6);
    }
    return line;
  });

  fs.writeFileSync(filePath, fixed.join('\n'), 'utf8');
  console.log(`Fixed: ${file}`);
}
console.log('Done');

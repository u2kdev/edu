const fs = require('fs');
const path = require('path');

function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');

  const lines = content.split('\n');
  let newLines = [];
  let modified = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('// eslint-disable-next-line no-restricted-imports //')) {
      const parts = line.split('// eslint-disable-next-line no-restricted-imports //');
      newLines.push(`// Reason: ${parts[1].trim()}`);
      newLines.push(`// eslint-disable-next-line no-restricted-imports`);
      modified = true;
    } else {
      newLines.push(line);
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, newLines.join('\n'));
    console.log(`Updated ${filePath}`);
  }
}

function walk(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    const dirPath = path.join(dir, f);
    const isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walk(dirPath, callback) : callback(path.join(dir, f));
  });
}

walk('src/app/api', function(filePath) {
  if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
    processFile(filePath);
  }
});

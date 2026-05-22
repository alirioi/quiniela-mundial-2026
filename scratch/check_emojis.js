const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(fullPath));
    } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.astro') || file.endsWith('.css')) {
      results.push(fullPath);
    }
  });
  return results;
}

// Regex matching common emojis and symbols
const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{2600}-\u{26FF}\u{1F900}-\u{1F9FF}\u{1F000}-\u{1FFFF}]/u;

const srcPath = path.join(__dirname, '../src');
const files = walk(srcPath);

console.log(`Searching in ${srcPath} (${files.length} files)...`);

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (emojiRegex.test(line)) {
      console.log(`${path.relative(srcPath, file)}:${idx + 1}: ${line.trim()}`);
    }
  });
});

import fs from 'fs';
import path from 'path';

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const dirent of list) {
    const full = path.join(dir, dirent.name);
    if (dirent.isDirectory()) results = results.concat(walk(full));
    else results.push(full);
  }
  return results;
}

const root = path.resolve('app/api');
const files = walk(root).filter(f => f.endsWith('route.ts'));
let changed = 0;
for (const f of files) {
  const c = fs.readFileSync(f, 'utf8');
  if (!/export\s*\{\s*\}/m.test(c)) {
    fs.writeFileSync(f, 'export {};' + '\n\n' + c, 'utf8');
    changed++;
    console.log('Updated', f);
  }
}
console.log('Done. Files changed:', changed);

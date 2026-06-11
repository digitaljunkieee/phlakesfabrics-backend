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
const missing = [];
for (const f of files) {
  const c = fs.readFileSync(f, 'utf8');
  if (!/export\s*\{\s*\}\s*;?/m.test(c)) missing.push(f);
}
if (missing.length === 0) {
  console.log('All route.ts files already contain `export {}`.');
} else {
  console.log('Files missing `export {}`:');
  for (const m of missing) console.log(m);
}

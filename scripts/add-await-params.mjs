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
  if (!f.includes('[')) continue;
  let c = fs.readFileSync(f,'utf8');
  const fnRegex = /(export\s+async\s+function\s+\w+\s*\([^)]*ctx\s*\?:\s*\{[^}]*\}\s*\)\s*\{)/g;
  let m;
  let newC = c;
  while ((m = fnRegex.exec(c)) !== null) {
    const fnStart = m.index;
    const fnHeader = m[1];
    const insertAfter = fnStart + fnHeader.length;
    const after = c.slice(insertAfter, insertAfter + 400);
    if (/const\s+params\s*=\s*ctx/.test(after)) continue;
    newC = newC.slice(0, insertAfter) + '\n  const params = ctx && ctx.params ? await ctx.params : undefined;\n' + newC.slice(insertAfter);
  }
  if (newC !== c) {
    fs.writeFileSync(f, newC, 'utf8');
    console.log('Patched', f);
    changed++;
  }
}
console.log('Done. Files changed:', changed);

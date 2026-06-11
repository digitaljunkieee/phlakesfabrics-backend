import fs from 'fs';
import path from 'path';

function walk(dir){
  let res=[];
  for(const e of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,e.name); if(e.isDirectory()) res=res.concat(walk(full)); else res.push(full)}
  return res;
}
const root=path.resolve('app/api');
const files=walk(root).filter(f=>f.endsWith('route.ts'));
let changed=0;
for(const f of files){
  let src=fs.readFileSync(f,'utf8');
  const orig=src;
  src = src.replace(/```[\s\S]*?```/g, (m)=>{
    return m.replace(/^```\w*\n?/,'').replace(/\n?```$/,'');
  });
  src = src.replace(/^\s+/, '');
  if(src!==orig){ fs.writeFileSync(f, src, 'utf8'); console.log('Cleaned', f); changed++; }
}
console.log('Done. Files cleaned:', changed);

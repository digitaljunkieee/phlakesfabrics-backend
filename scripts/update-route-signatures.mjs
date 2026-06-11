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
  let orig=src;
  if(/from\s+['\"]next\/server['\"]/m.test(src)){
    src=src.replace(/import\s+\{\s*([^}]+)\s*\}\s*from\s+(['\"])next\/server\2/m, (m,inner,quote)=>{
      if(/NextRequest/.test(inner)) return m;
      return `import { ${inner.trim()}, NextRequest } from ${quote}next/server${quote}`;
    });
  } else {
    src='import { NextResponse, NextRequest } from "next/server";\n\n'+src;
  }

  src=src.replace(/export\s+async\s+function\s+(GET|POST|PATCH|DELETE)\s*\(([^)]*)\)\s*\{/g, (m,method,args)=>{
    const usesParams = /\{\s*params\s*\}/.test(args);
    const newSig = `export async function ${method}(req: NextRequest, ctx?: { params?: Promise<any> }) {`;
    if(usesParams){
      return newSig + '\n  const params = ctx && ctx.params ? await ctx.params : undefined;\n';
    }
    return newSig;
  });

  if(src!==orig){
    fs.writeFileSync(f,src,'utf8');
    console.log('Updated',f);
    changed++;
  }
}
console.log('Done. Files changed:',changed);

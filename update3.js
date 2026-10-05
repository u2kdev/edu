const fs = require('fs');
const glob = require('glob');
const files = glob.sync('src/app/**/*.tsx');
for(let f of files){
  let c = fs.readFileSync(f,'utf8');
  if(c.includes('@/lib/db') || c.includes('db-tenant')){
    if(f.includes('platform-admin')) continue;
    if(f.includes('developer')) continue;
    if(f.includes('auth')) continue;
    if(f.includes('layout.tsx') && f.includes('src/app/layout.tsx')) continue;

    // Remove old requireTenantAccess import if any, we'll re-add it clean
    c = c.replace(/import\s+\{\s*requireTenantAccess[^}]*\}\s*from\s*['"]@\/lib\/tenant['"];?\n?/g, '');
    
    // Add import { requireTenantAccess } from "@/lib/tenant"; at the top
    c = 'import { requireTenantAccess } from "@/lib/tenant";\n' + c;

    // Check if requireTenantAccess() is already called
    let varName = 'tenantCtx';
    const match = c.match(/const\s+([a-zA-Z0-9_]+)\s*=\s*await\s+requireTenantAccess\(\)/);
    if (match) {
       varName = match[1];
    } else {
       // inject it
       c = c.replace(/(export default async function\s+[A-Za-z0-9_]+\s*\([^)]*\)\s*\{)/, `$1\n  const tenantCtx = await requireTenantAccess();\n`);
    }

    c = c.replace(/import\s+\{\s*db\s*\}\s*from\s*['"]@\/lib\/db['"];?/g, 'import { getTenantDb } from "@/lib/db-tenant";');
    
    c = c.replace(/db\.([a-zA-Z0-9_]+)\./g, `getTenantDb(${varName}.center.id).$1.`);

    fs.writeFileSync(f,c);
  }
}

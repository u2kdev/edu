const fs = require('fs');
const glob = require('glob');
const files = glob.sync('src/app/**/*.tsx');
for(const f of files){
  let c = fs.readFileSync(f,'utf8');
  if(c.includes('@/lib/db')){
    if (f.includes('platform-admin')) continue;
    if (f.includes('developer')) continue;
    if (f.includes('auth')) continue;

    // Find what the variable for requireTenantAccess is
    const match = c.match(/const\s+([a-zA-Z0-9_]+)\s*=\s*await\s+requireTenantAccess\(\)/);
    if (!match) continue; // Skip if no requireTenantAccess
    
    const varName = match[1];

    c = c.replace(/import \{ db \} from ["']@\/lib\/db["'];/g, 'import { getTenantDb } from "@/lib/db-tenant";');
    
    // Replace all db.model.
    c = c.replace(/db\.([a-zA-Z0-9_]+)\./g, `getTenantDb(${varName}.center.id).$1.`);
    fs.writeFileSync(f,c);
  }
}

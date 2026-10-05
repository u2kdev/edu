const { execSync } = require('child_process');
const fs = require('fs');

try {
  const result = execSync('powershell -Command "Select-String -Path src\\\\**\\\\* -Include *.ts,*.tsx -Exclude *.test.ts -Recurse -Pattern \'lib/db[\\\"''''\\\"]|new PrismaClient|PrismaClient\\\\(\' | Select-Object Path, LineNumber, Line | ConvertTo-Json"');
  
  const parsed = JSON.parse(result.toString());
  let out = "";
  for (const item of [].concat(parsed)) {
    if(item) out += `${item.Path}:${item.LineNumber}: ${item.Line.trim()}\n`;
  }
  fs.writeFileSync('reports/grep-db.log', out);
} catch(e) {
  console.log(e.message);
  if(e.stdout) console.log(e.stdout.toString());
  if(e.stderr) console.log(e.stderr.toString());
}

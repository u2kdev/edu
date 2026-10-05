const { execSync } = require('child_process');
try {
  execSync('powershell -Command "Select-String -Path src\\* -Include *.ts,*.tsx -Exclude *.test.ts -Recurse -Pattern \\"lib/db[''\\\"]|new PrismaClient|PrismaClient\\\\(\\" | Select-Object Path, LineNumber, Line | Out-File reports\\grep-db.log"');
} catch(e) {}

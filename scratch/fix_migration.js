const fs = require('fs');
let f = 'prisma/migrations/20261005152002_phase3_fixes/migration.sql';
let sql = fs.readFileSync(f, 'utf8');
sql = sql.replace(/UPDATE.*/g, 'UPDATE "PlatformUser" SET "emailVerified" = CURRENT_TIMESTAMP WHERE "emailVerified" IS NULL;');
fs.writeFileSync(f, sql);

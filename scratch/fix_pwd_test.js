const fs = require('fs');
let c = fs.readFileSync('tests/password.test.ts', 'utf8');
c = c.replace(/fullName: "Pwd User" }/g, 'fullName: "Pwd User", emailVerified: new Date() }');
fs.writeFileSync('tests/password.test.ts', c);

const fs = require('fs');
let lines = fs.readFileSync('src/app/api/auth/register/route.ts', 'utf8').split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('void sendEmail(')) {
    lines[i] = '      void sendEmail(user!.email, "Invited", "Please check").catch(err => {';
  }
}
fs.writeFileSync('src/app/api/auth/register/route.ts', lines.join('\n'));

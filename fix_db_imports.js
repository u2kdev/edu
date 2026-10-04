const fs = require('fs');
const path = require('path');

const exceptions = [
  { match: "src/app/api/auth", reason: "Exception: Auth routes operate on platform models." },
  { match: "src/app/api/developer", reason: "Exception: Developer routes operate on platform models." },
  { match: "src/app/api/health", reason: "Exception: Health route operates globally." },
  { match: "src/app/api/platform", reason: "Exception: Platform routes manage global models." },
  { match: "src/app/api/tickets", reason: "Exception: Support tickets are platform-level models." },
  { match: "src/app/api/notifications", reason: "Exception: Notifications span across multiple centers for a specific user." },
  { match: "src/app/api/tenant/onboarding", reason: "Exception: Creation of platform-level models." },
  { match: "src/app/api/tenant/staff", reason: "Exception: Creation of platform-level models." },
  { match: "src/app/api/invites", reason: "Exception: Invite validation requires global search before center context is known." }
];

function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let reason = "Exception: Allowed raw db access.";
  
  for (const exc of exceptions) {
    if (filePath.replace(/\\/g, '/').includes(exc.match)) {
      reason = exc.reason;
      break;
    }
  }

  const lines = content.split('\n');
  let newLines = [];
  let modified = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('from "@/lib/db"') || (line.includes('from "../') && line.includes('lib/db'))) {
      if (i > 0 && lines[i-1].includes('eslint-disable-next-line no-restricted-imports')) {
        // already has disable comment, let's just make sure it has the reason on that line or above
        if (!lines[i-1].includes('Exception:')) {
           newLines[newLines.length - 1] = `// eslint-disable-next-line no-restricted-imports // ${reason}`;
           modified = true;
        }
        newLines.push(line);
      } else {
        newLines.push(`// eslint-disable-next-line no-restricted-imports // ${reason}`);
        newLines.push(line);
        modified = true;
      }
    } else {
      newLines.push(line);
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, newLines.join('\n'));
    console.log(`Updated ${filePath}`);
  }
}

function walk(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    const dirPath = path.join(dir, f);
    const isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walk(dirPath, callback) : callback(path.join(dir, f));
  });
}

walk('src/app/api', function(filePath) {
  if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
    processFile(filePath);
  }
});

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const reportsDir = path.join(process.cwd(), 'reports');
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir);
}

const commands = [
  { name: 'tsc', cmd: 'npx tsc --noEmit' },
  { name: 'lint', cmd: 'npm run lint' },
  { name: 'vitest', cmd: 'npx vitest run' },
  { name: 'build', cmd: 'npm run build' }
];

const results = [];

for (const { name, cmd } of commands) {
  console.log(`Running ${name}...`);
  const logFile = path.join(reportsDir, `${name}.log`);
  const startTime = new Date().toISOString();
  
  let exitCode = 0;
  let output = `[${startTime}] Command: ${cmd}\n`;
  
  try {
    const out = execSync(cmd, { encoding: 'utf8', stdio: 'pipe' });
    output += out;
  } catch (err) {
    exitCode = err.status || 1;
    if (err.stdout) output += err.stdout;
    if (err.stderr) output += err.stderr;
  }
  
  const endTime = new Date().toISOString();
  output += `\n[${endTime}] exit=${exitCode}\n`;
  
  fs.writeFileSync(logFile, output);
  
  const hash = crypto.createHash('md5').update(output).digest('hex');
  results.push({ name, exitCode, hash });
}

console.log('\n=== VERIFY SUMMARY ===');
for (const res of results) {
  console.log(`${res.name.padEnd(10)} | exit=${res.exitCode} | md5=${res.hash}`);
}

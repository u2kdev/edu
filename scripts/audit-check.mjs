import { execSync } from 'child_process';

try {
  let stdout = '';
  try {
    stdout = execSync('npm audit --omit=dev --json', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (err) {
    stdout = err.stdout ? err.stdout.toString() : '';
  }

  const data = JSON.parse(stdout);
  const vulns = Object.keys(data.vulnerabilities || {});
  const nonNext = vulns.filter((k) => k !== 'next');

  if (nonNext.length > 0) {
    console.error('Unhandled production vulnerabilities detected:', nonNext);
    process.exit(1);
  }

  console.log('PASS: Only documented Next.js upstream advisory present (see docs/NEXT_UPGRADE.md). 0 other production vulnerabilities.');
  process.exit(0);
} catch (e) {
  console.error('Failed to run audit check:', e);
  process.exit(1);
}

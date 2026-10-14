import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Platform Screenshot Automation (npm run screenshots)', () => {
  const rootDir = process.cwd();
  const packageJsonPath = path.join(rootDir, 'package.json');
  const screenshotScriptPath = path.join(rootDir, 'scripts', 'take-screenshots.mjs');

  it('package.json has screenshots script defined', () => {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    expect(pkg.scripts.screenshots).toBe('node scripts/take-screenshots.mjs');
  });

  it('scripts/take-screenshots.mjs contains all required platform routes', () => {
    expect(fs.existsSync(screenshotScriptPath)).toBe(true);
    const scriptContent = fs.readFileSync(screenshotScriptPath, 'utf8');

    // Required routes for platform panel
    expect(scriptContent).toContain('/platform-admin');
    expect(scriptContent).toContain('/platform-admin/centers');
    expect(scriptContent).toContain('/platform-admin/plans');
    expect(scriptContent).toContain('/platform-admin/subscriptions');
    expect(scriptContent).toContain('/platform-admin/support');
    expect(scriptContent).toContain('/platform-admin/audit');

    // Both desktop and mobile viewports
    expect(scriptContent).toMatch(/375/);
    expect(scriptContent).toMatch(/1280/);
  });
});

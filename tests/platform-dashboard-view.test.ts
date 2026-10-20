import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Platform Owner Dashboard (e-darischi light theme)', () => {
  const rootDir = process.cwd();
  const dashboardPath = path.join(rootDir, 'src', 'app', 'platform-admin', 'page.tsx');
  const legacyPlatformPagePath = path.join(rootDir, 'src', 'app', 'platform', 'page.tsx');

  it('platform-admin dashboard uses light theme and avoids dark slate classes', () => {
    expect(fs.existsSync(dashboardPath), 'platform-admin/page.tsx must exist').toBe(true);
    const content = fs.readFileSync(dashboardPath, 'utf8');

    // Must use light theme classes
    expect(content).toContain('bg-white');
    expect(content).toMatch(/border-slate-200|border-slate-100/);
    expect(content).toContain('text-slate-900');

    // Must NOT contain dark theme classes
    expect(content).not.toContain('bg-slate-950');
    expect(content).not.toContain('border-slate-800');
  });

  it('platform-admin dashboard contains real metrics, localized elements and quick actions', () => {
    const content = fs.readFileSync(dashboardPath, 'utf8');

    // Key metrics queried from DB
    expect(content).toContain('learningCenter.count');
    expect(content).toContain('centerMembership.count');
    expect(content).toContain('expiringSubscriptions');

    // 1-click impersonation
    expect(content).toContain('ImpersonateButton');

    // Uses localization
    expect(content).toContain('t(locale');
  });

  it('platform page redirects to platform-admin to unify routes and remove hardcoded English', () => {
    expect(fs.existsSync(legacyPlatformPagePath), 'platform/page.tsx must exist').toBe(true);
    const content = fs.readFileSync(legacyPlatformPagePath, 'utf8');

    // Must redirect to unified platform-admin
    expect(content).toMatch(/redirect\(["']\/platform-admin["']\)/);
  });
});

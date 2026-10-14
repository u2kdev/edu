import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Platform Centers Management (e-darischi light theme)', () => {
  const rootDir = process.cwd();
  const centersPagePath = path.join(rootDir, 'src', 'app', 'platform-admin', 'centers', 'page.tsx');
  const centerDetailsPagePath = path.join(rootDir, 'src', 'app', 'platform-admin', 'centers', '[id]', 'page.tsx');
  const legacyTenantsPagePath = path.join(rootDir, 'src', 'app', 'platform', 'tenants', 'page.tsx');
  const legacyTenantDetailsPagePath = path.join(rootDir, 'src', 'app', 'platform', 'tenants', '[id]', 'page.tsx');

  it('platform-admin centers list page exists with light theme and search/filter features', () => {
    expect(fs.existsSync(centersPagePath), 'platform-admin/centers/page.tsx must exist').toBe(true);
    const content = fs.readFileSync(centersPagePath, 'utf8');

    // Light theme classes
    expect(content).toContain('bg-white');
    expect(content).toMatch(/border-slate-200|border-slate-100/);
    expect(content).toContain('text-slate-900');

    // Features
    expect(content).toMatch(/search|q/i);
    expect(content).toMatch(/ACTIVE|TRIAL|FROZEN|BLOCKED/);
    expect(content).toContain('ImpersonateButton');
  });

  it('platform-admin center card page exists with light theme, status actions and audit log', () => {
    expect(fs.existsSync(centerDetailsPagePath), 'platform-admin/centers/[id]/page.tsx must exist').toBe(true);
    const content = fs.readFileSync(centerDetailsPagePath, 'utf8');

    // Light theme classes
    expect(content).toContain('bg-white');
    expect(content).toMatch(/border-slate-200|border-slate-100/);

    // Card management features
    expect(content).toMatch(/suspend|status|pause|block/i);
    expect(content).toMatch(/director/i);
    expect(content).toMatch(/auditLogs|audit/i);
  });

  it('legacy /platform/tenants routes redirect to /platform-admin/centers', () => {
    expect(fs.existsSync(legacyTenantsPagePath)).toBe(true);
    const tenantsContent = fs.readFileSync(legacyTenantsPagePath, 'utf8');
    expect(tenantsContent).toMatch(/redirect\(["']\/platform-admin\/centers["']\)/);

    expect(fs.existsSync(legacyTenantDetailsPagePath)).toBe(true);
    const tenantDetailsContent = fs.readFileSync(legacyTenantDetailsPagePath, 'utf8');
    expect(tenantDetailsContent).toMatch(/redirect\(/);
  });
});

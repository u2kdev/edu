import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Platform Support & Audit Views (e-darischi light theme)', () => {
  const rootDir = process.cwd();
  const supportPagePath = path.join(rootDir, 'src', 'app', 'platform-admin', 'support', 'page.tsx');
  const auditPagePath = path.join(rootDir, 'src', 'app', 'platform-admin', 'audit', 'page.tsx');
  const legacySupportPagePath = path.join(rootDir, 'src', 'app', 'platform', 'support', 'page.tsx');

  it('platform-admin support page exists with light theme and ticket management features', () => {
    expect(fs.existsSync(supportPagePath), 'platform-admin/support/page.tsx must exist').toBe(true);
    const content = fs.readFileSync(supportPagePath, 'utf8');

    // Light theme classes
    expect(content).toContain('bg-white');
    expect(content).toMatch(/border-slate-200|border-slate-100/);
    expect(content).toContain('text-slate-900');

    // Ticket features
    expect(content).toMatch(/OPEN|IN_PROGRESS|RESOLVED|CLOSED/);
    expect(content).toMatch(/tickets|обращен/i);
  });

  it('platform-admin audit page exists with light theme and SUPERADMIN audit log table', () => {
    expect(fs.existsSync(auditPagePath), 'platform-admin/audit/page.tsx must exist').toBe(true);
    const content = fs.readFileSync(auditPagePath, 'utf8');

    // Light theme classes
    expect(content).toContain('bg-white');
    expect(content).toMatch(/border-slate-200|border-slate-100/);

    // Queries audit log and checks SUPERADMIN role
    expect(content).toMatch(/auditLog\.findMany|audit/);
    expect(content).toMatch(/SUPERADMIN/);
  });

  it('legacy platform support page redirects to /platform-admin/support', () => {
    expect(fs.existsSync(legacySupportPagePath), 'legacy platform/support/page.tsx must exist').toBe(true);
    const content = fs.readFileSync(legacySupportPagePath, 'utf8');
    expect(content).toMatch(/redirect\(["']\/platform-admin\/support["']\)/);
  });
});

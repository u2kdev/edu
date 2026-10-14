import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Platform Sidebar & Layout (e-darischi light theme)', () => {
  const rootDir = process.cwd();
  const sidebarPath = path.join(rootDir, 'src', 'components', 'platform', 'PlatformSidebar.tsx');
  const platformAdminLayoutPath = path.join(rootDir, 'src', 'app', 'platform-admin', 'layout.tsx');

  it('PlatformSidebar component exists and contains e-darischi brand and required navigation items', () => {
    expect(fs.existsSync(sidebarPath), 'PlatformSidebar.tsx must exist').toBe(true);
    const content = fs.readFileSync(sidebarPath, 'utf8');

    // Brand check
    expect(content).toContain('e-darischi');

    // Required routes
    expect(content).toContain('/platform-admin');
    expect(content).toContain('/platform-admin/centers');
    expect(content).toContain('/platform-admin/plans');
    expect(content).toContain('/platform-admin/subscriptions');
    expect(content).toContain('/platform-admin/support');
    expect(content).toContain('/platform-admin/audit');

    // Mobile drawer accessibility & touch target
    expect(content).toMatch(/aria-label/i);
    expect(content).toMatch(/mobile|drawer|isOpen|menu/i);
  });

  it('platform-admin layout uses light theme background and renders PlatformSidebar', () => {
    expect(fs.existsSync(platformAdminLayoutPath)).toBe(true);
    const content = fs.readFileSync(platformAdminLayoutPath, 'utf8');

    // Light background
    expect(content).toMatch(/bg-slate-50|bg-slate-100|bg-white/);
    expect(content).toContain('PlatformSidebar');
  });
});

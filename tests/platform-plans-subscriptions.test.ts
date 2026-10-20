import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Platform Plans & Subscriptions Views (e-darischi light theme)', () => {
  const rootDir = process.cwd();
  const plansPagePath = path.join(rootDir, 'src', 'app', 'platform-admin', 'plans', 'page.tsx');
  const subscriptionsPagePath = path.join(rootDir, 'src', 'app', 'platform-admin', 'subscriptions', 'page.tsx');
  const subscriptionsApiPath = path.join(rootDir, 'src', 'app', 'api', 'platform', 'subscriptions', 'route.ts');
  const legacySubscriptionsPagePath = path.join(rootDir, 'src', 'app', 'platform', 'subscriptions', 'page.tsx');

  it('platform-admin plans page exists with light theme, plan creation and limits', () => {
    expect(fs.existsSync(plansPagePath), 'platform-admin/plans/page.tsx must exist').toBe(true);
    const content = fs.readFileSync(plansPagePath, 'utf8');

    // Light theme classes
    expect(content).toContain('bg-white');
    expect(content).toMatch(/border-slate-200|border-slate-100/);
    expect(content).toContain('text-slate-900');

    // Features
    expect(content).toMatch(/maxStudents|maxTeachers|priceMonthly/);
    expect(content).toMatch(/plans|тариф/i);
  });

  it('platform-admin subscriptions page exists with light theme and center subscription tracking', () => {
    expect(fs.existsSync(subscriptionsPagePath), 'platform-admin/subscriptions/page.tsx must exist').toBe(true);
    const content = fs.readFileSync(subscriptionsPagePath, 'utf8');

    // Light theme classes
    expect(content).toContain('bg-white');
    expect(content).toMatch(/border-slate-200|border-slate-100/);

    // Subscription status & center details
    expect(content).toMatch(/TRIAL|ACTIVE|PAST_DUE|FROZEN/);
    expect(content).toMatch(/currentPeriodEndsAt|period/i);
  });

  it('platform subscriptions API endpoint exists and returns subscriptions with center & plan', () => {
    expect(fs.existsSync(subscriptionsApiPath), 'api/platform/subscriptions/route.ts must exist').toBe(true);
    const content = fs.readFileSync(subscriptionsApiPath, 'utf8');
    expect(content).toMatch(/requirePlatformOwner/);
    expect(content).toMatch(/db\.subscription\.findMany/);
  });

  it('legacy platform subscriptions page redirects to platform-admin/plans or subscriptions', () => {
    expect(fs.existsSync(legacySubscriptionsPagePath)).toBe(true);
    const content = fs.readFileSync(legacySubscriptionsPagePath, 'utf8');
    expect(content).toMatch(/redirect\(["']\/platform-admin\/(plans|subscriptions)["']\)/);
  });
});

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Production Deployment & Launch Documentation (LAUNCH-1 Item 7)', () => {
  const rootDir = process.cwd();
  const deployMdPath = path.join(rootDir, 'docs', 'DEPLOY.md');
  const checklistMdPath = path.join(rootDir, 'docs', 'LAUNCH_CHECKLIST.md');

  it('docs/DEPLOY.md exists and contains all required step-by-step production sections', () => {
    expect(fs.existsSync(deployMdPath), 'docs/DEPLOY.md must exist').toBe(true);
    const content = fs.readFileSync(deployMdPath, 'utf8');

    // Neon: pooler and direct
    expect(content).toContain('DATABASE_URL');
    expect(content).toContain('DIRECT_URL');
    expect(content).toMatch(/pooler/i);
    expect(content).toMatch(/direct/i);
    expect(content).toContain('prisma migrate deploy');

    // Vercel Pro
    expect(content).toMatch(/Vercel Pro/i);

    // Required production environment variables with descriptions
    const requiredEnvVars = [
      'DATABASE_URL',
      'DIRECT_URL',
      'JWT_SECRET',
      'APP_URL',
      'EMAIL_PROVIDER',
      'RESEND_API_KEY',
      'EMAIL_FROM',
      'TRUSTED_PROXY_HOPS',
      'CRON_SECRET',
    ];
    for (const envVar of requiredEnvVars) {
      expect(content).toContain(envVar);
    }
    expect(content).toContain('TRUSTED_PROXY_HOPS=1');

    // Domain
    expect(content).toMatch(/домен|domain/i);

    // Cron jobs
    expect(content).toContain('/api/cron/cleanup');
    expect(content).toContain('/api/cron/email-retry');
    expect(content).toContain('CRON_SECRET');

    // First launch & Platform owner
    expect(content).toContain('/setup');
    expect(content).toMatch(/setup:first-owner|first-owner\.ts/);

    // Rollback and Backup
    expect(content).toMatch(/откат|rollback/i);
    expect(content).toMatch(/бэкап|резервн|backup/i);
  });

  it('docs/LAUNCH_CHECKLIST.md exists and contains comprehensive pre-launch checklist', () => {
    expect(fs.existsSync(checklistMdPath), 'docs/LAUNCH_CHECKLIST.md must exist').toBe(true);
    const content = fs.readFileSync(checklistMdPath, 'utf8');

    // Checklist categories
    expect(content).toMatch(/База данных|Database/i);
    expect(content).toMatch(/Безопасность|Security/i);
    expect(content).toMatch(/Переменные окружения|Environment/i);
    expect(content).toMatch(/Почта|Email/i);
    expect(content).toMatch(/Cron/i);
    expect(content).toMatch(/Первый владелец|Superadmin|Owner/i);
    expect(content).toMatch(/Откат|Rollback/i);
    expect(content).toMatch(/Бэкап|Backup/i);

    // Security headers and cookies checks
    expect(content).toContain('HSTS');
    expect(content).toContain('CSP');
    expect(content).toContain('HttpOnly');
    expect(content).toContain('SameSite');
  });
});

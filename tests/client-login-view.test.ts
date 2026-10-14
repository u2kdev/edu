import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Client Login Page (e-darischi light theme & strict typography)', () => {
  const rootDir = process.cwd();
  const loginPagePath = path.join(rootDir, 'src', 'app', 'login', 'page.tsx');

  it('login page uses light theme and avoids dark slate classes', () => {
    expect(fs.existsSync(loginPagePath)).toBe(true);
    const content = fs.readFileSync(loginPagePath, 'utf8');

    // Light theme classes
    expect(content).toContain('bg-white');
    expect(content).toMatch(/border-slate-200|border-slate-100/);
    expect(content).toContain('text-slate-900');

    // Must NOT contain dark theme classes
    expect(content).not.toContain('bg-slate-950');
    expect(content).not.toContain('border-slate-800');
  });

  it('login page displays e-darischi brand, strict typography, and password visibility toggle', () => {
    const content = fs.readFileSync(loginPagePath, 'utf8');

    expect(content).toContain('e-darischi');
    expect(content).toMatch(/font-strict/);
    expect(content).toMatch(/showPassword|setShowPassword|Eye|EyeOff/);
    expect(content).toMatch(/particles-bg|mesh-gradient/);
  });

  it('login page has links to registration and password reset', () => {
    const content = fs.readFileSync(loginPagePath, 'utf8');

    expect(content).toContain('/register');
    expect(content).toContain('/forgot-password');
  });
});

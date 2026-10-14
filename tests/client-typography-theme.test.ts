import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Client-facing Strict Typography & Light Theme Foundation', () => {
  const rootDir = process.cwd();
  const rootLayoutPath = path.join(rootDir, 'src', 'app', 'layout.tsx');
  const globalsCssPath = path.join(rootDir, 'src', 'app', 'globals.css');
  const themeProviderPath = path.join(rootDir, 'src', 'components', 'landing', 'ThemeProvider.tsx');

  it('root layout defaults to light theme and removes dark class from html', () => {
    expect(fs.existsSync(rootLayoutPath)).toBe(true);
    const content = fs.readFileSync(rootLayoutPath, 'utf8');

    // Must NOT force dark mode on html
    expect(content).not.toMatch(/<html[^>]*className=["'][^"']*dark/);

    // Body must use light theme colors
    expect(content).toMatch(/bg-slate-50|bg-white/);
    expect(content).toMatch(/text-slate-900|text-slate-800/);
  });

  it('globals.css provides strict typography settings and mesh gradient utilities', () => {
    expect(fs.existsSync(globalsCssPath)).toBe(true);
    const content = fs.readFileSync(globalsCssPath, 'utf8');

    // Strict typography font features
    expect(content).toMatch(/font-feature-settings|font-strict|tracking-tight/);

    // Mesh gradient & background particles utilities
    expect(content).toMatch(/mesh-gradient|particles/);
  });

  it('landing ThemeProvider defaults to light theme', () => {
    expect(fs.existsSync(themeProviderPath)).toBe(true);
    const content = fs.readFileSync(themeProviderPath, 'utf8');

    // Must default to light theme
    expect(content).toMatch(/useState<Theme>\(["']light["']\)/);
  });
});

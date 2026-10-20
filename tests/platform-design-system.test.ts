import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Design System & Localization Foundation (e-darischi light theme)', () => {
  const rootDir = process.cwd();

  it('ru.json and uz-Latn.json define e-darischi brand and platform admin dictionary keys', () => {
    const ruPath = path.join(rootDir, 'src', 'i18n', 'locales', 'ru.json');
    const uzPath = path.join(rootDir, 'src', 'i18n', 'locales', 'uz-Latn.json');

    expect(fs.existsSync(ruPath)).toBe(true);
    expect(fs.existsSync(uzPath)).toBe(true);

    const ru = JSON.parse(fs.readFileSync(ruPath, 'utf8'));
    const uz = JSON.parse(fs.readFileSync(uzPath, 'utf8'));

    // Brand name must be e-darischi
    expect(ru.common?.brandName).toBe('e-darischi');
    expect(uz.common?.brandName).toBe('e-darischi');

    // Platform navigation keys
    expect(ru.platform?.analytics).toBeDefined();
    expect(ru.platform?.centerManagement).toBeDefined();
    expect(ru.platform?.plans).toBeDefined();
    expect(ru.platform?.subscriptions).toBeDefined();
    expect(ru.platform?.support).toBeDefined();
    expect(ru.platform?.auditLog).toBeDefined();
    expect(ru.platform?.impersonate).toBeDefined();

    expect(uz.platform?.analytics).toBeDefined();
    expect(uz.platform?.centerManagement).toBeDefined();
    expect(uz.platform?.plans).toBeDefined();
    expect(uz.platform?.subscriptions).toBeDefined();
    expect(uz.platform?.support).toBeDefined();
    expect(uz.platform?.auditLog).toBeDefined();
    expect(uz.platform?.impersonate).toBeDefined();
  });

  it('src/app/globals.css has light theme glass-panel and button active states', () => {
    const cssPath = path.join(rootDir, 'src', 'app', 'globals.css');
    expect(fs.existsSync(cssPath)).toBe(true);
    const content = fs.readFileSync(cssPath, 'utf8');

    // Light-mode glass panel with white background
    expect(content).toContain('.glass-panel-light');
    // Button active scale for tactile press feedback
    expect(content).toContain('scale(0.97)');
  });
});

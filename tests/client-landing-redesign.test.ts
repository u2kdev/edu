import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Landing Page Professional-Grade Redesign (Apple & Emil Kowalski Design Guidelines)", () => {
  const landingViewPath = path.join(process.cwd(), "src/components/landing/LandingView.tsx");
  const heroPath = path.join(process.cwd(), "src/components/landing/Hero.tsx");
  const headerPath = path.join(process.cwd(), "src/components/landing/Header.tsx");
  const featuresPath = path.join(process.cwd(), "src/components/landing/Features.tsx");
  const appsPath = path.join(process.cwd(), "src/components/landing/AppsSection.tsx");
  const pricingPath = path.join(process.cwd(), "src/components/landing/Pricing.tsx");
  const stepsPath = path.join(process.cwd(), "src/components/landing/Steps.tsx");
  const faqPath = path.join(process.cwd(), "src/components/landing/FAQ.tsx");
  const ctaPath = path.join(process.cwd(), "src/components/landing/CTA.tsx");
  const footerPath = path.join(process.cwd(), "src/components/landing/Footer.tsx");

  it("enforces pure light theme across all landing sections without dark: overrides", () => {
    const files = [landingViewPath, heroPath, headerPath, featuresPath, appsPath, pricingPath, stepsPath, faqPath, ctaPath, footerPath];
    for (const filePath of files) {
      const content = fs.readFileSync(filePath, "utf-8");
      // All sections must not use dark mode classes
      expect(content).not.toMatch(/dark:/);
      // All sections must declare strict font
      expect(content).toContain("font-strict");
    }
  });

  it("header and footer consistently use e-darischi brand name", () => {
    const headerContent = fs.readFileSync(headerPath, "utf-8");
    const footerContent = fs.readFileSync(footerPath, "utf-8");
    expect(headerContent).toContain("e-darischi");
    expect(footerContent).toContain("e-darischi");
    expect(headerContent).not.toContain("e-darschi");
    expect(footerContent).not.toContain("e-darschi");
  });

  it("hero keeps a single calm product window: one photo, no floating widgets", () => {
    const heroContent = fs.readFileSync(heroPath, "utf-8");
    // High-resolution collaborative education image
    expect(heroContent).toMatch(/images\.unsplash\.com\/photo-/);
    // One image only — floating metric cards were removed for clarity.
    expect((heroContent.match(/<img/g) || []).length).toBe(1);
    // Trust architecture stays as a single quiet line.
    expect(heroContent).toContain("trust");
  });

  it("steps and FAQ sections use theme-aware card surfaces", () => {
    const stepsContent = fs.readFileSync(stepsPath, "utf-8");
    const faqContent = fs.readFileSync(faqPath, "utf-8");
    // Surfaces come from the public token layer, so the same markup renders
    // correctly in both the light and the dark theme.
    expect(stepsContent).toContain("bg-[color:var(--surface)]");
    expect(faqContent).toContain("bg-[color:var(--surface)]");
    expect(stepsContent).not.toContain("#13224D");
    expect(faqContent).not.toContain("#13224D");
  });
});

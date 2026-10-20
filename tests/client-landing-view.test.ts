import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Landing Page Modern Light UI with Strict Font, Photos & Animations", () => {
  const landingViewPath = path.join(process.cwd(), "src/components/landing/LandingView.tsx");
  const heroPath = path.join(process.cwd(), "src/components/landing/Hero.tsx");
  const appsSectionPath = path.join(process.cwd(), "src/components/landing/AppsSection.tsx");
  const featuresPath = path.join(process.cwd(), "src/components/landing/Features.tsx");

  it("LandingView uses strict font, particles background, and mesh gradients", () => {
    const content = fs.readFileSync(landingViewPath, "utf-8");
    expect(content).toContain("font-strict");
    expect(content).toMatch(/particles-bg|mesh-gradient-light/);
  });

  it("Hero section includes photo elements, UI preview cards, and mesh gradients", () => {
    const heroContent = fs.readFileSync(heroPath, "utf-8");
    // Strict typography
    expect(heroContent).toContain("font-strict");
    // Primary educational photo element and avatar photos
    expect(heroContent).toContain("photo-1522202176988");
    expect(heroContent).toContain("photo-1534528741775");
    // Mesh gradient and interactive preview
    expect(heroContent).toMatch(/gradient|mesh/i);
    expect(heroContent).toContain("motion.");
  });

  it("AppsSection includes photographic avatars, strict typography, and interactive role tabs", () => {
    const appsContent = fs.readFileSync(appsSectionPath, "utf-8");
    expect(appsContent).toContain("font-strict");
    expect(appsContent).toMatch(/<img|avatar/i);
    expect(appsContent).toContain("motion.");
  });

  it("Features section uses theme-aware surfaces, strict font, and motion transitions", () => {
    const featuresContent = fs.readFileSync(featuresPath, "utf-8");
    expect(featuresContent).toContain("font-strict");
    expect(featuresContent).toContain("motion.");
    expect(featuresContent).toContain("bg-[color:var(--surface)]");
  });
});

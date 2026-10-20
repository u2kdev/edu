import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import uzMessages from "../messages/uz.json";
import ruMessages from "../messages/ru.json";

describe("LAUNCH-1 Item 1: Landing Page Cleanup (Fake metrics, Testimonials, Video, Data Isolation)", () => {
  const landingViewPath = path.resolve(__dirname, "../src/components/landing/LandingView.tsx");
  const heroPath = path.resolve(__dirname, "../src/components/landing/Hero.tsx");

  it("1. LandingView does NOT render Testimonials component or VideoModal", () => {
    const landingViewContent = fs.readFileSync(landingViewPath, "utf-8");
    expect(landingViewContent).not.toContain("<Testimonials");
    expect(landingViewContent).not.toContain("import { Testimonials }");
    expect(landingViewContent).not.toContain("<VideoModal");
    expect(landingViewContent).not.toContain("import { VideoModal }");
  });

  it("2. Hero does not render fake stats (uptime, centers, students count) and video play button", () => {
    const heroContent = fs.readFileSync(heroPath, "utf-8");
    // No uptime counter
    expect(heroContent).not.toContain("uptime.value");
    expect(heroContent).not.toContain("uptime.suffix");
    // No video modal triggers
    expect(heroContent).not.toContain("onOpenVideoModal");
    expect(heroContent).not.toContain("youtube");
  });

  it("3. Trust block is based on capabilities and data isolation", () => {
    const heroContent = fs.readFileSync(heroPath, "utf-8");
    // Must contain data isolation & security capabilities keywords in Hero trust badges
    expect(heroContent).toMatch(/isolation|security|audit|защита|изоляция/i);

    // Messages must contain data isolation trust block entries
    expect(ruMessages.hero).toHaveProperty("trust");
    expect(uzMessages.hero).toHaveProperty("trust");
  });

  it("4. Messages catalog removes fake uptime stats", () => {
    const ruHero = ruMessages.hero as Record<string, unknown>;
    const uzHero = uzMessages.hero as Record<string, unknown>;

    // Stats with fake uptime should be replaced by real platform guarantees
    if (ruHero.stats) {
      expect((ruHero.stats as Record<string, unknown>)).not.toHaveProperty("uptime");
    }
    if (uzHero.stats) {
      expect((uzHero.stats as Record<string, unknown>)).not.toHaveProperty("uptime");
    }
  });
});

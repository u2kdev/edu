import { describe, it, expect } from "vitest";
import uzMessages from "../messages/uz.json";
import ruMessages from "../messages/ru.json";
import { formatPrice, getLandingMessages } from "../src/lib/landing-i18n";
import { POST as handleLeadPost } from "../src/app/api/public/leads/route";
import { NextRequest } from "next/server";

describe("e-darschi Landing Page Specification & Integrity Tests", () => {
  it("TEST 1: Uzbek and Russian message catalogs have complete structural parity", () => {
    const requiredSections = [
      "meta",
      "header",
      "hero",
      "whyUs",
      "apps",
      "pricing",
      "steps",
      "testimonials",
      "faq",
      "cta",
      "footer",
    ];

    for (const section of requiredSections) {
      expect(uzMessages).toHaveProperty(section);
      expect(ruMessages).toHaveProperty(section);
    }

    // Check whyUs items count (must have 10 features)
    expect(uzMessages.whyUs.items.length).toBe(10);
    expect(ruMessages.whyUs.items.length).toBe(10);

    // Check FAQ count (must have 6 items)
    expect(uzMessages.faq.items.length).toBe(6);
    expect(ruMessages.faq.items.length).toBe(6);

    // Check Steps count (must have 3 items)
    expect(uzMessages.steps.items.length).toBe(3);
    expect(ruMessages.steps.items.length).toBe(3);

    // Check Testimonials count (must have 3 items)
    expect(uzMessages.testimonials.items.length).toBe(3);
    expect(ruMessages.testimonials.items.length).toBe(3);
  });

  it("TEST 2: Rental pricing plans match specified tiers (Starter 400k, Business 900k, Premium 1.5M)", () => {
    const uzPlans = uzMessages.pricing.plans;
    const ruPlans = ruMessages.pricing.plans;

    expect(uzPlans.length).toBe(3);
    expect(ruPlans.length).toBe(3);

    const starter = uzPlans.find((p) => p.id === "starter");
    const business = uzPlans.find((p) => p.id === "business");
    const premium = uzPlans.find((p) => p.id === "premium");

    expect(starter?.price).toBe(400000);
    expect(business?.price).toBe(900000);
    expect(business?.isPopular).toBe(true);
    expect(premium?.price).toBe(1500000);
  });

  it("TEST 3: formatPrice formats currency correctly with Intl.NumberFormat for uz and ru", () => {
    const uzFormatted = formatPrice(900000, "uz");
    const ruFormatted = formatPrice(900000, "ru");

    expect(uzFormatted).toContain("900");
    expect(uzFormatted).toContain("so'm");

    expect(ruFormatted).toContain("900");
    expect(ruFormatted).toContain("сум");
  });

  it("TEST 4: getLandingMessages defaults to Uzbek catalog and supports Russian", () => {
    const uzCatalog = getLandingMessages("uz");
    const ruCatalog = getLandingMessages("ru");

    expect(uzCatalog.header.brandName).toBe("e-darschi");
    expect(uzCatalog.header.nav.pricing).toBe("Tariflar");

    expect(ruCatalog.header.nav.pricing).toBe("Тарифы");
  });

  it("TEST 5: Public lead capture API validates required fields and accepts valid submissions", async () => {
    // Valid lead
    const validReq = new NextRequest("http://localhost/api/public/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: "Azamat Zokirov",
        phone: "+998901234567",
        organizationName: "Smart Academy",
        locale: "uz",
        plan: "business",
      }),
    });

    const resValid = await handleLeadPost(validReq);
    expect(resValid.status).toBe(200);
    const validJson = await resValid.json();
    expect(validJson.success).toBe(true);

    // Invalid lead (short phone and empty org)
    const invalidReq = new NextRequest("http://localhost/api/public/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: "A",
        phone: "123",
        organizationName: "",
      }),
    });

    const resInvalid = await handleLeadPost(invalidReq);
    expect(resInvalid.status).toBe(400);
    const invalidJson = await resInvalid.json();
    expect(invalidJson).toHaveProperty("error");
  });
});

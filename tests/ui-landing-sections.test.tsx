// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { Hero } from "@/components/landing/Hero";
import { Features } from "@/components/landing/Features";
import { Steps } from "@/components/landing/Steps";
import { Pricing } from "@/components/landing/Pricing";
import { FAQ } from "@/components/landing/FAQ";
import { Footer } from "@/components/landing/Footer";
import { CTA } from "@/components/landing/CTA";
import { SectionWrapper } from "@/components/landing/SectionWrapper";
import { AnimatedButton } from "@/components/landing/AnimatedButton";
import { AppsSection } from "@/components/landing/AppsSection";
import { getLandingMessages, formatPrice } from "@/lib/landing-i18n";
import { installFetchMock, jsonResponse, sentBody } from "./helpers/ui";

// `next/link` renders a real anchor; jsdom has no Next App Router context, so the
// default navigation is swallowed while the provided onClick still runs.
vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    __esModule: true,
    default: (props: unknown) => {
      const { href, children, onClick, ...rest } = props as {
        href?: unknown;
        children?: import("react").ReactNode;
        onClick?: (e: { preventDefault: () => void }) => void;
      } & Record<string, unknown>;
      return React.createElement(
        "a",
        {
          href: typeof href === "string" ? href : "",
          onClick: (e: { preventDefault: () => void }) => {
            e.preventDefault();
            onClick?.(e);
          },
          ...rest,
        },
        children,
      );
    },
  };
});

// framer-motion's `whileInView` mounts a raw `IntersectionObserver`; jsdom does not
// implement one, so provide an inert stub that keeps the DOM content rendered.
class InertIntersectionObserver {
  root = null;
  rootMargin = "";
  thresholds: number[] = [];
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
vi.stubGlobal("IntersectionObserver", InertIntersectionObserver);

// Expected copy is derived from the same dictionary the components read.
const ru = getLandingMessages("ru");
const uz = getLandingMessages("uz");

// `Intl` formats money with a non-breaking space; `getByText` collapses whitespace
// on the DOM side only, so normalize the expected string the same way.
const norm = (value: string) => value.replace(/\s+/g, " ");

// Validation copy lives inline in the components (not in the i18n dictionaries),
// so mirror it per locale rather than hardcoding a single language.
const ctaErrors = {
  ru: {
    name: "Введите корректное имя",
    phone: "Введите полный номер телефона (+998 XX XX XX XX)",
    organization: "Укажите название учебного центра",
  },
  uz: {
    name: "Ismingizni to'liq kiriting",
    phone: "Telefon raqamingizni to'liq kiriting (+998 XX XX XX XX)",
    organization: "O'quv markazi yoki maktab nomini kiriting",
  },
} as const;

beforeEach(() => {
  vi.spyOn(window, "alert").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Hero", () => {
  it("renders the ru hero copy, trust architecture and fires the lead CTA", () => {
    const onOpenLeadModal = vi.fn();
    render(<Hero locale="ru" onOpenLeadModal={onOpenLeadModal} />);

    expect(screen.getByText(ru.hero.badge)).toBeTruthy();
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.textContent).toContain(ru.hero.title);
    expect(h1.textContent).toContain(ru.hero.titleHighlight);
    expect(screen.getByText(ru.hero.subtitle)).toBeTruthy();

    expect(screen.getByText(ru.hero.trust.badge)).toBeTruthy();
    expect(screen.getByText(ru.hero.trust.isolation.title)).toBeTruthy();
    expect(screen.getByText(ru.hero.trust.isolation.description)).toBeTruthy();
    expect(screen.getByText(ru.hero.trust.roles.title)).toBeTruthy();
    expect(screen.getByText(ru.hero.trust.roles.description)).toBeTruthy();
    expect(screen.getByText(ru.hero.trust.audit.title)).toBeTruthy();
    expect(screen.getByText(ru.hero.trust.audit.description)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: ru.hero.ctaStart }));
    expect(onOpenLeadModal).toHaveBeenCalledTimes(1);
  });

  it("renders the uz hero copy and keeps the secondary anchor", () => {
    const { container } = render(<Hero locale="uz" onOpenLeadModal={vi.fn()} />);

    expect(screen.getByText(uz.hero.badge)).toBeTruthy();
    expect(screen.getByText(uz.hero.subtitle)).toBeTruthy();
    expect(container.querySelector('a[href="#ilovalari"]')).toBeTruthy();
    expect(screen.getByRole("button", { name: uz.hero.ctaStart })).toBeTruthy();
  });

  it("renders the product preview photos and floating metric cards", () => {
    const { container } = render(<Hero locale="ru" onOpenLeadModal={vi.fn()} />);

    // one workspace photo + three avatar photos
    const images = container.querySelectorAll("img");
    expect(images.length).toBeGreaterThanOrEqual(4);
    expect(screen.getByText(/98\.4%/)).toBeTruthy();
    expect(screen.getByText("Payme & Click & Uzum")).toBeTruthy();
  });
});

describe("Features", () => {
  it("renders the ru header and every why-us item", () => {
    render(<Features locale="ru" />);

    expect(screen.getByText(ru.whyUs.badge)).toBeTruthy();
    const h2 = screen.getByRole("heading", { level: 2 });
    expect(h2.textContent).toContain(ru.whyUs.title);
    expect(h2.textContent).toContain(ru.whyUs.titleHighlight);
    expect(screen.getByText(ru.whyUs.subtitle)).toBeTruthy();

    for (const item of ru.whyUs.items) {
      expect(screen.getByText(item.title)).toBeTruthy();
      expect(screen.getByText(item.description)).toBeTruthy();
    }
  });

  it("renders the uz why-us items", () => {
    render(<Features locale="uz" />);

    expect(screen.getByText(uz.whyUs.badge)).toBeTruthy();
    for (const item of uz.whyUs.items) {
      expect(screen.getByText(item.title)).toBeTruthy();
    }
  });
});

describe("Steps", () => {
  it("renders the three ru steps and exposes the lead button only on the first", () => {
    const onOpenLeadModal = vi.fn();
    render(<Steps locale="ru" onOpenLeadModal={onOpenLeadModal} />);

    expect(screen.getByText(ru.steps.badge)).toBeTruthy();
    for (const step of ru.steps.items) {
      expect(screen.getByText(step.title)).toBeTruthy();
      expect(screen.getByText(step.description)).toBeTruthy();
      expect(screen.getByText(step.highlight)).toBeTruthy();
      expect(screen.getByText(`0${step.step}`)).toBeTruthy();
    }

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]);
    expect(onOpenLeadModal).toHaveBeenCalledTimes(1);
  });

  it("uses the localized label for the lead button", () => {
    const onOpenLeadModal = vi.fn();
    render(<Steps locale="uz" onOpenLeadModal={onOpenLeadModal} />);

    fireEvent.click(screen.getByText("Ariza"));
    expect(onOpenLeadModal).toHaveBeenCalledTimes(1);
  });
});

describe("Pricing", () => {
  it("renders every ru plan with its localized price and features", () => {
    render(<Pricing locale="ru" onSelectPlan={vi.fn()} />);

    expect(screen.getByText(ru.pricing.headerNote)).toBeTruthy();
    const h2 = screen.getByRole("heading", { level: 2 });
    expect(h2.textContent).toContain(ru.pricing.title);
    expect(h2.textContent).toContain(ru.pricing.titleHighlight);

    for (const plan of ru.pricing.plans) {
      expect(screen.getByText(plan.name)).toBeTruthy();
      expect(screen.getByText(plan.description)).toBeTruthy();
      expect(screen.getByText(norm(formatPrice(plan.price, "ru")))).toBeTruthy();
      for (const feature of plan.features) {
        expect(screen.getAllByText(feature).length).toBeGreaterThan(0);
      }
    }

    expect(screen.getAllByText(ru.pricing.tryFree)).toHaveLength(ru.pricing.plans.length);
    expect(screen.getByText(ru.pricing.popular)).toBeTruthy();
    expect(screen.getAllByText(`/ ${ru.pricing.perMonth}`)).toHaveLength(ru.pricing.plans.length);
  });

  it("emits the selected plan id when a plan CTA is clicked", () => {
    const onSelectPlan = vi.fn();
    render(<Pricing locale="ru" onSelectPlan={onSelectPlan} />);

    const buttons = screen.getAllByRole("button", { name: ru.pricing.tryFree });
    fireEvent.click(buttons[1]);
    fireEvent.click(buttons[2]);

    expect(onSelectPlan).toHaveBeenNthCalledWith(1, ru.pricing.plans[1].id);
    expect(onSelectPlan).toHaveBeenNthCalledWith(2, ru.pricing.plans[2].id);
  });

  it("renders uz prices through formatPrice", () => {
    render(<Pricing locale="uz" onSelectPlan={vi.fn()} />);

    for (const plan of uz.pricing.plans) {
      expect(screen.getByText(norm(formatPrice(plan.price, "uz")))).toBeTruthy();
    }
    expect(screen.getByText(uz.pricing.headerNote)).toBeTruthy();
  });
});

describe("FAQ", () => {
  it("renders every ru question and only the first answer by default", () => {
    render(<FAQ locale="ru" />);

    expect(screen.getByText(ru.faq.badge)).toBeTruthy();
    for (const item of ru.faq.items) {
      expect(screen.getByText(item.question)).toBeTruthy();
    }
    expect(screen.getByText(ru.faq.items[0].answer)).toBeTruthy();
    expect(screen.queryByText(ru.faq.items[1].answer)).toBeNull();

    const firstButton = screen.getByText(ru.faq.items[0].question).closest("button")!;
    expect(firstButton.getAttribute("aria-expanded")).toBe("true");
  });

  it("toggles the accordion and keeps a single answer open", async () => {
    render(<FAQ locale="ru" />);

    const secondQuestion = screen.getByText(ru.faq.items[1].question);
    fireEvent.click(secondQuestion);

    expect(screen.getByText(ru.faq.items[1].answer)).toBeTruthy();
    await waitFor(() => expect(screen.queryByText(ru.faq.items[0].answer)).toBeNull());
    expect(secondQuestion.closest("button")!.getAttribute("aria-expanded")).toBe("true");

    // clicking the same question again collapses it
    fireEvent.click(secondQuestion);
    await waitFor(() => expect(screen.queryByText(ru.faq.items[1].answer)).toBeNull());
  });

  it("renders the uz questions", () => {
    render(<FAQ locale="uz" />);
    expect(screen.getByText(uz.faq.badge)).toBeTruthy();
    for (const item of uz.faq.items) {
      expect(screen.getByText(item.question)).toBeTruthy();
    }
  });
});

describe("Footer", () => {
  it("renders the ru brand, navigation, stats and contact links", () => {
    const { container } = render(<Footer locale="ru" />);

    expect(screen.getByText(ru.footer.brandDescription)).toBeTruthy();
    expect(screen.getByText(ru.footer.sections.product)).toBeTruthy();
    expect(screen.getByText(ru.footer.sections.contacts)).toBeTruthy();

    expect(screen.getByText(ru.footer.links.features)).toBeTruthy();
    expect(screen.getByText(ru.footer.links.whyUs)).toBeTruthy();
    expect(screen.getByText(ru.footer.links.pricing)).toBeTruthy();
    expect(screen.getByText(ru.footer.links.apps)).toBeTruthy();
    expect(screen.getByText(ru.footer.links.faq)).toBeTruthy();

    expect(screen.getByText(ru.footer.aboutTitle)).toBeTruthy();
    expect(screen.getByText(ru.footer.aboutText)).toBeTruthy();
    for (const stat of ru.footer.stats) {
      expect(screen.getByText(stat.value)).toBeTruthy();
      expect(screen.getByText(stat.label)).toBeTruthy();
    }

    expect(screen.getByText(ru.footer.officeTitle)).toBeTruthy();
    expect(screen.getByText(ru.footer.officeHours)).toBeTruthy();
    expect(screen.getByText(ru.footer.mapLink)).toBeTruthy();
    expect(screen.getByTitle(ru.footer.mapLabel)).toBeTruthy();

    expect(container.querySelector(`a[href="mailto:${ru.footer.contacts.email}"]`)).toBeTruthy();
    expect(container.querySelector('a[href="https://t.me/edarschi_support"]')).toBeTruthy();
    expect(
      container.querySelector(`a[href="tel:${ru.footer.contacts.phone.replace(/\s+/g, "")}"]`),
    ).toBeTruthy();

    expect(screen.getByText(ru.footer.rights, { exact: false })).toBeTruthy();
    expect(screen.getByText(ru.footer.links.terms)).toBeTruthy();
    expect(screen.getByText(ru.footer.links.privacy)).toBeTruthy();
    expect(screen.getByRole("group", { name: "Tilni tanlash" })).toBeTruthy();
  });

  it("renders the uz office details and language switcher", () => {
    render(<Footer locale="uz" />);

    expect(screen.getByText(uz.footer.brandDescription)).toBeTruthy();
    expect(screen.getByText(uz.footer.officeHours)).toBeTruthy();
    expect(screen.getByText(uz.footer.mapLink)).toBeTruthy();
    expect(screen.getByTitle(uz.footer.mapLabel)).toBeTruthy();
  });
});

describe("CTA", () => {
  it("renders the ru form, labels and success copy on submit", async () => {
    const { calls } = installFetchMock([
      { match: "/api/public/leads", method: "POST", reply: jsonResponse({ ok: true }) },
    ]);
    const { container } = render(<CTA locale="ru" />);

    expect(screen.getByText(ru.cta.badge)).toBeTruthy();
    expect(screen.getByText(ru.cta.title)).toBeTruthy();
    expect(screen.getByText(ru.cta.form.nameLabel)).toBeTruthy();
    expect(screen.getByText(ru.cta.form.phoneLabel)).toBeTruthy();
    expect(screen.getByText(ru.cta.form.orgLabel)).toBeTruthy();
    expect(screen.getByText(ru.cta.form.guarantee)).toBeTruthy();

    const inputs = container.querySelectorAll("input");
    fireEvent.change(inputs[0], { target: { value: "Азамат Зокиров" } });
    fireEvent.change(inputs[1], { target: { value: "+998 90 123 45 67" } });
    fireEvent.change(inputs[2], { target: { value: "Smart Education" } });
    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => expect(screen.getByText(ru.cta.form.successTitle)).toBeTruthy());
    expect(calls).toHaveLength(1);
    expect(sentBody(calls[0])).toEqual({
      fullName: "Азамат Зокиров",
      phone: "+998 90 123 45 67",
      organizationName: "Smart Education",
      notes: "",
      locale: "ru",
      source: "landing-bottom-cta",
    });

    // "Новая заявка" restores the empty form
    fireEvent.click(screen.getByText("Новая заявка"));
    expect(container.querySelector("form")).toBeTruthy();
  });

  it("blocks submission for an empty/short form and surfaces the validation copy", () => {
    const { calls } = installFetchMock([]);
    const { container } = render(<CTA locale="ru" />);

    fireEvent.submit(container.querySelector("form")!);
    expect(calls).toHaveLength(0);
    expect(screen.getByText(ctaErrors.ru.name)).toBeTruthy();

    // a too-short phone is rejected even when the name is valid
    const inputs = container.querySelectorAll("input");
    fireEvent.change(inputs[0], { target: { value: "Азамат Зокиров" } });
    fireEvent.change(inputs[1], { target: { value: "+998" } });
    fireEvent.submit(container.querySelector("form")!);
    expect(calls).toHaveLength(0);
    expect(screen.getByText(ctaErrors.ru.phone)).toBeTruthy();

    // a missing organization is rejected last
    fireEvent.change(inputs[1], { target: { value: "+998 90 123 45 67" } });
    fireEvent.submit(container.querySelector("form")!);
    expect(calls).toHaveLength(0);
    expect(screen.getByText(ctaErrors.ru.organization)).toBeTruthy();
  });

  it("keeps the phone prefix pinned to +998", () => {
    const { container } = render(<CTA locale="uz" />);
    const phoneInput = container.querySelector('input[type="tel"]') as HTMLInputElement;

    fireEvent.change(phoneInput, { target: { value: "12345" } });
    expect(phoneInput.value).toBe("+998");
  });

  it("surfaces a localized error and never claims success for a rejected (400) lead", async () => {
    installFetchMock([
      { match: "/api/public/leads", method: "POST", reply: jsonResponse({ error: "nope" }, 400) },
    ]);
    const { container } = render(<CTA locale="uz" />);

    const inputs = container.querySelectorAll("input");
    fireEvent.change(inputs[0], { target: { value: "Azamat Zokirov" } });
    fireEvent.change(inputs[1], { target: { value: "+998901234567" } });
    fireEvent.change(inputs[2], { target: { value: "Smart Education" } });
    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => expect(screen.getByText(uz.cta.form.errorMessage)).toBeTruthy());
    expect(screen.queryByText(uz.cta.form.successTitle)).toBeNull();
  });

  it("surfaces the error copy when the request fails at the network level", async () => {
    installFetchMock([]); // any request throws -> the catch branch reports the failure
    const { container } = render(<CTA locale="ru" />);

    const inputs = container.querySelectorAll("input");
    fireEvent.change(inputs[0], { target: { value: "Азамат Зокиров" } });
    fireEvent.change(inputs[1], { target: { value: "+998901234567" } });
    fireEvent.change(inputs[2], { target: { value: "Smart Education" } });
    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => expect(screen.getByText(ru.cta.form.errorMessage)).toBeTruthy());
    expect(screen.queryByText(ru.cta.form.successTitle)).toBeNull();
  });
});

describe("SectionWrapper", () => {
  it("renders a section with the id and merged class names", () => {
    const { container } = render(
      <SectionWrapper id="demo-section" className="bg-white">
        <p>inside</p>
      </SectionWrapper>,
    );

    const section = container.querySelector("section")!;
    expect(section.id).toBe("demo-section");
    expect(section.className).toContain("relative");
    expect(section.className).toContain("scroll-mt-24");
    expect(section.className).toContain("bg-white");
    expect(screen.getByText("inside")).toBeTruthy();
  });

  it("renders without an id when none is provided", () => {
    const { container } = render(
      <SectionWrapper>
        <span>child</span>
      </SectionWrapper>,
    );
    expect(container.querySelector("section")!.id).toBe("");
    expect(screen.getByText("child")).toBeTruthy();
  });
});

describe("AnimatedButton", () => {
  it("renders a button, sorts out the type and fires onClick", () => {
    const onClick = vi.fn();
    render(<AnimatedButton onClick={onClick}>Отправить</AnimatedButton>);

    const button = screen.getByRole("button", { name: "Отправить" });
    expect(button.getAttribute("type")).toBe("button");
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("applies size, variant and glow classes and forwards the submit type", () => {
    const { container } = render(
      <AnimatedButton variant="gradient" size="lg" glow type="submit">
        Go
      </AnimatedButton>,
    );
    const button = container.querySelector("button")!;
    expect(button.getAttribute("type")).toBe("submit");
    expect(button.className).toContain("rounded-2xl");
    expect(button.className).toContain("shadow-glow-blue");
  });

  it("renders an anchor carrying the href when one is supplied", () => {
    const onClick = vi.fn();
    const { container } = render(
      <AnimatedButton href="/login" onClick={onClick}>
        Войти
      </AnimatedButton>,
    );

    const anchor = container.querySelector("a")!;
    expect(anchor.getAttribute("href")).toBe("/login");
    fireEvent.click(anchor);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("disables the button and ignores clicks when disabled", () => {
    const onClick = vi.fn();
    const { container } = render(
      <AnimatedButton onClick={onClick} disabled>
        Off
      </AnimatedButton>,
    );

    const button = container.querySelector("button") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.className).toContain("opacity-60");
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("AppsSection", () => {
  it("renders the ru showcase with the student tab active by default", () => {
    render(<AppsSection locale="ru" />);

    expect(screen.getByText(ru.apps.badge)).toBeTruthy();
    const h2 = screen.getByRole("heading", { level: 2 });
    expect(h2.textContent).toContain(ru.apps.title);
    expect(h2.textContent).toContain(ru.apps.titleHighlight);

    for (const label of Object.values(ru.apps.tabs)) {
      expect(screen.getByText(label)).toBeTruthy();
    }

    for (const feature of ru.apps.studentFeatures) {
      expect(screen.getByText(feature)).toBeTruthy();
    }
    expect(screen.queryByText(ru.apps.teacherFeatures[0])).toBeNull();

    expect(screen.getByText(ru.apps.availableOn)).toBeTruthy();
    expect(screen.getByText(ru.apps.soon)).toBeTruthy();
    expect(screen.getByText(ru.apps.downloadPrompt)).toBeTruthy();
    expect(screen.getByRole("link", { name: ru.apps.appStoreLabel })).toBeTruthy();
    expect(screen.getByRole("link", { name: ru.apps.googlePlayLabel })).toBeTruthy();
    expect(screen.getByAltText("Азиза Каримова")).toBeTruthy();
  });

  it("switches between the teacher and parent role tabs", async () => {
    render(<AppsSection locale="ru" />);

    fireEvent.click(screen.getByText(ru.apps.tabs.teacher));
    await waitFor(() => expect(screen.getByText(ru.apps.teacherFeatures[0])).toBeTruthy());
    await waitFor(() => expect(screen.queryByText(ru.apps.studentFeatures[0])).toBeNull());
    expect(screen.getByAltText("Сардор Рахимов")).toBeTruthy();

    fireEvent.click(screen.getByText(ru.apps.tabs.parent));
    await waitFor(() => expect(screen.getByText(ru.apps.parentFeatures[0])).toBeTruthy());
    expect(screen.getByAltText("Олим Касымов")).toBeTruthy();
  });

  it("renders the uz tabs and features", () => {
    render(<AppsSection locale="uz" />);

    expect(screen.getByText(uz.apps.badge)).toBeTruthy();
    for (const label of Object.values(uz.apps.tabs)) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.getByText(uz.apps.studentFeatures[0])).toBeTruthy();
    expect(screen.getByText(uz.apps.soon)).toBeTruthy();
  });
});

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { LandingView } from "@/components/landing/LandingView";
import { Header } from "@/components/landing/Header";
import { LangSwitcher } from "@/components/landing/LangSwitcher";
import { LeadModal } from "@/components/landing/LeadModal";
import { getLandingMessages } from "@/lib/landing-i18n";
import { installFetchMock, jsonResponse, sentBody } from "./helpers/ui";

// jsdom has no Next App Router context; render anchors directly while keeping the
// component's onClick handlers (used by the language switcher).
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

// framer-motion mounts a raw IntersectionObserver for `whileInView`; jsdom lacks it.
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

const ru = getLandingMessages("ru");
const uz = getLandingMessages("uz");

// Inline copy that is not part of the i18n dictionaries, mirrored per locale.
const leadTitle = { ru: "Начать бесплатный период", uz: "Bepul sinovni boshlash" };
const leadErrors = {
  ru: {
    name: "Введите корректное имя",
    phone: "Введите полный номер телефона (+998 XX XX XX XX)",
    organization: "Укажите название организации",
  },
  uz: {
    name: "Ismingizni to'liq kiriting",
    phone: "Telefon raqamingizni to'liq kiriting (+998 XX XX XX XX)",
    organization: "Tashkilot nomini kiriting",
  },
} as const;

const fillLeadForm = (
  container: HTMLElement,
  values = { fullName: "Азамат Зокиров", phone: "+998 90 123 45 67", organization: "Smart Education" },
) => {
  const inputs = container.querySelectorAll("input");
  fireEvent.change(inputs[0], { target: { value: values.fullName } });
  fireEvent.change(inputs[1], { target: { value: values.phone } });
  fireEvent.change(inputs[2], { target: { value: values.organization } });
};

/** The labels the header actually renders (it deliberately omits the `steps` key). */
const headerNavKeys = ["features", "whyUs", "apps", "pricing", "faq", "contact"] as const;
const headerNavLabels = (messages: typeof ru) =>
  headerNavKeys.map((key) => messages.header.nav[key]);

beforeEach(() => {
  window.localStorage.clear();
  document.cookie = "edarschi_locale=; max-age=0; path=/";
});

afterEach(() => {
  Object.defineProperty(window, "scrollY", { value: 0, configurable: true, writable: true });
  cleanup();
  vi.restoreAllMocks();
});

describe("LangSwitcher", () => {
  it("renders both options, marks the active locale and points to the right hrefs", () => {
    render(<LangSwitcher currentLocale="ru" />);

    expect(screen.getByRole("group", { name: "Tilni tanlash" })).toBeTruthy();
    const uzLink = screen.getByText("UZ");
    const ruLink = screen.getByText("RU");
    expect(uzLink.getAttribute("href")).toBe("/");
    expect(ruLink.getAttribute("href")).toBe("/ru");
    expect(ruLink.getAttribute("aria-current")).toBe("page");
    expect(uzLink.getAttribute("aria-current")).toBeNull();
  });

  it("persists the picked language in localStorage and a cookie", () => {
    render(<LangSwitcher currentLocale="ru" />);

    fireEvent.click(screen.getByText("UZ"));
    expect(window.localStorage.getItem("edarschi-lang")).toBe("uz");
    expect(document.cookie).toContain("edarschi_locale=uz");

    fireEvent.click(screen.getByText("RU"));
    expect(window.localStorage.getItem("edarschi-lang")).toBe("ru");
    expect(document.cookie).toContain("edarschi_locale=ru");
  });

  it("forwards a custom class name and flips the active marker for uz", () => {
    const { container } = render(<LangSwitcher currentLocale="uz" className="mt-2" />);

    expect(container.querySelector('[role="group"]')!.className).toContain("mt-2");
    expect(screen.getByText("UZ").getAttribute("aria-current")).toBe("page");
    expect(screen.getByText("RU").getAttribute("aria-current")).toBeNull();
  });
});

describe("Header", () => {
  it("renders the ru brand, navigation, login link and fires the lead CTA", () => {
    const onOpenLeadModal = vi.fn();
    const { container } = render(<Header locale="ru" onOpenLeadModal={onOpenLeadModal} />);

    expect(container.textContent).toContain("e-darischi");
    expect(screen.getByText("Toshkent, O'zbekiston")).toBeTruthy();

    for (const label of headerNavLabels(ru)) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(container.querySelector('a[href="#imkoniyatlar"]')).toBeTruthy();
    expect(container.querySelector('a[href="#tariflar"]')).toBeTruthy();
    expect(container.querySelector('a[href="/login"]')).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: ru.header.startFree }));
    expect(onOpenLeadModal).toHaveBeenCalledTimes(1);
  });

  it("switches to the scrolled styling when the window scrolls", async () => {
    const { container } = render(<Header locale="ru" onOpenLeadModal={vi.fn()} />);
    const header = container.querySelector("header")!;
    expect(header.className).not.toContain("backdrop-blur-xl");

    Object.defineProperty(window, "scrollY", { value: 40, configurable: true, writable: true });
    fireEvent.scroll(window);

    await waitFor(() => expect(header.className).toContain("backdrop-blur-xl"));
  });

  it("opens the mobile drawer, duplicates the nav and closes on link click", () => {
    render(<Header locale="ru" onOpenLeadModal={vi.fn()} />);

    expect(screen.getAllByText(ru.header.nav.features)).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: ru.header.menuToggle }));
    expect(screen.getAllByText(ru.header.nav.features)).toHaveLength(2);

    // clicking a drawer link closes the drawer again
    fireEvent.click(screen.getAllByText(ru.header.nav.features)[1]);
    expect(screen.getAllByText(ru.header.nav.features)).toHaveLength(1);
  });

  it("opens the lead modal from the mobile drawer and closes the drawer", () => {
    const onOpenLeadModal = vi.fn();
    render(<Header locale="uz" onOpenLeadModal={onOpenLeadModal} />);

    fireEvent.click(screen.getByRole("button", { name: uz.header.menuToggle }));
    const ctaButtons = screen.getAllByRole("button", { name: uz.header.startFree });
    expect(ctaButtons).toHaveLength(2);

    fireEvent.click(ctaButtons[1]);
    expect(onOpenLeadModal).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole("button", { name: uz.header.startFree })).toHaveLength(1);
  });

  it("renders the uz navigation labels", () => {
    render(<Header locale="uz" onOpenLeadModal={vi.fn()} />);

    for (const label of headerNavLabels(uz)) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(screen.getByText(uz.header.login)).toBeTruthy();
  });

  it("switches the public theme, persists it and exposes the action label", () => {
    document.documentElement.setAttribute("data-theme", "light");
    render(<Header locale="ru" onOpenLeadModal={vi.fn()} />);

    const toggle = screen.getAllByRole("button", { name: ru.header.theme.toDark })[0];
    expect(toggle.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(toggle);

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(window.localStorage.getItem("edarschi-theme")).toBe("dark");
    // After switching, the control offers the opposite action.
    expect(
      screen.getAllByRole("button", { name: ru.header.theme.toLight }).length,
    ).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole("button", { name: ru.header.theme.toLight })[0]);
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(window.localStorage.getItem("edarschi-theme")).toBe("light");
  });
});

describe("LeadModal", () => {
  it("renders nothing while closed", () => {
    const { container } = render(<LeadModal isOpen={false} onClose={vi.fn()} locale="ru" />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByText(ru.cta.form.nameLabel)).toBeNull();
  });

  it("renders the ru form with every field and the close control", () => {
    render(<LeadModal isOpen onClose={vi.fn()} locale="ru" />);

    expect(screen.getByText(leadTitle.ru)).toBeTruthy();
    expect(screen.getByText(ru.hero.badge)).toBeTruthy();
    expect(screen.getByText(ru.cta.form.nameLabel)).toBeTruthy();
    expect(screen.getByText(ru.cta.form.phoneLabel)).toBeTruthy();
    expect(screen.getByText(ru.cta.form.orgLabel)).toBeTruthy();
    expect(screen.getByText(ru.cta.form.notesLabel)).toBeTruthy();
    expect(screen.getByText(ru.cta.form.guarantee)).toBeTruthy();
    expect(screen.getByRole("button", { name: ru.cta.form.submit })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Yopish" })).toBeTruthy();
  });

  it("closes through the top button and through the backdrop", () => {
    const onClose = vi.fn();
    const { container } = render(<LeadModal isOpen onClose={onClose} locale="ru" />);

    fireEvent.click(screen.getByRole("button", { name: "Yopish" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    const backdrop = container.querySelector('div[class*="bg-slate-950/70"]')!;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("blocks submission until name, phone and organization are valid", () => {
    const { calls } = installFetchMock([]);
    const { container } = render(<LeadModal isOpen onClose={vi.fn()} locale="ru" />);
    const form = container.querySelector("form")!;
    const inputs = container.querySelectorAll("input");

    fireEvent.submit(form);
    expect(calls).toHaveLength(0);
    expect(screen.getByText(leadErrors.ru.name)).toBeTruthy();

    fireEvent.change(inputs[0], { target: { value: "Азамат Зокиров" } });
    fireEvent.submit(form);
    expect(screen.getByText(leadErrors.ru.phone)).toBeTruthy();

    fireEvent.change(inputs[1], { target: { value: "+998 90 123 45 67" } });
    fireEvent.submit(form);
    expect(screen.getByText(leadErrors.ru.organization)).toBeTruthy();
    expect(calls).toHaveLength(0);
  });

  it("keeps the phone prefix pinned to +998", () => {
    const { container } = render(<LeadModal isOpen onClose={vi.fn()} locale="ru" />);
    const phone = container.querySelector('input[type="tel"]') as HTMLInputElement;

    fireEvent.change(phone, { target: { value: "12345" } });
    expect(phone.value).toBe("+998");
  });

  it("submits a lead with the selected plan and closes via OK on success", async () => {
    const onClose = vi.fn();
    const { calls } = installFetchMock([
      { match: "/api/public/leads", method: "POST", reply: jsonResponse({ ok: true }) },
    ]);
    const { container } = render(
      <LeadModal isOpen onClose={onClose} locale="ru" selectedPlan="business" />,
    );

    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
    expect(textarea.value).toBe("Tanlangan tarif: business");

    fillLeadForm(container);
    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => expect(screen.getByText(ru.cta.form.successTitle)).toBeTruthy());
    expect(sentBody(calls[0])).toEqual({
      fullName: "Азамат Зокиров",
      phone: "+998 90 123 45 67",
      organizationName: "Smart Education",
      notes: "Tanlangan tarif: business",
      locale: "ru",
      plan: "business",
      source: "landing-modal",
    });

    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("surfaces the localized error on a 400 response instead of claiming success", async () => {
    installFetchMock([
      { match: "/api/public/leads", method: "POST", reply: jsonResponse({ error: "nope" }, 400) },
    ]);
    const { container } = render(<LeadModal isOpen onClose={vi.fn()} locale="ru" />);

    fillLeadForm(container);
    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => expect(screen.getByText(ru.cta.form.errorMessage)).toBeTruthy());
    expect(screen.queryByText(ru.cta.form.successTitle)).toBeNull();
  });

  it("surfaces the localized error when the network request fails", async () => {
    installFetchMock([]);
    const { container } = render(<LeadModal isOpen onClose={vi.fn()} locale="uz" />);

    fillLeadForm(container, {
      fullName: "Azamat Zokirov",
      phone: "+998901234567",
      organization: "Smart Education",
    });
    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => expect(screen.getByText(uz.cta.form.errorMessage)).toBeTruthy());
    expect(screen.queryByText(uz.cta.form.successTitle)).toBeNull();
  });

  it("renders the uz copy", () => {
    render(<LeadModal isOpen onClose={vi.fn()} locale="uz" />);

    expect(screen.getByText(leadTitle.uz)).toBeTruthy();
    expect(screen.getByText(uz.cta.form.nameLabel)).toBeTruthy();
    expect(screen.getByRole("button", { name: uz.cta.form.submit })).toBeTruthy();
  });
});

describe("LandingView", () => {
  it("composes every ru section behind the shell", () => {
    render(<LandingView locale="ru" />);

    expect(screen.getByText(ru.hero.badge)).toBeTruthy();
    // the why-us badge is also reused as a footer nav link
    expect(screen.getAllByText(ru.whyUs.badge).length).toBeGreaterThan(0);
    expect(screen.getByText(ru.apps.badge)).toBeTruthy();
    expect(screen.getByText(ru.pricing.headerNote)).toBeTruthy();
    expect(screen.getByText(ru.steps.badge)).toBeTruthy();
    expect(screen.getByText(ru.faq.badge)).toBeTruthy();
    expect(screen.getByText(ru.cta.badge)).toBeTruthy();
    expect(screen.getByTitle(ru.footer.mapLabel)).toBeTruthy();
  });

  it("opens the lead modal from the header CTA and closes it again", async () => {
    render(<LandingView locale="ru" />);
    expect(screen.queryByText(leadTitle.ru)).toBeNull();

    // the header CTA is rendered before the hero CTA of the same name
    fireEvent.click(screen.getAllByRole("button", { name: ru.header.startFree })[0]);
    expect(screen.getByText(leadTitle.ru)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Yopish" }));
    await waitFor(() => expect(screen.queryByText(leadTitle.ru)).toBeNull());
  });

  it("opens the lead modal from a pricing plan and sends the chosen plan", async () => {
    const { calls } = installFetchMock([
      { match: "/api/public/leads", method: "POST", reply: jsonResponse({ ok: true }) },
    ]);
    render(<LandingView locale="ru" />);

    const planButtons = screen.getAllByRole("button", { name: ru.pricing.tryFree });
    fireEvent.click(planButtons[1]); // Business

    expect(screen.getByText(leadTitle.ru)).toBeTruthy();

    // The modal is mounted up-front, so its `notes` state was initialised before a
    // plan was picked: the field stays empty even though the plan is tracked.
    const modal = document.querySelector(".fixed.inset-0.z-50") as HTMLElement;
    const textarea = modal.querySelector("textarea") as HTMLTextAreaElement;
    expect(textarea.value).toBe("");

    fillLeadForm(modal);
    fireEvent.submit(modal.querySelector("form")!);

    await waitFor(() => expect(calls).toHaveLength(1));
    expect((sentBody(calls[0]) as { plan?: string }).plan).toBe(ru.pricing.plans[1].id);
  });

  it("renders the uz shell and opens the modal from the steps CTA", async () => {
    render(<LandingView locale="uz" />);

    expect(screen.getAllByText(uz.whyUs.badge).length).toBeGreaterThan(0);
    expect(screen.getByText(uz.faq.badge)).toBeTruthy();

    fireEvent.click(screen.getByText("Ariza"));
    await waitFor(() => expect(screen.getByText(leadTitle.uz)).toBeTruthy());
  });
});

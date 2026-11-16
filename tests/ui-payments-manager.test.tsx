// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, within } from "@testing-library/react";
import PaymentsManager, {
  type PaymentItem,
  type StudentSelectItem,
} from "@/components/PaymentsManager";
import { installFetchMock, jsonResponse, sentBody } from "./helpers/ui";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/center/payments",
  useSearchParams: () => new URLSearchParams(),
}));

const students: StudentSelectItem[] = [
  { id: "m-1", user: { fullName: "Алишер Каримов" } },
  { id: "m-2", user: { fullName: "Нилуфар Рахимова" } },
];

const payments: PaymentItem[] = [
  {
    id: "p-1",
    amount: 450000,
    currency: "UZS",
    paymentMethod: "CASH",
    status: "PAID",
    paidAt: "2026-03-01T10:00:00.000Z",
    student: { user: { fullName: "Алишер Каримов" } },
  },
  {
    id: "p-2",
    amount: 320000,
    currency: "UZS",
    paymentMethod: "ONLINE",
    status: "PENDING",
    paidAt: null,
    student: { user: { fullName: "Нилуфар Рахимова" } },
  },
  {
    id: "p-3",
    amount: 500000,
    currency: "UZS",
    paymentMethod: "BANK_TRANSFER",
    status: "PAID",
    paidAt: "2026-02-11T08:30:00.000Z",
    student: { user: { fullName: "Алишер Каримов" } },
  },
];

describe("PaymentsManager (UI)", () => {
  beforeEach(() => {
    refresh.mockReset();
    vi.spyOn(window, "alert").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders the commission banner, the history table and every payment method label", () => {
    render(<PaymentsManager initialPayments={payments} students={students} role="DIRECTOR" />);

    expect(screen.getByText(/0% комиссия платформы/)).toBeTruthy();
    const table = within(screen.getByRole("table"));
    expect(table.getAllByText("Алишер Каримов").length).toBeGreaterThan(0);
    expect(table.getByText("Наличные / Касса")).toBeTruthy();
    expect(table.getByText("Онлайн эквайринг")).toBeTruthy();
    expect(table.getByText("Банковский перевод")).toBeTruthy();
    expect(table.getAllByText("PAID")).toHaveLength(2);
    expect(table.getByText("PENDING")).toBeTruthy();
  });

  it("renders the empty state when there is no payment history", () => {
    render(<PaymentsManager initialPayments={[]} students={students} role="DIRECTOR" />);

    expect(screen.getByText("История оплат пока пуста.")).toBeTruthy();
  });

  it("hides the record button for roles that cannot manage payments", () => {
    render(<PaymentsManager initialPayments={payments} students={students} role="TEACHER" />);

    expect(screen.queryByRole("button", { name: /Зафиксировать платёж/ })).toBeNull();
  });

  it("hides the record button when no role is provided", () => {
    render(<PaymentsManager initialPayments={payments} students={students} />);

    expect(screen.queryByRole("button", { name: /Зафиксировать платёж/ })).toBeNull();
  });

  it("opens the modal, records a payment and refreshes the router on success", async () => {
    const { calls } = installFetchMock([
      { match: "/api/center-payments", method: "POST", reply: jsonResponse({ id: "new" }, 201) },
    ]);

    render(<PaymentsManager initialPayments={payments} students={students} role="CENTER_ADMIN" />);

    fireEvent.click(screen.getByRole("button", { name: /Зафиксировать платёж/ }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Зафиксировать оплату учеником")).toBeTruthy();

    const form = dialog.querySelector("form")!;
    fireEvent.change(dialog.querySelector('input[type="number"]')!, {
      target: { value: "250000" },
    });
    const selects = dialog.querySelectorAll("select");
    fireEvent.change(selects[1], { target: { value: "ONLINE" } });
    fireEvent.submit(form);

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));

    expect(calls).toHaveLength(1);
    expect(sentBody(calls[0])).toEqual({
      studentMembershipId: "m-1",
      amount: "250000",
      paymentMethod: "ONLINE",
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("surfaces a validation error returned by the API via inline alert", async () => {
    installFetchMock([
      {
        match: "/api/center-payments",
        method: "POST",
        reply: jsonResponse({ error: "Сумма должна быть больше нуля" }, 400),
      },
    ]);

    render(<PaymentsManager initialPayments={payments} students={students} role="DIRECTOR" />);

    fireEvent.click(screen.getByRole("button", { name: /Зафиксировать платёж/ }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(dialog.querySelector('input[type="number"]')!, {
      target: { value: "1" },
    });
    fireEvent.submit(dialog.querySelector("form")!);

    expect(await within(dialog).findByText("Сумма должна быть больше нуля")).toBeTruthy();
    expect(window.alert).not.toHaveBeenCalled();
    expect(within(dialog).getByText("Зафиксировать оплату учеником")).toBeTruthy();
  });

  it("reports a network failure inline without window.alert", async () => {
    installFetchMock([]);

    render(<PaymentsManager initialPayments={payments} students={students} role="DIRECTOR" />);

    fireEvent.click(screen.getByRole("button", { name: /Зафиксировать платёж/ }));
    const dialog = screen.getByRole("dialog");
    fireEvent.submit(dialog.querySelector("form")!);

    expect(await within(dialog).findByText("Ошибка сети")).toBeTruthy();
    expect(window.alert).not.toHaveBeenCalled();
  });

  it("closes the modal without sending a request when cancelled", () => {
    const { calls } = installFetchMock([]);
    render(<PaymentsManager initialPayments={payments} students={students} role="DIRECTOR" />);

    fireEvent.click(screen.getByRole("button", { name: /Зафиксировать платёж/ }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Отмена" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(calls).toHaveLength(0);
  });
});

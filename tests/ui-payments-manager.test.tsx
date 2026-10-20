// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
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

    expect(screen.getByText(/0% Комиссия Платформы!/)).toBeTruthy();
    expect(screen.getAllByText("Алишер Каримов").length).toBeGreaterThan(0);
    expect(screen.getByText("💵 Наличные / Касса")).toBeTruthy();
    expect(screen.getByText("💳 Онлайн Эквайринг")).toBeTruthy();
    expect(screen.getByText("🏦 Банковский перевод")).toBeTruthy();
    expect(screen.getAllByText("PAID")).toHaveLength(2);
    expect(screen.getByText("PENDING")).toBeTruthy();
  });

  it("renders the empty state when there is no payment history", () => {
    render(<PaymentsManager initialPayments={[]} students={students} role="DIRECTOR" />);

    expect(screen.getByText("История оплат пока пуста.")).toBeTruthy();
  });

  it("hides the record button for roles that cannot manage payments", () => {
    render(<PaymentsManager initialPayments={payments} students={students} role="TEACHER" />);

    expect(screen.queryByRole("button", { name: /Зафиксировать Платеж/ })).toBeNull();
  });

  it("hides the record button when no role is provided", () => {
    render(<PaymentsManager initialPayments={payments} students={students} />);

    expect(screen.queryByRole("button", { name: /Зафиксировать Платеж/ })).toBeNull();
  });

  it("opens the modal, records a payment and refreshes the router on success", async () => {
    const { calls } = installFetchMock([
      { match: "/api/center-payments", method: "POST", reply: jsonResponse({ id: "new" }, 201) },
    ]);

    const { container } = render(
      <PaymentsManager initialPayments={payments} students={students} role="CENTER_ADMIN" />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Зафиксировать Платеж/ }));
    expect(screen.getByText("Зафиксировать Оплату Учеником")).toBeTruthy();

    const form = container.querySelector("form")!;
    fireEvent.change(container.querySelector('input[type="number"]')!, {
      target: { value: "250000" },
    });
    const selects = container.querySelectorAll("select");
    fireEvent.change(selects[1], { target: { value: "ONLINE" } });
    fireEvent.submit(form);

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));

    expect(calls).toHaveLength(1);
    expect(sentBody(calls[0])).toEqual({
      studentMembershipId: "m-1",
      amount: "250000",
      paymentMethod: "ONLINE",
    });
    // modal closed on success
    await waitFor(() => expect(screen.queryByText("Зафиксировать Оплату Учеником")).toBeNull());
  });

  it("surfaces a validation error returned by the API via alert", async () => {
    installFetchMock([
      {
        match: "/api/center-payments",
        method: "POST",
        reply: jsonResponse({ error: "Сумма должна быть больше нуля" }, 400),
      },
    ]);

    const { container } = render(
      <PaymentsManager initialPayments={payments} students={students} role="DIRECTOR" />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Зафиксировать Платеж/ }));
    fireEvent.change(container.querySelector('input[type="number"]')!, {
      target: { value: "1" },
    });
    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() =>
      expect(window.alert).toHaveBeenCalledWith("Сумма должна быть больше нуля"),
    );
    // The modal stays open so the operator can fix the input.
    expect(screen.getByText("Зафиксировать Оплату Учеником")).toBeTruthy();
  });

  it("reports a network failure with a generic alert", async () => {
    installFetchMock([]); // any request throws -> network error branch

    const { container } = render(
      <PaymentsManager initialPayments={payments} students={students} role="DIRECTOR" />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Зафиксировать Платеж/ }));
    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith("Ошибка сети"));
  });

  it("closes the modal without sending a request when cancelled", () => {
    const { calls } = installFetchMock([]);
    render(<PaymentsManager initialPayments={payments} students={students} role="DIRECTOR" />);

    fireEvent.click(screen.getByRole("button", { name: /Зафиксировать Платеж/ }));
    fireEvent.click(screen.getByRole("button", { name: "Отмена" }));

    expect(screen.queryByText("Зафиксировать Оплату Учеником")).toBeNull();
    expect(calls).toHaveLength(0);
  });
});

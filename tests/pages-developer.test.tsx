// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import DeveloperDashboard from "@/app/developer/page";
import GlobalAuditLogsPage from "@/app/developer/audit/page";
import PlatformOwnersPage from "@/app/developer/owners/page";
import { installFetchMock, jsonResponse } from "./helpers/ui";

/**
 * Client pages of the developer panel:
 *  - developer           (health dashboard, formatted uptime/memory)
 *  - developer/audit     (global audit table + client-side grep)
 *  - developer/owners    (platform administrators table)
 *
 * All three fetch once on mount through `installFetchMock`.
 */

beforeEach(() => {
  vi.spyOn(window, "alert").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// 1. /developer (System Diagnostics)
// ---------------------------------------------------------------------------

describe("developer dashboard page", () => {
  const health = {
    dbStatus: "HEALTHY",
    dbPingMs: 12,
    redisStatus: "CONNECTED",
    redisPingMs: 3,
    uptimeSeconds: 2 * 86400 + 3 * 3600 + 4 * 60,
    memoryUsage: { rss: 3000000, heapUsed: 1048576, heapTotal: 2097152 },
    environment: "production",
  };

  it("shows the diagnostics placeholder, then the health cards", async () => {
    const { calls } = installFetchMock([
      { match: "/api/developer/health", reply: jsonResponse({ health }) },
    ]);

    const { container } = render(<DeveloperDashboard />);
    expect(screen.getByText("Running diagnostics...")).toBeTruthy();

    await waitFor(() => expect(screen.getByText("System Diagnostics")).toBeTruthy());

    expect(calls[0].url).toBe("/api/developer/health");
    expect(screen.getByText("HEALTHY")).toBeTruthy();
    expect(screen.getByText("12ms ping")).toBeTruthy();
    expect(screen.getByText("CONNECTED")).toBeTruthy();
    expect(screen.getByText("2d 3h 4m")).toBeTruthy();
    expect(screen.getByText("1 MB")).toBeTruthy();
    expect(screen.getByText("/ 2 MB")).toBeTruthy();
    expect(container.textContent).toContain('"env": "production"');
  });

  it("surfaces a non-HEALTHY database status", async () => {
    installFetchMock([
      {
        match: "/api/developer/health",
        reply: jsonResponse({ health: { ...health, dbStatus: "DEGRADED", uptimeSeconds: 0 } }),
      },
    ]);

    render(<DeveloperDashboard />);
    await waitFor(() => expect(screen.getByText("DEGRADED")).toBeTruthy());
    expect(screen.getByText("0d 0h 0m")).toBeTruthy();
  });

  it("renders the failure banner when the payload has no health field", async () => {
    installFetchMock([{ match: "/api/developer/health", reply: jsonResponse({}) }]);

    render(<DeveloperDashboard />);
    await waitFor(() =>
      expect(screen.getByText("Failed to connect to health API.")).toBeTruthy(),
    );
  });
});

// ---------------------------------------------------------------------------
// 2. /developer/audit (Global Audit Logs)
// ---------------------------------------------------------------------------

describe("developer audit page", () => {
  const logs = [
    {
      id: "log-1",
      createdAt: "2026-04-01T10:00:00.000Z",
      center: { slug: "alpha" },
      actor: { email: "admin@x.uz" },
      action: "CREATE_CENTER",
      resource: "LearningCenter",
      resourceId: "c-1",
    },
    {
      id: "log-2",
      createdAt: "2026-04-02T11:30:00.000Z",
      center: null,
      actor: { email: "root@x.uz" },
      action: "LOGIN",
      resource: "Session",
      resourceId: null,
    },
  ];

  it("shows the query placeholder, then the audit table rows", async () => {
    const { calls } = installFetchMock([
      { match: "/api/developer/audit-logs", reply: jsonResponse({ logs }) },
    ]);

    const { container } = render(<GlobalAuditLogsPage />);
    expect(screen.getByText("Querying logs...")).toBeTruthy();

    await waitFor(() => expect(screen.getByText("CREATE_CENTER")).toBeTruthy());

    expect(calls[0].url).toBe("/api/developer/audit-logs?limit=200");
    expect(screen.getByText("2026-04-01 10:00:00")).toBeTruthy();
    expect(screen.getByText("alpha")).toBeTruthy();
    expect(screen.getByText("PLATFORM")).toBeTruthy();
    expect(screen.getByText("admin@x.uz")).toBeTruthy();
    expect(screen.getByText("root@x.uz")).toBeTruthy();
    expect(screen.getByText("LOGIN")).toBeTruthy();
    expect(screen.getByText("LearningCenter")).toBeTruthy();
    expect(container.textContent).toContain("c-1");
  });

  it("filters the table client-side by action, actor or resource", async () => {
    installFetchMock([{ match: "/api/developer/audit-logs", reply: jsonResponse({ logs }) }]);

    const { container } = render(<GlobalAuditLogsPage />);
    await waitFor(() => expect(screen.getByText("CREATE_CENTER")).toBeTruthy());

    const input = container.querySelector('input[type="text"]')!;

    fireEvent.change(input, { target: { value: "login" } });
    expect(screen.getByText("LOGIN")).toBeTruthy();
    expect(screen.queryByText("CREATE_CENTER")).toBeNull();

    fireEvent.change(input, { target: { value: "root@x.uz" } });
    expect(screen.getByText("LOGIN")).toBeTruthy();
    expect(screen.queryByText("CREATE_CENTER")).toBeNull();

    fireEvent.change(input, { target: { value: "learning" } });
    expect(screen.getByText("CREATE_CENTER")).toBeTruthy();
    expect(screen.queryByText("LOGIN")).toBeNull();

    fireEvent.change(input, { target: { value: "nope" } });
    expect(screen.getByText("0 matches")).toBeTruthy();
  });

  it("renders the empty journal", async () => {
    installFetchMock([
      { match: "/api/developer/audit-logs", reply: jsonResponse({ logs: [] }) },
    ]);

    render(<GlobalAuditLogsPage />);
    await waitFor(() => expect(screen.getByText("0 matches")).toBeTruthy());
  });

  it("treats a payload without logs as empty", async () => {
    installFetchMock([
      { match: "/api/developer/audit-logs", reply: jsonResponse({}) },
    ]);

    render(<GlobalAuditLogsPage />);
    await waitFor(() => expect(screen.getByText("0 matches")).toBeTruthy());
  });
});

// ---------------------------------------------------------------------------
// 3. /developer/owners (Platform Administrators)
// ---------------------------------------------------------------------------

describe("developer owners page", () => {
  const owners = [
    {
      id: "u-1",
      email: "dev@x.uz",
      fullName: "Dev One",
      platformRole: "DEVELOPER",
      isActive: true,
      createdAt: "2026-01-15T00:00:00.000Z",
    },
    {
      id: "u-2",
      email: "super@x.uz",
      fullName: "Super Two",
      platformRole: "SUPERADMIN",
      isActive: false,
      createdAt: "2026-02-20T00:00:00.000Z",
    },
    {
      id: "u-3",
      email: "seo@x.uz",
      fullName: "Seo Three",
      platformRole: "SEO_ADMIN",
      isActive: true,
      createdAt: "2026-03-25T00:00:00.000Z",
    },
  ];

  it("shows the fetching placeholder, then the administrators table", async () => {
    const { calls } = installFetchMock([
      { match: "/api/developer/platform-owners", reply: jsonResponse({ owners }) },
    ]);

    const { container } = render(<PlatformOwnersPage />);
    expect(screen.getByText("Fetching administrators...")).toBeTruthy();

    await waitFor(() => expect(screen.getByText("dev@x.uz")).toBeTruthy());

    expect(calls[0].url).toBe("/api/developer/platform-owners");
    expect(screen.getByText("Dev One")).toBeTruthy();
    expect(screen.getByText("DEVELOPER")).toBeTruthy();
    expect(screen.getByText("SUPERADMIN")).toBeTruthy();
    expect(screen.getByText("SEO_ADMIN")).toBeTruthy();
    expect(screen.getAllByText("ACTIVE")).toHaveLength(2);
    expect(screen.getByText("SUSPENDED")).toBeTruthy();
    expect(screen.getAllByText("Configure")).toHaveLength(3);
    expect(screen.getByRole("button", { name: /Add Administrator/ })).toBeTruthy();
    expect(container.querySelectorAll("tbody tr")).toHaveLength(3);
  });

  it("stops showing the placeholder when there are no owners", async () => {
    installFetchMock([
      { match: "/api/developer/platform-owners", reply: jsonResponse({ owners: [] }) },
    ]);

    const { container } = render(<PlatformOwnersPage />);
    expect(screen.getByText("Fetching administrators...")).toBeTruthy();

    await waitFor(() => expect(screen.queryByText("Fetching administrators...")).toBeNull());
    expect(container.querySelectorAll("tbody tr")).toHaveLength(0);
    // no dedicated empty state — the header stays visible
    expect(screen.getByText("Platform Administrators")).toBeTruthy();
  });
});

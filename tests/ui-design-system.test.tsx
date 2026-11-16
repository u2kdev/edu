// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, act } from "@testing-library/react";
import * as fs from "fs";
import * as path from "path";
import { t } from "@/i18n";
import { formatIntegerSpaces, formatNumber, formatUzs } from "@/lib/money";
import {
  PANEL_RESOLVED_THEME_COOKIE,
  PANEL_THEME_COOKIE,
  getServerPanelTheme,
  parsePanelTheme,
  parseResolvedPanelTheme,
} from "@/lib/panel-theme";
import { PanelThemeProvider, usePanelTheme } from "@/components/theme/PanelThemeProvider";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Avatar,
  Badge,
  Breadcrumbs,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  FilterBar,
  Input,
  Label,
  PageHeader,
  Pagination,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  Skeleton,
  StatCard,
  StatusDot,
  Switch,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui";
import {
  AreaLineChart,
  AttendanceHeatmap,
  BarChart,
  ChartContainer,
  ChartTooltip,
  DonutChart,
  ProgressBar,
  ProgressRing,
  Sparkline,
  formatChartValue,
  getChartColor,
} from "@/components/charts";
import DonutChartInner from "@/components/charts/donut-chart-inner";
import BarChartInner from "@/components/charts/bar-chart-inner";
import AreaLineChartInner from "@/components/charts/area-line-chart-inner";
import SparklineInner from "@/components/charts/sparkline-inner";
import { DevUiKitShowcase } from "@/components/dev/DevUiKitShowcase";

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function setupBrowserAPIs(prefersDark = false) {
  let changeHandler: ((event: MediaQueryListEvent) => void) | null = null;
  const matchMediaMock = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes("dark") ? prefersDark : false,
    media: query,
    onchange: null,
    addEventListener: (_type: string, cb: (event: MediaQueryListEvent) => void) => {
      changeHandler = cb;
    },
    removeEventListener: () => {
      changeHandler = null;
    },
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: matchMediaMock,
  });

  if (typeof globalThis.ResizeObserver === "undefined") {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn();
  }
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }

  return {
    triggerMediaChange: (matches: boolean) => {
      changeHandler?.({ matches } as MediaQueryListEvent);
    },
  };
}

beforeEach(() => {
  setupBrowserAPIs(false);
  document.documentElement.classList.remove("dark");
  document.cookie = `${PANEL_THEME_COOKIE}=; max-age=0; path=/`;
  document.cookie = `${PANEL_RESOLVED_THEME_COOKIE}=; max-age=0; path=/`;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// 1. Money & number formatters (UZS + space separators)
// ---------------------------------------------------------------------------

describe("formatIntegerSpaces / formatUzs / formatNumber", () => {
  it("formats positive, negative, zero, BigInt and nullish integers with space grouping", () => {
    expect(formatIntegerSpaces(0)).toBe("0");
    expect(formatIntegerSpaces(1250000)).toBe("1 250 000");
    expect(formatIntegerSpaces(-4500)).toBe("-4 500");
    expect(formatIntegerSpaces(1234.6)).toBe("1 235");
    expect(formatIntegerSpaces(BigInt("9876543210"))).toBe("9 876 543 210");
    expect(formatIntegerSpaces(BigInt("-50000"))).toBe("-50 000");
    expect(formatIntegerSpaces(BigInt(0))).toBe("0");
    expect(formatIntegerSpaces(null)).toBe("0");
    expect(formatIntegerSpaces(undefined)).toBe("0");
    expect(formatNumber(42000)).toBe("42 000");
  });

  it("formats UZS for ru, uz-Latn, ISO code, without currency and compact scales", () => {
    expect(formatUzs(1450000)).toBe("1 450 000 сум");
    expect(formatUzs(1450000, { locale: "uz-Latn" })).toBe("1 450 000 soʻm");
    expect(formatUzs(1450000, { currencyStyle: "code" })).toBe("1 450 000 UZS");
    expect(formatUzs(1450000, { showCurrency: false })).toBe("1 450 000");

    expect(formatUzs(2_500_000_000, { compact: true })).toBe("2.5 млрд сум");
    expect(formatUzs(2_500_000_000, { compact: true, locale: "uz-Latn" })).toBe("2.5 mlrd soʻm");
    expect(formatUzs(12_500_000, { compact: true })).toBe("12.5 млн сум");
    expect(formatUzs(12_500_000, { compact: true, locale: "uz-Latn", showCurrency: false })).toBe("12.5 mln");
    expect(formatUzs(450_000, { compact: true })).toBe("450 тыс сум");
    expect(formatUzs(450_000, { compact: true, locale: "uz-Latn", currencyStyle: "code" })).toBe("450 ming UZS");
    expect(formatUzs(-8_500, { compact: true })).toBe("-8 500 сум");
    expect(formatUzs(BigInt(3_000_000), { compact: true })).toBe("3 млн сум");
  });
});

// ---------------------------------------------------------------------------
// 2. Panel theme utilities, provider & toggle
// ---------------------------------------------------------------------------

describe("panel-theme helpers, PanelThemeProvider and ThemeToggle", () => {
  it("parses theme and resolved cookies safely", async () => {
    expect(parsePanelTheme("light")).toBe("light");
    expect(parsePanelTheme("dark")).toBe("dark");
    expect(parsePanelTheme("system")).toBe("system");
    expect(parsePanelTheme("neon")).toBe("system");
    expect(parsePanelTheme(null)).toBe("system");

    expect(parseResolvedPanelTheme("light", "dark")).toBe("light");
    expect(parseResolvedPanelTheme("dark", "light")).toBe("dark");
    expect(parseResolvedPanelTheme("system", "dark")).toBe("dark");
    expect(parseResolvedPanelTheme("system", "invalid")).toBeNull();

    // Outside Next.js request context, getServerPanelTheme falls back cleanly
    expect(await getServerPanelTheme()).toEqual({ theme: "system", resolvedTheme: null });
  });

  it("reads cookies cleanly inside a Next.js request scope via mock", async () => {
    vi.doMock("next/headers", () => ({
      cookies: () => ({
        get: (name: string) => {
          if (name === PANEL_THEME_COOKIE) return { value: "system" };
          if (name === PANEL_RESOLVED_THEME_COOKIE) return { value: "dark" };
          return undefined;
        },
      }),
    }));
    const { getServerPanelTheme: loadFromMock } = await import("@/lib/panel-theme");
    expect(await loadFromMock()).toEqual({ theme: "system", resolvedTheme: "dark" });
    vi.doUnmock("next/headers");
  });

  it("switches light, dark and system themes, updates html.dark and listens to prefers-color-scheme", () => {
    const { triggerMediaChange } = setupBrowserAPIs(false);

    function Inspector() {
      const { theme, resolvedTheme } = usePanelTheme();
      return (
        <div>
          <span data-testid="state">{`${theme}:${resolvedTheme}`}</span>
          <ThemeToggle locale="ru" />
          <ThemeToggle locale="uz-Latn" compact />
        </div>
      );
    }

    const { container } = render(
      <PanelThemeProvider initialTheme="light" initialResolvedTheme="light">
        <Inspector />
      </PanelThemeProvider>
    );

    const shell = container.querySelector(".panel-shell")!;
    expect(screen.getByTestId("state").textContent).toBe("light:light");
    expect(shell.getAttribute("data-resolved-theme")).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    const darkRadio = screen.getAllByRole("radio", { name: t("ru", "theme.dark") })[0];
    fireEvent.click(darkRadio);
    expect(screen.getByTestId("state").textContent).toBe("dark:dark");
    expect(shell.getAttribute("data-resolved-theme")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.cookie).toContain(`${PANEL_THEME_COOKIE}=dark`);
    expect(document.cookie).toContain(`${PANEL_RESOLVED_THEME_COOKIE}=dark`);

    const systemRadio = screen.getAllByRole("radio", { name: t("ru", "theme.system") })[0];
    fireEvent.click(systemRadio);
    expect(screen.getByTestId("state").textContent).toBe("system:light");

    act(() => {
      triggerMediaChange(true);
    });
    expect(screen.getByTestId("state").textContent).toBe("system:dark");
  });

  it("renders ThemeToggle standalone outside PanelThemeProvider", () => {
    const onChange = vi.fn();
    render(<ThemeToggle locale="uz-Latn" value="dark" onChange={onChange} />);
    const lightBtn = screen.getByRole("radio", { name: t("uz-Latn", "theme.light") });
    expect(lightBtn.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(lightBtn);
    expect(onChange).toHaveBeenCalledWith("light");
  });
});

// ---------------------------------------------------------------------------
// 3. UI Kit Primitives (Radix + Semantic tokens)
// ---------------------------------------------------------------------------

describe("UI Kit components", () => {
  it("renders inputs, buttons, badges, cards, alerts, avatars, breadcrumbs, header, filter bar & pagination", () => {
    const onPageChange = vi.fn();
    const onSearchChange = vi.fn();
    const onReset = vi.fn();

    render(
      <TooltipProvider>
        <PageHeader
          title="Финансы"
          description="Операционный учёт"
          breadcrumbs={[{ label: "Главная", href: "/center" }, { label: "Финансы" }]}
          actions={<Button loading>Сохранение</Button>}
        />
        <FilterBar
          search="Иван"
          onSearchChange={onSearchChange}
          hasActiveFilters
          onReset={onReset}
          actions={<Button variant="outline" size="sm">Экспорт</Button>}
        >
          <Input error aria-label="Сумма" defaultValue="100" />
          <Textarea error aria-label="Комментарий" defaultValue="Тест" />
        </FilterBar>
        <div className="flex gap-2">
          <StatCard label="Выручка" value="12 500 000 сум" delta={{ value: "+8%", tone: "positive" }} hint="За месяц" />
          <StatCard label="Долг" value="400 000 сум" delta={{ value: "-2%", tone: "negative" }} />
          <StatCard label="Группы" value={14} delta={{ value: "0%", tone: "neutral" }} />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Карточка</CardTitle>
            <CardDescription>Описание</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Badge variant="success">Оплачено</Badge>
            <StatusDot tone="warning" label="Ожидает" />
            <Avatar name="Азиза Каримова" size="sm" />
            <Avatar src="https://cdn.example/a.png" alt="Photo" size="lg" />
            <Skeleton className="h-4 w-24" />
            <Alert variant="destructive">
              <AlertTitle>Ошибка</AlertTitle>
              <AlertDescription>Проверьте данные</AlertDescription>
            </Alert>
            <EmptyState title="Пусто" description="Нет записей" action={<Button variant="secondary">Обновить</Button>} />
          </CardContent>
          <CardFooter>
            <Button asChild variant="ghost">
              <a href="/center">Перейти</a>
            </Button>
          </CardFooter>
        </Card>
        <Pagination page={2} totalPages={5} totalItems={48} pageSize={10} onPageChange={onPageChange} />
      </TooltipProvider>
    );

    expect(screen.getByRole("heading", { name: "Финансы" })).toBeTruthy();
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText("АК")).toBeTruthy();
    expect(screen.getByRole("img", { name: "Photo" })).toBeTruthy();
    expect(screen.getByText("+8%")).toBeTruthy();
    expect(screen.getByText("Показано 11–20 из 48")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: t("ru", "ui.clearFilters") }));
    expect(onReset).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: t("ru", "ui.next") }));
    expect(onPageChange).toHaveBeenCalledWith(3);

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Анна" } });
    expect(onSearchChange).toHaveBeenCalledWith("Анна");
  });

  it("renders interactive Radix Checkbox, Switch, Select, Tabs, Dialog, Sheet, Popover, DropdownMenu & Tooltip", () => {
    const onCheck = vi.fn();
    const onSwitch = vi.fn();
    const onSelect = vi.fn();

    render(
      <TooltipProvider>
        <div>
          <Label htmlFor="cb-1">Согласие</Label>
          <Checkbox id="cb-1" checked={false} onCheckedChange={onCheck} />
          <Switch aria-label="Уведомления" checked onCheckedChange={onSwitch} />

          <Select value="click" onValueChange={onSelect}>
            <SelectTrigger aria-label="Способ оплаты">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="click">Click</SelectItem>
              <SelectItem value="cash">Наличные</SelectItem>
            </SelectContent>
          </Select>

          <Tabs defaultValue="tab-1">
            <TabsList>
              <TabsTrigger value="tab-1">Вкладка 1</TabsTrigger>
              <TabsTrigger value="tab-2">Вкладка 2</TabsTrigger>
            </TabsList>
            <TabsContent value="tab-1">Контент 1</TabsContent>
            <TabsContent value="tab-2">Контент 2</TabsContent>
          </Tabs>

          <Dialog>
            <DialogTrigger asChild>
              <Button>Открыть диалог</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Подтверждение</DialogTitle>
                <DialogDescription>Текст диалога</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button>Ок</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Sheet>
            <SheetTrigger asChild>
              <Button>Открыть панель</Button>
            </SheetTrigger>
            <SheetContent side="left">
              <SheetHeader>
                <SheetTitle>Боковая панель</SheetTitle>
                <SheetDescription>Фильтры</SheetDescription>
              </SheetHeader>
            </SheetContent>
          </Sheet>

          <Popover>
            <PopoverTrigger asChild>
              <Button>Поповер</Button>
            </PopoverTrigger>
            <PopoverContent>Подсказка поповера</PopoverContent>
          </Popover>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>Меню</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Действия</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Архивировать</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Tooltip open>
            <TooltipTrigger asChild>
              <Button>Подсказка</Button>
            </TooltipTrigger>
            <TooltipContent>Текст тултипа</TooltipContent>
          </Tooltip>

          <Table>
            <TableCaption>Сводка</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Имя</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>Тимур</TableCell>
              </TableRow>
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell>Итого: 1</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </TooltipProvider>
    );

    fireEvent.click(screen.getByRole("checkbox"));
    expect(onCheck).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByRole("switch"));
    expect(onSwitch).toHaveBeenCalledWith(false);

    fireEvent.click(screen.getByRole("button", { name: "Открыть диалог" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Подтверждение")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: t("ru", "common.close") }));

    fireEvent.click(screen.getByRole("button", { name: "Открыть панель" }));
    expect(screen.getByText("Боковая панель")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: t("ru", "ui.closePanel") }));

    fireEvent.click(screen.getByRole("button", { name: "Поповер" }));
    expect(screen.getByText("Подсказка поповера")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 4. Charts Kit + Progress / Heatmap + Dynamic Inner Chart Views
// ---------------------------------------------------------------------------

describe("Charts Kit", () => {
  it("formats chart values and renders ChartTooltip cleanly", () => {
    expect(getChartColor(0)).toBe("var(--chart-1)");
    expect(getChartColor(8)).toBe("var(--chart-1)");
    expect(formatChartValue(1_500_000, "uzs", "ru", true)).toBe("1.5 млн");
    expect(formatChartValue(1_500_000, "uzs", "uz-Latn", false)).toBe("1 500 000 soʻm");
    expect(formatChartValue(45.67, "percent")).toBe("45.7%");
    expect(formatChartValue(1200, "number")).toBe("1 200");
    expect(formatChartValue(Number.NaN, "number")).toBe("0");

    const { container, rerender } = render(
      <ChartTooltip active={false} payload={[]} />
    );
    expect(container.firstChild).toBeNull();

    rerender(
      <ChartTooltip
        active
        label="Январь"
        valueType="uzs"
        locale="ru"
        labelMap={{ click: "Click" }}
        payload={[{ dataKey: "click", name: "click", value: 1450000, color: "var(--chart-1)" }]}
      />
    );
    expect(screen.getByText("Январь")).toBeTruthy();
    expect(screen.getByText("Click")).toBeTruthy();
    expect(screen.getByText("1 450 000 сум")).toBeTruthy();
  });

  it("handles ChartContainer states (loading, empty, error boundary, chart/table toggle, legend)", () => {
    const spyErr = vi.spyOn(console, "error").mockImplementation(() => {});

    const { rerender } = render(
      <ChartContainer title="Выручка" loading>
        <div>Body</div>
      </ChartContainer>
    );
    expect(screen.queryByText("Body")).toBeNull();

    rerender(
      <ChartContainer title="Выручка" empty emptyMessage="Данных нет">
        <div>Body</div>
      </ChartContainer>
    );
    expect(screen.getByText("Данных нет")).toBeTruthy();

    rerender(
      <ChartContainer
        title="Выручка"
        tableColumns={[
          { key: "m", label: "Месяц" },
          { key: "sum", label: "Сумма", align: "right" },
        ]}
        tableRows={[{ m: "Янв", sum: "1 000 000 сум" }]}
        legendItems={[
          { key: "click", label: "Click", color: "var(--chart-1)", formattedValue: "1 000 000 сум", percent: 62.4 },
        ]}
      >
        <div data-testid="chart-body">Chart SVG</div>
      </ChartContainer>
    );
    expect(screen.getByTestId("chart-body")).toBeTruthy();
    expect(screen.getByText(/\(62%\)/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: t("ru", "charts.viewTable") }));
    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.getByText("1 000 000 сум")).toBeTruthy();

    function Boom(): React.ReactNode {
      throw new Error("boom");
    }
    rerender(
      <ChartContainer title="Сбой">
        <Boom />
      </ChartContainer>
    );
    expect(screen.getByRole("alert").textContent).toContain(t("ru", "charts.error"));
    spyErr.mockRestore();
  });

  it("renders ProgressRing, ProgressBar, AttendanceHeatmap and Recharts inner/outer wrappers", async () => {
    const heatData = Array.from({ length: 14 }, (_, i) => ({
      date: `2026-11-${String(i + 1).padStart(2, "0")}`,
      count: i % 5,
    }));

    const donutData = [
      { name: "Click", value: 60 },
      { name: "Наличные", value: 40 },
    ];
    const barData = [
      { month: "Янв", paid: 10_000_000, debt: 2_000_000 },
      { month: "Фев", paid: 12_000_000, debt: 1_500_000 },
    ];

    render(
      <div>
        <ProgressRing value={78} tone="success" label="Посещаемость" caption="156 / 200" />
        <ProgressBar value={45} max={100} tone="warning" label="Лимит SMS" valueLabel="45 / 100" />
        <AttendanceHeatmap title="Активность" data={heatData} />
        <DonutChart title="Оплаты" data={donutData} valueType="number" centerLabel="Всего" />
        <BarChart
          title="Помесячно"
          data={barData}
          xKey="month"
          series={[
            { key: "paid", label: "Оплачено" },
            { key: "debt", label: "Долг" },
          ]}
          valueType="uzs"
        />
        <AreaLineChart
          title="Тренд"
          data={barData}
          xKey="month"
          series={[{ key: "paid", label: "Выручка" }]}
          valueType="uzs"
        />
        <Sparkline values={[10, 20, 15, 30]} label="Мини-график" />

        {/* Direct render of lazy inner modules to verify zero-runtime-error SVG trees */}
        <DonutChartInner data={donutData} height={200} valueType="number" locale="ru" centerValue="100" centerLabel="Всего" />
        <BarChartInner
          data={barData}
          xKey="month"
          series={[{ key: "paid", label: "Paid" }]}
          height={200}
          valueType="uzs"
          locale="ru"
          layout="horizontal"
          stacked
        />
        <AreaLineChartInner
          data={barData}
          xKey="month"
          series={[{ key: "paid", label: "Paid" }]}
          height={200}
          valueType="uzs"
          locale="uz-Latn"
          variant="line"
        />
        <SparklineInner data={[{ value: 1 }, { value: 3 }]} height={36} color="var(--chart-1)" />
      </div>
    );

    expect(screen.getByRole("progressbar", { name: "Посещаемость" }).getAttribute("aria-valuenow")).toBe("78");
    expect(screen.getByRole("progressbar", { name: "Лимит SMS" }).getAttribute("aria-valuenow")).toBe("45");
    expect(screen.getByRole("grid", { name: "Активность" })).toBeTruthy();
    expect(screen.getAllByRole("gridcell")).toHaveLength(14);
    expect(screen.getByRole("img", { name: "Мини-график" })).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText("Помесячно")).toBeTruthy();
    });
  });
});

// ---------------------------------------------------------------------------
// 5. Dev UI Kit Showcase (ru + uz-Latn + filtering + dialogs)
// ---------------------------------------------------------------------------

describe("DevUiKitShowcase", () => {
  it("renders all sections, switches locale to uz-Latn and filters sample rows", () => {
    render(
      <PanelThemeProvider initialTheme="light" initialResolvedTheme="light">
        <DevUiKitShowcase initialTheme="light" />
      </PanelThemeProvider>
    );

    expect(screen.getByRole("heading", { name: "Dev UI Kit" })).toBeTruthy();
    expect(screen.getByText(new RegExp(t("ru", "devUiKit.subtitle")))).toBeTruthy();
    expect(screen.getAllByText("1 450 000 сум").length).toBeGreaterThan(0);

    // Filter rows using search box
    const searchInput = screen.getByRole("searchbox");
    fireEvent.change(searchInput, { target: { value: "Madina" } });
    expect(screen.getAllByText(/Madina Oʻrinboyeva/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("1 800 000 сум").length).toBeGreaterThan(0);
    expect(screen.queryByText("Азиза Каримова")).toBeNull();

    // Switch locale to uz-Latn
    fireEvent.click(screen.getByRole("button", { name: "Oʻz" }));
    expect(screen.getByText(new RegExp(t("uz-Latn", "devUiKit.subtitle")))).toBeTruthy();
    expect(screen.getAllByText("1 800 000 soʻm").length).toBeGreaterThan(0);

    // Clear filters brings back Aziza row in Uzbek UZS formatting
    fireEvent.click(screen.getByRole("button", { name: t("uz-Latn", "ui.clearFilters") }));
    expect(screen.getAllByText("1 450 000 soʻm").length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 6. Semantic tokens & i18n key parity checks
// ---------------------------------------------------------------------------

describe("Design system token & i18n parity", () => {
  it("defines light, dark and chart-1..8 tokens in globals.css without breaking public-shell", () => {
    const css = fs.readFileSync(path.join(process.cwd(), "src", "app", "globals.css"), "utf8");
    for (const token of [
      "--background-hsl",
      "--foreground-hsl",
      "--primary-hsl",
      "--destructive-hsl",
      "--success-hsl",
      "--warning-hsl",
      "--info-hsl",
      "--scrim-hsl",
      "--chart-1-hsl",
      "--chart-8-hsl",
      ".panel-shell",
      ".public-shell",
      "prefers-color-scheme: dark",
    ]) {
      expect(css).toContain(token);
    }
  });

  it("keeps identical theme, ui, charts and devUiKit dictionary keys across ru.json and uz-Latn.json", () => {
    const ru = JSON.parse(fs.readFileSync(path.join(process.cwd(), "src", "i18n", "locales", "ru.json"), "utf8"));
    const uz = JSON.parse(fs.readFileSync(path.join(process.cwd(), "src", "i18n", "locales", "uz-Latn.json"), "utf8"));

    for (const section of ["theme", "ui", "charts", "devUiKit"] as const) {
      expect(Object.keys(uz[section]).sort()).toEqual(Object.keys(ru[section]).sort());
    }
  });
});

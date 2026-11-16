"use client";

import * as React from "react";
import { t } from "@/i18n";
import { formatUzs } from "@/lib/money";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { usePanelTheme } from "@/components/theme/PanelThemeProvider";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Avatar,
  Badge,
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
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  Skeleton,
  StatCard,
  StatusDot,
  Switch,
  Table,
  TableBody,
  TableCell,
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
  DonutChart,
  ProgressBar,
  ProgressRing,
  Sparkline,
} from "@/components/charts";
import { MoreHorizontal, Plus, SlidersHorizontal } from "lucide-react";

const REVENUE_DATA = [
  { month: "Янв", cash: 18_500_000, click: 14_200_000 },
  { month: "Фев", cash: 21_000_000, click: 17_800_000 },
  { month: "Мар", cash: 19_400_000, click: 22_100_000 },
  { month: "Апр", cash: 23_800_000, click: 26_400_000 },
  { month: "Май", cash: 24_600_000, click: 29_900_000 },
  { month: "Июн", cash: 27_100_000, click: 33_500_000 },
];

const PAYMENT_SPLIT = [
  { name: "Click", value: 33_500_000 },
  { name: "Наличные", value: 27_100_000 },
  { name: "Перевод", value: 11_400_000 },
  { name: "Возвраты", value: 2_300_000 },
];

const BRANCH_DEBT = [
  { branch: "Чиланзар", overdue: 8_400_000, upcoming: 12_200_000 },
  { branch: "Юнусабад", overdue: 5_100_000, upcoming: 9_800_000 },
  { branch: "Сергели", overdue: 3_650_000, upcoming: 7_400_000 },
  { branch: "Самарканд", overdue: 2_150_000, upcoming: 6_100_000 },
];

const HEATMAP_DAYS = Array.from({ length: 28 }, (_, i) => ({
  date: `2026-10-${String(i + 1).padStart(2, "0")}`,
  label: `${i + 1}.10`,
  count: ((i * 7 + 3) % 18) + (i % 6 === 0 ? 0 : 2),
}));

const TABLE_ROWS = [
  {
    id: "st-1",
    student: "Azizbek Karimov",
    group: "Frontend Pro · G3",
    method: "Click",
    amount: 1_450_000,
    status: "paid" as const,
  },
  {
    id: "st-2",
    student: "Дильшод Рахимов",
    group: "IELTS 7.0 · Қ-1",
    method: "Наличные",
    amount: 950_000,
    status: "pending" as const,
  },
  {
    id: "st-3",
    student: "Madina Oʻrinboyeva",
    group: "Python Data · Ғ-2",
    method: "Перевод",
    amount: 1_800_000,
    status: "overdue" as const,
  },
  {
    id: "st-4",
    student: "Сардор Ҳасанов",
    group: "Математика · Ў-4",
    method: "Click",
    amount: 1_200_000,
    status: "paid" as const,
  },
];

export interface DevUiKitShowcaseProps {
  initialTheme?: "light" | "dark";
}

export function DevUiKitShowcase({ initialTheme = "light" }: DevUiKitShowcaseProps) {
  const { setTheme } = usePanelTheme();
  const [locale, setLocale] = React.useState<"ru" | "uz-Latn">("ru");
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [page, setPage] = React.useState(1);
  const [checkedA, setCheckedA] = React.useState<boolean | "indeterminate">(true);
  const [checkedB, setCheckedB] = React.useState(false);
  const [switchVal, setSwitchVal] = React.useState(true);
  const [roleSelect, setRoleSelect] = React.useState("director");

  React.useEffect(() => {
    if (initialTheme === "dark") {
      setTheme("dark");
    }
  }, [initialTheme, setTheme]);

  const filteredRows = TABLE_ROWS.filter((row) => {
    const matchesSearch =
      !search.trim() ||
      row.student.toLowerCase().includes(search.toLowerCase()) ||
      row.group.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || row.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const isUz = locale === "uz-Latn";

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background text-foreground">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
          <PageHeader
            locale={locale}
            breadcrumbs={[
              { label: "e-darischi", href: "/" },
              { label: "Developer", href: "/developer" },
              { label: "Dev UI Kit" },
            ]}
            title="Dev UI Kit"
            description={`Internal development component showroom. ${t(locale, "devUiKit.subtitle")}`}
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <div
                  role="group"
                  aria-label={t(locale, "common.language")}
                  className="inline-flex items-center rounded-md border border-border bg-muted p-0.5"
                >
                  <button
                    type="button"
                    aria-pressed={locale === "ru"}
                    onClick={() => setLocale("ru")}
                    className={`rounded px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      locale === "ru"
                        ? "bg-card text-foreground border border-border"
                        : "text-muted-foreground hover:text-foreground border border-transparent"
                    }`}
                  >
                    RU
                  </button>
                  <button
                    type="button"
                    aria-pressed={locale === "uz-Latn"}
                    onClick={() => setLocale("uz-Latn")}
                    className={`rounded px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      locale === "uz-Latn"
                        ? "bg-card text-foreground border border-border"
                        : "text-muted-foreground hover:text-foreground border border-transparent"
                    }`}
                  >
                    Oʻz
                  </button>
                </div>
                <ThemeToggle locale={locale} />
              </div>
            }
          />

          {/* KPI Metric Strip + Sparklines */}
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label={isUz ? "Oylik tushum" : "Выручка за месяц"}
              value={formatUzs(60_600_000, { locale })}
              delta={{ value: "+14.2%", tone: "positive" }}
              hint={isUz ? "Oʻtgan oyga nisbatan" : "К прошлому месяцу"}
            />
            <StatCard
              label={isUz ? "Faol oʻquvchilar" : "Активные ученики"}
              value="428"
              delta={{ value: "+18", tone: "positive" }}
              hint={isUz ? "6 ta oʻquv guruhida toʻlov faol" : "Оплаченный период активен"}
            />
            <StatCard
              label={isUz ? "Qarzdorlik" : "Просроченный долг"}
              value={formatUzs(19_300_000, { locale })}
              delta={{ value: "-6.4%", tone: "positive" }}
              hint={isUz ? "14 ta oʻquvchi boʻyicha" : "По 14 ученикам"}
            />
            <Card className="p-4 flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-medium text-muted-foreground">
                  {isUz ? "Click ulushi dinamikasi" : "Динамика Click-оплат"}
                </span>
                <span className="text-xs font-semibold text-primary tabular-nums">55%</span>
              </div>
              <Sparkline
                values={[28, 34, 39, 44, 49, 55]}
                tone="primary"
                label={isUz ? "Click ulushi oʻsishi" : "Тренд доли Click"}
              />
            </Card>
          </section>

          {/* Filter Bar + Table + Pagination */}
          <section className="space-y-3">
            <h2 className="font-display text-base font-semibold text-foreground">
              {t(locale, "devUiKit.dataAndNavigation")}
            </h2>
            <FilterBar
              locale={locale}
              search={search}
              onSearchChange={setSearch}
              hasActiveFilters={Boolean(search || statusFilter !== "all")}
              onReset={() => {
                setSearch("");
                setStatusFilter("all");
              }}
              actions={
                <Button size="sm">
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  <span>{t(locale, "common.create")}</span>
                </Button>
              }
            >
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-44" aria-label={t(locale, "common.status")}>
                  <SelectValue placeholder={t(locale, "common.status")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t(locale, "common.all")}</SelectItem>
                  <SelectItem value="paid">{isUz ? "Toʻlangan" : "Оплачено"}</SelectItem>
                  <SelectItem value="pending">{isUz ? "Kutilmoqda" : "Ожидает"}</SelectItem>
                  <SelectItem value="overdue">{isUz ? "Qarzdor" : "Просрочено"}</SelectItem>
                </SelectContent>
              </Select>
            </FilterBar>

            {filteredRows.length === 0 ? (
              <EmptyState
                locale={locale}
                title={t(locale, "devUiKit.emptyTitle")}
                description={t(locale, "devUiKit.emptyDescription")}
                action={
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSearch("");
                      setStatusFilter("all");
                    }}
                  >
                    {t(locale, "ui.clearFilters")}
                  </Button>
                }
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isUz ? "Oʻquvchi" : "Ученик"}</TableHead>
                    <TableHead>{isUz ? "Guruh" : "Группа"}</TableHead>
                    <TableHead>{isUz ? "Usul" : "Способ"}</TableHead>
                    <TableHead>{t(locale, "common.status")}</TableHead>
                    <TableHead className="text-right">{isUz ? "Summa" : "Сумма"}</TableHead>
                    <TableHead className="text-right">{t(locale, "common.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <Avatar name={row.student} size="sm" />
                          <span className="font-medium text-foreground">{row.student}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{row.group}</TableCell>
                      <TableCell>{row.method}</TableCell>
                      <TableCell>
                        {row.status === "paid" && (
                          <StatusDot tone="success" label={isUz ? "Toʻlangan" : "Оплачено"} />
                        )}
                        {row.status === "pending" && (
                          <StatusDot tone="warning" label={isUz ? "Kutilmoqda" : "Ожидает"} />
                        )}
                        {row.status === "overdue" && (
                          <StatusDot tone="destructive" label={isUz ? "Qarzdor" : "Просрочено"} />
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {formatUzs(row.amount, { locale })}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`${t(locale, "common.actions")}: ${row.student}`}
                            >
                              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>{t(locale, "devUiKit.dropdownLabel")}</DropdownMenuLabel>
                            <DropdownMenuItem>{t(locale, "common.edit")}</DropdownMenuItem>
                            <DropdownMenuItem>{t(locale, "common.export")}</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem destructive>{t(locale, "common.delete")}</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            <Pagination
              locale={locale}
              page={page}
              totalPages={5}
              totalItems={96}
              pageSize={20}
              onPageChange={setPage}
            />
          </section>

          {/* Charts Grid */}
          <section className="space-y-3">
            <h2 className="font-display text-base font-semibold text-foreground">
              {t(locale, "devUiKit.chartsSection")}
            </h2>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <AreaLineChart
                title={t(locale, "devUiKit.sampleRevenue")}
                subtitle={isUz ? "Soʻm, butun qiymatlar · Click va naqd" : "Сравнение поступлений: наличные и Click"}
                locale={locale}
                valueType="uzs"
                data={REVENUE_DATA}
                xKey="month"
                series={[
                  { key: "click", label: "Click" },
                  { key: "cash", label: isUz ? "Naqd" : "Наличные" },
                ]}
              />

              <DonutChart
                title={t(locale, "devUiKit.samplePayments")}
                subtitle={isUz ? "Joriy oy taqsimoti" : "Распределение поступлений за текущий месяц"}
                locale={locale}
                valueType="uzs"
                data={PAYMENT_SPLIT}
              />

              <BarChart
                title={t(locale, "devUiKit.sampleDebtByBranch")}
                subtitle={isUz ? "Muddati oʻtgan va yaqinlashayotgan toʻlovlar" : "Просрочено и к оплате по филиалам"}
                locale={locale}
                valueType="uzs"
                layout="horizontal"
                stacked
                data={BRANCH_DEBT}
                xKey="branch"
                series={[
                  { key: "overdue", label: isUz ? "Muddati oʻtgan" : "Просрочено" },
                  { key: "upcoming", label: isUz ? "Kutilayotgan" : "Ожидается" },
                ]}
              />

              <div className="space-y-4">
                <AttendanceHeatmap
                  title={t(locale, "devUiKit.sampleAttendance")}
                  subtitle={isUz ? "Soʻnggi 28 kunlik faollik" : "Отмеченные уроки за 28 дней"}
                  locale={locale}
                  data={HEATMAP_DAYS}
                />

                <Card>
                  <CardHeader>
                    <CardTitle>{t(locale, "devUiKit.sampleProgress")}</CardTitle>
                    <CardDescription>
                      {formatUzs(60_600_000, { locale })} / {formatUzs(72_000_000, { locale })}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <ProgressRing
                      value={84}
                      tone="primary"
                      label={isUz ? "Oylik reja" : "План месяца"}
                      caption={formatUzs(60_600_000, { locale })}
                    />
                    <div className="flex-1 space-y-3 sm:max-w-xs">
                      <ProgressBar
                        value={92}
                        tone="success"
                        label={isUz ? "Yunusobod filiali" : "Филиал Юнусабад"}
                      />
                      <ProgressBar
                        value={68}
                        tone="warning"
                        label={isUz ? "Chilonzor filiali" : "Филиал Чиланзар"}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </section>

          {/* Controls, Badges, Alerts & Overlays */}
          <Tabs defaultValue="controls">
            <TabsList>
              <TabsTrigger value="controls">{t(locale, "devUiKit.controlsSection")}</TabsTrigger>
              <TabsTrigger value="status">{t(locale, "devUiKit.badgesAndAlerts")}</TabsTrigger>
              <TabsTrigger value="overlays">{t(locale, "devUiKit.overlaysSection")}</TabsTrigger>
            </TabsList>

            <TabsContent value="controls">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Button</CardTitle>
                    <CardDescription>
                      {isUz ? "Variantlar va oʻlchamlar (tizimli fokus bilan)" : "Варианты, размеры и состояния"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="primary">Primary</Button>
                      <Button variant="secondary">Secondary</Button>
                      <Button variant="outline">Outline</Button>
                      <Button variant="ghost">Ghost</Button>
                      <Button variant="destructive">Destructive</Button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm">Small</Button>
                      <Button size="md">Medium</Button>
                      <Button size="lg">Large</Button>
                      <Button loading>Loading</Button>
                      <Button disabled>Disabled</Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Input, Select, Textarea, Checkbox, Switch</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="demo-name" required>
                          {isUz ? "F.I.Sh. (oʻzbekcha harflar)" : "ФИО ученика"}
                        </Label>
                        <Input
                          id="demo-name"
                          defaultValue={isUz ? "Gʻiyosiddin Oʻrinboyev · ҚҒЎҲ" : "Махмудова Камола"}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="demo-role">{isUz ? "Rol" : "Роль"}</Label>
                        <Select value={roleSelect} onValueChange={setRoleSelect}>
                          <SelectTrigger id="demo-role">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="director">{t(locale, "roles.DIRECTOR")}</SelectItem>
                            <SelectItem value="center_admin">{t(locale, "roles.CENTER_ADMIN")}</SelectItem>
                            <SelectItem value="teacher">{t(locale, "roles.TEACHER")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="demo-note">{isUz ? "Izoh" : "Комментарий"}</Label>
                      <Textarea
                        id="demo-note"
                        placeholder={isUz ? "Maʼlumot kiriting..." : "Введите примечание..."}
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-5 pt-1">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="chk-a"
                          checked={checkedA}
                          onCheckedChange={(v) => setCheckedA(Boolean(v))}
                        />
                        <Label htmlFor="chk-a">{isUz ? "Faol shartnoma" : "Договор активен"}</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="chk-b"
                          checked={checkedB}
                          onCheckedChange={(v) => setCheckedB(Boolean(v))}
                        />
                        <Label htmlFor="chk-b">{isUz ? "Avto-eslatma" : "Авто-напоминание"}</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch id="sw-sms" checked={switchVal} onCheckedChange={setSwitchVal} />
                        <Label htmlFor="sw-sms">{isUz ? "SMS Eskiz" : "SMS Eskiz"}</Label>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="status">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Badge & StatusDot</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="neutral">Neutral</Badge>
                      <Badge variant="primary">Primary</Badge>
                      <Badge variant="success">Paid · 100%</Badge>
                      <Badge variant="warning">Due · 3d</Badge>
                      <Badge variant="destructive">Overdue</Badge>
                      <Badge variant="info">Click Online</Badge>
                    </div>
                    <div className="flex flex-wrap gap-4 border-t border-border pt-3">
                      <StatusDot tone="success" label={isUz ? "Faol" : "Активен"} />
                      <StatusDot tone="warning" label={isUz ? "Muzlatilgan" : "Заморозка"} />
                      <StatusDot tone="destructive" label={isUz ? "Bloklangan" : "Заблокирован"} />
                      <StatusDot tone="info" label={isUz ? "Tekshiruvda" : "На проверке"} />
                      <StatusDot tone="neutral" label={isUz ? "Arxiv" : "Архив"} />
                    </div>
                    <div className="space-y-2 border-t border-border pt-3">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                  </CardContent>
                </Card>

                <div className="space-y-2.5">
                  <Alert variant="info">
                    <AlertTitle>{t(locale, "common.status")}</AlertTitle>
                    <AlertDescription>{t(locale, "devUiKit.popoverBody")}</AlertDescription>
                  </Alert>
                  <Alert variant="success">
                    <AlertTitle>{t(locale, "common.success")}</AlertTitle>
                    <AlertDescription>{formatUzs(1_450_000, { locale })}</AlertDescription>
                  </Alert>
                  <Alert variant="warning">
                    <AlertTitle>{t(locale, "common.warning")}</AlertTitle>
                    <AlertDescription>{t(locale, "dashboard.suspendedNotice")}</AlertDescription>
                  </Alert>
                  <Alert variant="destructive">
                    <AlertTitle>{t(locale, "common.error")}</AlertTitle>
                    <AlertDescription>{t(locale, "charts.error")}</AlertDescription>
                  </Alert>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="overlays">
              <Card>
                <CardHeader>
                  <CardTitle>Dialog, Sheet, Popover, Tooltip</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center gap-3">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline">{t(locale, "devUiKit.openDialog")}</Button>
                    </DialogTrigger>
                    <DialogContent locale={locale}>
                      <DialogHeader>
                        <DialogTitle>{t(locale, "devUiKit.dialogTitle")}</DialogTitle>
                        <DialogDescription>{t(locale, "devUiKit.dialogDescription")}</DialogDescription>
                      </DialogHeader>
                      <div className="text-sm text-foreground tabular-nums">
                        {formatUzs(2_900_000, { locale })}
                      </div>
                      <DialogFooter>
                        <Button variant="secondary">{t(locale, "common.cancel")}</Button>
                        <Button>{t(locale, "common.confirm")}</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <Sheet>
                    <SheetTrigger asChild>
                      <Button variant="outline">
                        <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                        <span>{t(locale, "devUiKit.openSheet")}</span>
                      </Button>
                    </SheetTrigger>
                    <SheetContent locale={locale}>
                      <SheetHeader>
                        <SheetTitle>{t(locale, "devUiKit.sheetTitle")}</SheetTitle>
                        <SheetDescription>{t(locale, "devUiKit.sheetDescription")}</SheetDescription>
                      </SheetHeader>
                      <div className="space-y-3 py-2">
                        <Label htmlFor="sheet-branch">{isUz ? "Filial" : "Филиал"}</Label>
                        <Input id="sheet-branch" defaultValue="Chilonzor" />
                      </div>
                      <SheetFooter>
                        <Button>{t(locale, "common.save")}</Button>
                      </SheetFooter>
                    </SheetContent>
                  </Sheet>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="secondary">{t(locale, "devUiKit.popoverLabel")}</Button>
                    </PopoverTrigger>
                    <PopoverContent>{t(locale, "devUiKit.popoverBody")}</PopoverContent>
                  </Popover>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost">{t(locale, "devUiKit.tooltipTrigger")}</Button>
                    </TooltipTrigger>
                    <TooltipContent>{t(locale, "devUiKit.tooltipBody")}</TooltipContent>
                  </Tooltip>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Dual Light vs Dark Preview Cards */}
          <section className="space-y-3">
            <h2 className="font-display text-base font-semibold text-foreground">
              {t(locale, "devUiKit.themeComparison")}
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div
                className="panel-shell rounded-lg border border-border bg-background p-4 text-foreground space-y-3"
                data-panel-theme="light"
                data-resolved-theme="light"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    {t(locale, "devUiKit.lightSurface")}
                  </span>
                  <StatusDot tone="success" label="Light AA" />
                </div>
                <Card>
                  <CardHeader>
                    <CardTitle>{isUz ? "Toʻlov rejasi" : "План поступлений"}</CardTitle>
                    <CardDescription>{formatUzs(12_450_000, { locale })}</CardDescription>
                  </CardHeader>
                  <CardFooter>
                    <Badge variant="primary">Click</Badge>
                    <Button size="sm">{t(locale, "common.save")}</Button>
                  </CardFooter>
                </Card>
              </div>

              <div
                className="panel-shell dark rounded-lg border border-border bg-background p-4 text-foreground space-y-3"
                data-panel-theme="dark"
                data-resolved-theme="dark"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    {t(locale, "devUiKit.darkSurface")}
                  </span>
                  <StatusDot tone="success" label="Dark AA" />
                </div>
                <Card>
                  <CardHeader>
                    <CardTitle>{isUz ? "Toʻlov rejasi" : "План поступлений"}</CardTitle>
                    <CardDescription>{formatUzs(12_450_000, { locale })}</CardDescription>
                  </CardHeader>
                  <CardFooter>
                    <Badge variant="primary">Click</Badge>
                    <Button size="sm">{t(locale, "common.save")}</Button>
                  </CardFooter>
                </Card>
              </div>
            </div>
          </section>
        </div>
      </div>
    </TooltipProvider>
  );
}

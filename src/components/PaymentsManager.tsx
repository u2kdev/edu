"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Printer,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Download,
  RotateCcw,
  CreditCard,
  Snowflake,
  Tag,
  ExternalLink,
  Banknote,
  Building2,
} from "lucide-react";
import type { StudentBalanceSummaryDTO, StudentReceiptDTO } from "@/lib/student-balance";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FilterBar } from "@/components/ui/filter-bar";
import { FormActions, FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";

const SELECT_CLS =
  "flex h-9 w-full rounded-md border border-input bg-card px-3 py-1.5 text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50";

export interface PaymentItem {
  id: string;
  studentMembershipId?: string;
  amount: number;
  originalAmount?: number | null;
  discountAmount?: number;
  discountReason?: string | null;
  refundedAmount?: number;
  manualRefundStatus?: "NONE" | "PENDING_MANUAL" | "COMPLETED" | string;
  manualRefundNote?: string | null;
  manualRefundCompletedAt?: Date | string | null;
  receiptNumber?: string | null;
  paymentIntentId?: string | null;
  periodMonths?: number | null;
  periodStart?: Date | string | null;
  periodEnd?: Date | string | null;
  promoCode?: { code: string } | null;
  currency: string;
  status: string;
  paymentMethod: string | null;
  paidAt?: Date | string | null;
  createdAt?: Date | string;
  student: {
    user: { fullName: string; email?: string };
  };
  group?: { name: string } | null;
}

export interface StudentSelectItem {
  id: string;
  user: { fullName: string; email?: string };
  enrollments?: Array<{
    id: string;
    groupId: string;
    paidUntil?: Date | string | null;
    status: string;
  }>;
}

export interface GroupOptionItem {
  id: string;
  name: string;
  course?: { id?: string; title: string; priceMonthly: number } | null;
  pricingPlans?: Array<{ periodMonths: number; price: number }>;
}

interface PaymentsManagerProps {
  initialPayments: PaymentItem[];
  students: StudentSelectItem[];
  groups?: GroupOptionItem[];
  role?: string;
  studentBalances?: StudentBalanceSummaryDTO[];
  centerName?: string;
  canDiscount?: boolean;
  canRefund?: boolean;
  allowAdminDiscount?: boolean;
  merchantVerified?: boolean;
}

interface PromoCheckState {
  valid: boolean;
  code: string;
  discountAmount: number;
  finalAmount: number;
  message?: string;
}

interface ClickIntentState {
  groupName: string;
  periodMonths: 1 | 2 | 3;
  amount: number;
  clickUrl: string;
  qrDataUrl: string;
  merchantTransId: string;
}

export default function PaymentsManager({
  initialPayments,
  students,
  groups = [],
  role,
  studentBalances = [],
  centerName = "Учебный центр",
  canDiscount = false,
  canRefund = false,
  allowAdminDiscount = true,
  merchantVerified = false,
}: PaymentsManagerProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [studentMembershipId, setStudentMembershipId] = useState(students[0]?.id || "");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [periodMonths, setPeriodMonths] = useState<1 | 2 | 3>(1);
  const [promoCode, setPromoCode] = useState("");
  const [promoCheck, setPromoCheck] = useState<PromoCheckState | null>(null);
  const [promoChecking, setPromoChecking] = useState(false);
  const [manualDiscountAmount, setManualDiscountAmount] = useState("");
  const [discountReason, setDiscountReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [recordError, setRecordError] = useState("");

  const [refundTarget, setRefundTarget] = useState<PaymentItem | null>(null);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refundLoading, setRefundLoading] = useState(false);
  const [refundError, setRefundError] = useState("");

  const [manualRefundTarget, setManualRefundTarget] = useState<PaymentItem | null>(null);
  const [manualRefundNote, setManualRefundNote] = useState("");
  const [manualRefundDate, setManualRefundDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [manualRefundLoading, setManualRefundLoading] = useState(false);
  const [manualRefundError, setManualRefundError] = useState("");

  const [clickTarget, setClickTarget] = useState<{
    studentMembershipId: string;
    groupId: string;
    groupName: string;
    priceMonthly: number;
    pricing: Array<{ periodMonths: number; price: number }>;
  } | null>(null);
  const [clickPeriod, setClickPeriod] = useState<1 | 2 | 3>(1);
  const [clickPromo, setClickPromo] = useState("");
  const [clickPromoCheck, setClickPromoCheck] = useState<PromoCheckState | null>(null);
  const [clickLoading, setClickLoading] = useState(false);
  const [clickError, setClickError] = useState("");
  const [clickIntent, setClickIntent] = useState<ClickIntentState | null>(null);

  const [selectedChildId, setSelectedChildId] = useState<string>(
    studentBalances[0]?.studentMembershipId || ""
  );
  const [activeReceipt, setActiveReceipt] = useState<StudentReceiptDTO | null>(null);

  const canManage = role === "DIRECTOR" || role === "CENTER_ADMIN" || role === "ACCOUNTANT";
  const isStudentOrParent = role === "STUDENT" || role === "PARENT";
  const effectiveCanDiscount =
    canDiscount && (role !== "CENTER_ADMIN" || allowAdminDiscount);

  const activeBalance =
    studentBalances.find((b) => b.studentMembershipId === selectedChildId) ||
    studentBalances[0] ||
    null;

  const balanceByStudentId = useMemo(
    () => new Map(studentBalances.map((b) => [b.studentMembershipId, b])),
    [studentBalances]
  );
  const totalStaffDebt = studentBalances.reduce((sum, b) => sum + b.debtAmount, 0);
  const staffDebtorsCount = studentBalances.filter((b) => b.debtAmount > 0).length;
  const pendingManualRefundsCount = initialPayments.filter(
    (p) =>
      p.paymentMethod === "ONLINE" &&
      (p.refundedAmount ?? 0) > 0 &&
      p.manualRefundStatus === "PENDING_MANUAL"
  ).length;

  const getGroupTariffPrice = (groupId: string, months: 1 | 2 | 3): number | null => {
    const grp = groups.find((g) => g.id === groupId);
    if (!grp) return null;
    const plan = grp.pricingPlans?.find((p) => p.periodMonths === months);
    if (plan) return plan.price;
    if (grp.course?.priceMonthly != null) {
      return grp.course.priceMonthly * months;
    }
    return null;
  };

  const getClickTariffPrice = (months: 1 | 2 | 3): number => {
    if (!clickTarget) return 0;
    const plan = clickTarget.pricing.find((p) => p.periodMonths === months);
    if (plan) return plan.price;
    return clickTarget.priceMonthly * months;
  };

  const selectedStudentObj = students.find((s) => s.id === studentMembershipId);
  const studentGroups = selectedStudentObj?.enrollments?.length
    ? groups.filter((g) => selectedStudentObj.enrollments?.some((e) => e.groupId === g.id))
    : groups;

  const applyTariffToAmount = (
    groupId: string,
    months: 1 | 2 | 3,
    promoDiscount: number,
    manualDiscountStr: string
  ) => {
    const base = getGroupTariffPrice(groupId, months);
    if (base == null) return;
    const manual = Math.max(0, parseInt(manualDiscountStr || "0", 10) || 0);
    setAmount(String(Math.max(0, base - promoDiscount - manual)));
  };

  const handleValidatePromo = async (
    codeValue: string,
    subtotal: number,
    groupId: string,
    target: "staff" | "click"
  ) => {
    const trimmed = codeValue.trim();
    if (!trimmed) {
      if (target === "staff") setPromoCheck(null);
      else setClickPromoCheck(null);
      return;
    }
    if (target === "staff") setPromoChecking(true);
    try {
      const qs = new URLSearchParams({
        validateCode: trimmed,
        subtotal: String(Math.max(0, subtotal)),
      });
      if (groupId) qs.set("groupId", groupId);
      const res = await fetch(`/api/promo-codes?${qs.toString()}`);
      const data = await res.json();
      if (res.ok && data.valid) {
        const result: PromoCheckState = {
          valid: true,
          code: data.promo.code,
          discountAmount: data.discountAmount,
          finalAmount: data.finalAmount,
        };
        if (target === "staff") {
          setPromoCheck(result);
          if (selectedGroupId) {
            applyTariffToAmount(selectedGroupId, periodMonths, data.discountAmount, manualDiscountAmount);
          }
        } else {
          setClickPromoCheck(result);
        }
      } else {
        const fail: PromoCheckState = {
          valid: false,
          code: trimmed,
          discountAmount: 0,
          finalAmount: subtotal,
          message: data.error || "Промокод недействителен",
        };
        if (target === "staff") setPromoCheck(fail);
        else setClickPromoCheck(fail);
      }
    } catch {
      const fail: PromoCheckState = {
        valid: false,
        code: trimmed,
        discountAmount: 0,
        finalAmount: subtotal,
        message: "Ошибка проверки промокода",
      };
      if (target === "staff") setPromoCheck(fail);
      else setClickPromoCheck(fail);
    } finally {
      if (target === "staff") setPromoChecking(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setRecordError("");

    try {
      const payload: Record<string, unknown> = {
        studentMembershipId,
        amount,
        paymentMethod,
      };
      if (selectedGroupId) {
        payload.groupId = selectedGroupId;
        payload.periodMonths = periodMonths;
      }
      if (promoCode.trim()) {
        payload.promoCode = promoCode.trim();
      }
      const manualNum = parseInt(manualDiscountAmount || "0", 10) || 0;
      if (effectiveCanDiscount && manualNum > 0) {
        payload.manualDiscountAmount = manualNum;
        if (discountReason.trim()) {
          payload.discountReason = discountReason.trim();
        }
      }

      const res = await fetch("/api/center-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setShowModal(false);
        setAmount("");
        setSelectedGroupId("");
        setPeriodMonths(1);
        setPromoCode("");
        setPromoCheck(null);
        setManualDiscountAmount("");
        setDiscountReason("");
        router.refresh();
      } else {
        setRecordError(data.error || "Ошибка сохранения оплаты");
      }
    } catch {
      setRecordError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  };

  const handleRefundSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundTarget) return;
    setRefundLoading(true);
    setRefundError("");
    try {
      const parsedAmount = parseInt(refundAmount || "0", 10);
      const res = await fetch(`/api/center-payments/${refundTarget.id}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(parsedAmount > 0 ? { amount: parsedAmount } : {}),
          reason: refundReason.trim() || "Возврат средств",
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setRefundTarget(null);
        setRefundAmount("");
        setRefundReason("");
        router.refresh();
      } else {
        setRefundError(data.error || "Ошибка возврата");
      }
    } catch {
      setRefundError("Ошибка сети");
    } finally {
      setRefundLoading(false);
    }
  };

  const handleManualRefundCompleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualRefundTarget) return;
    setManualRefundLoading(true);
    setManualRefundError("");
    try {
      const res = await fetch(
        `/api/center-payments/${manualRefundTarget.id}/manual-refund-complete`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            note: manualRefundNote.trim() || "Возврат выполнен в кабинете Click",
            ...(manualRefundDate
              ? { completedAt: new Date(`${manualRefundDate}T12:00:00+05:00`).toISOString() }
              : {}),
          }),
        }
      );
      const data = await res.json();
      if (res.ok) {
        setManualRefundTarget(null);
        setManualRefundNote("");
        router.refresh();
      } else {
        setManualRefundError(data.error || "Ошибка подтверждения возврата Click");
      }
    } catch {
      setManualRefundError("Ошибка сети");
    } finally {
      setManualRefundLoading(false);
    }
  };

  const handleCreateClickIntent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clickTarget) return;
    setClickLoading(true);
    setClickError("");
    try {
      const res = await fetch("/api/payments/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentMembershipId: clickTarget.studentMembershipId,
          groupId: clickTarget.groupId,
          periodMonths: clickPeriod,
          ...(clickPromo.trim() ? { promoCode: clickPromo.trim() } : {}),
        }),
      });
      const data = await res.json();
      if (res.ok && data.clickUrl) {
        setClickIntent({
          groupName: clickTarget.groupName,
          periodMonths: clickPeriod,
          amount: data.intent.amount,
          clickUrl: data.clickUrl,
          qrDataUrl: data.qrDataUrl,
          merchantTransId: data.intent.merchantTransId,
        });
      } else {
        setClickError(data.error || "Ошибка создания платежа Click");
      }
    } catch {
      setClickError("Ошибка сети");
    } finally {
      setClickLoading(false);
    }
  };

  const formatDate = (dateValue?: Date | string | null) => {
    if (!dateValue) return "—";
    return new Date(dateValue).toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  const openReceiptForPayment = (p: PaymentItem) => {
    const matchedReceipt = activeBalance?.payments.find((r) => r.id === p.id);
    if (matchedReceipt) {
      setActiveReceipt(matchedReceipt);
      return;
    }
    setActiveReceipt({
      id: p.id,
      receiptNumber: p.receiptNumber || `INV-${p.id.slice(0, 8).toUpperCase()}`,
      studentMembershipId: "",
      studentName: p.student.user.fullName,
      groupName: p.group?.name || null,
      courseTitle: null,
      amount: p.amount,
      refundedAmount: p.refundedAmount ?? 0,
      originalAmount: p.originalAmount ?? p.amount,
      discountPercent: null,
      discountReason: p.discountReason ?? null,
      promoCodeUsed: p.promoCode?.code || null,
      currency: p.currency,
      status: p.status,
      paymentMethod: p.paymentMethod,
      periodMonths: p.periodMonths ?? null,
      periodStart: p.periodStart ? new Date(p.periodStart).toISOString() : null,
      periodEnd: p.periodEnd ? new Date(p.periodEnd).toISOString() : null,
      paidAt: p.paidAt ? new Date(p.paidAt).toISOString() : null,
      createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString(),
      center: {
        name: centerName,
        legalName: null,
        inn: null,
        address: null,
        phone: null,
      },
    });
  };

  const filteredPayments = useMemo(() => {
    const q = search.trim().toLowerCase();
    return initialPayments.filter((p) => {
      if (statusFilter && p.status !== statusFilter) return false;
      if (!q) return true;
      return (
        p.student.user.fullName.toLowerCase().includes(q) ||
        (p.group?.name?.toLowerCase().includes(q) ?? false) ||
        (p.receiptNumber?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [initialPayments, search, statusFilter]);

  const renderMethod = (p: PaymentItem) => {
    if (p.paymentMethod === "CASH") {
      return (
        <span className="inline-flex items-center gap-1.5 text-foreground">
          <Banknote className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
          <span>Наличные / Касса</span>
        </span>
      );
    }
    if (p.paymentMethod === "ONLINE") {
      return (
        <span className="inline-flex items-center gap-1.5 text-foreground">
          <CreditCard className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
          <span>{p.paymentIntentId ? "Click Онлайн" : "Онлайн эквайринг"}</span>
        </span>
      );
    }
    if (p.paymentMethod === "BANK_TRANSFER") {
      return (
        <span className="inline-flex items-center gap-1.5 text-foreground">
          <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
          <span>Банковский перевод</span>
        </span>
      );
    }
    return <span className="text-muted-foreground">{p.paymentMethod || "Не указан"}</span>;
  };

  const statusVariant = (status: string) => {
    if (status === "PAID") return "success" as const;
    if (status === "PENDING") return "warning" as const;
    if (status === "PARTIALLY_PAID") return "info" as const;
    return "destructive" as const;
  };

  const columns: DataTableColumn<PaymentItem>[] = [
    {
      id: "student",
      header: "Ученик",
      sortable: true,
      sortValue: (p) => p.student.user.fullName,
      cell: (p) => (
        <div className="space-y-0.5">
          <div className="font-medium text-foreground">{p.student.user.fullName}</div>
          {(p.group?.name || p.student.user.email) && (
            <div className="text-xs text-muted-foreground">
              {p.group?.name || p.student.user.email}
            </div>
          )}
          {canManage &&
            p.studentMembershipId &&
            (balanceByStudentId.get(p.studentMembershipId)?.debtAmount ?? 0) > 0 && (
              <div className="text-xs text-destructive tabular-nums">
                Долг ученика:{" "}
                {balanceByStudentId
                  .get(p.studentMembershipId)!
                  .debtAmount.toLocaleString("ru-RU")}{" "}
                UZS
              </div>
            )}
          {(p.receiptNumber || p.periodMonths) && (
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground tabular-nums">
              {p.receiptNumber && <span className="font-mono">{p.receiptNumber}</span>}
              {p.periodMonths && <span>· {p.periodMonths} мес.</span>}
              {p.promoCode?.code && (
                <span className="text-foreground">· {p.promoCode.code}</span>
              )}
            </div>
          )}
        </div>
      ),
    },
    {
      id: "amount",
      header: "Сумма",
      align: "right",
      sortable: true,
      sortValue: (p) => p.amount,
      cell: (p) => (
        <div className="space-y-0.5 text-right tabular-nums">
          <div className="font-semibold text-success">
            {p.amount.toLocaleString("ru-RU")} {p.currency}
          </div>
          {(p.discountAmount ?? 0) > 0 && (
            <div className="text-xs text-warning">
              Скидка: -{(p.discountAmount ?? 0).toLocaleString("ru-RU")} {p.currency}
            </div>
          )}
          {(p.refundedAmount ?? 0) > 0 && (
            <div className="text-xs text-destructive">
              Возврат: -{(p.refundedAmount ?? 0).toLocaleString("ru-RU")} {p.currency}
            </div>
          )}
          {p.paymentMethod === "ONLINE" &&
            (p.refundedAmount ?? 0) > 0 &&
            p.manualRefundStatus === "PENDING_MANUAL" && (
              <div className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-warning">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>Вернуть деньги в кабинете Click (не подтверждено)</span>
              </div>
            )}
          {p.paymentMethod === "ONLINE" &&
            (p.refundedAmount ?? 0) > 0 &&
            p.manualRefundStatus === "COMPLETED" && (
              <div className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-success">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>
                  Возврат в Click подтверждён
                  {p.manualRefundCompletedAt ? ` (${formatDate(p.manualRefundCompletedAt)})` : ""}
                </span>
              </div>
            )}
        </div>
      ),
    },
    {
      id: "method",
      header: "Способ оплаты",
      cell: (p) => renderMethod(p),
    },
    {
      id: "status",
      header: "Статус",
      sortable: true,
      sortValue: (p) => p.status,
      cell: (p) => (
        <Badge variant={statusVariant(p.status)}>
          {p.status}
        </Badge>
      ),
    },
    {
      id: "paidAt",
      header: "Дата оплаты",
      sortable: true,
      sortValue: (p) => new Date(p.paidAt || p.createdAt || 0).getTime(),
      cell: (p) => (
        <span className="text-xs text-muted-foreground tabular-nums">
          {formatDate(p.paidAt || p.createdAt)}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Квитанция",
      align: "right",
      cell: (p) => (
        <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => openReceiptForPayment(p)}
          >
            <Printer className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Квитанция</span>
          </Button>
          <a href={`/api/payments/${p.id}/receipt`} target="_blank" rel="noopener noreferrer">
            <Button type="button" variant="outline" size="sm" title="Скачать PDF квитанцию">
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>PDF</span>
            </Button>
          </a>
          {canRefund &&
            p.paymentMethod === "ONLINE" &&
            (p.refundedAmount ?? 0) > 0 &&
            p.manualRefundStatus === "PENDING_MANUAL" && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setManualRefundError("");
                  setManualRefundTarget(p);
                  setManualRefundNote(p.manualRefundNote || "Возврат выполнен в кабинете Click");
                  setManualRefundDate(new Date().toISOString().slice(0, 10));
                }}
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-warning" aria-hidden="true" />
                <span>Возврат выполнен</span>
              </Button>
            )}
          {canRefund &&
            (p.status === "PAID" || p.status === "PARTIALLY_PAID") &&
            p.amount - (p.refundedAmount ?? 0) > 0 && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => {
                  const remaining = Math.max(1, p.amount - (p.refundedAmount ?? 0));
                  setRefundError("");
                  setRefundTarget(p);
                  setRefundAmount(String(remaining));
                  setRefundReason("");
                }}
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Возврат</span>
              </Button>
            )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Оплаты и квитанции"
        description={
          isStudentOrParent
            ? "Баланс обучения, счета Click и история платежей"
            : "Приём платежей, квитанции и контроль возвратов"
        }
        actions={
          canManage ? (
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setRecordError("");
                setShowModal(true);
              }}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>Зафиксировать платёж</span>
            </Button>
          ) : undefined
        }
      />

      <Alert variant="success">
        <AlertTitle>0% комиссия платформы</AlertTitle>
        <AlertDescription>
          Все полученные деньги идут на 100% на счет или в кассу вашего учебного центра.
          Платформа взимает только фиксированную ежемесячную подписку за аренду LMS.
        </AlertDescription>
      </Alert>

      {canManage && studentBalances.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Должников" value={staffDebtorsCount} />
          <StatCard
            label="Общий долг учеников"
            value={`${totalStaffDebt.toLocaleString("ru-RU")} UZS`}
            hint={totalStaffDebt > 0 ? "Требуется контроль оплат" : "Задолженности нет"}
          />
        </div>
      )}

      {canManage && pendingManualRefundsCount > 0 && (
        <Alert variant="warning">
          <AlertDescription>
            Требуют возврата в кабинете Click:{" "}
            <strong className="tabular-nums">{pendingManualRefundsCount}</strong>
          </AlertDescription>
        </Alert>
      )}

      {/* Parent Child Selector */}
      {role === "PARENT" && studentBalances.length > 1 && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-2 p-3">
            <span className="mr-2 text-xs font-medium text-muted-foreground">Ребёнок:</span>
            {studentBalances.map((child) => {
              const active = activeBalance?.studentMembershipId === child.studentMembershipId;
              return (
                <Button
                  key={child.studentMembershipId}
                  type="button"
                  size="sm"
                  variant={active ? "primary" : "outline"}
                  onClick={() => setSelectedChildId(child.studentMembershipId)}
                >
                  <span>{child.fullName}</span>
                  {child.debtAmount > 0 && (
                    <Badge variant="destructive" className="ml-1.5 tabular-nums">
                      Долг: {child.debtAmount.toLocaleString("ru-RU")} UZS
                    </Badge>
                  )}
                </Button>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Student / Parent Balance Overview */}
      {isStudentOrParent && activeBalance && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Текущий долг"
              value={`${activeBalance.debtAmount.toLocaleString("ru-RU")} UZS`}
              hint={
                activeBalance.debtAmount > 0
                  ? "Требуется погашение задолженности"
                  : activeBalance.overpaidAmount > 0
                  ? `Переплата: ${activeBalance.overpaidAmount.toLocaleString("ru-RU")} UZS`
                  : "Задолженности нет"
              }
            />
            <StatCard
              label="Ближайший платёж"
              value={
                activeBalance.nextPayment
                  ? `${activeBalance.nextPayment.amount.toLocaleString("ru-RU")} UZS`
                  : "Нет активных счетов"
              }
              hint={
                activeBalance.nextPayment
                  ? `До ${formatDate(activeBalance.nextPayment.dueDate)} · ${
                      activeBalance.nextPayment.description
                    }`
                  : "Все начисления оплачены"
              }
            />
            <StatCard
              label="Всего оплачено"
              value={`${activeBalance.totalPaid.toLocaleString("ru-RU")} UZS`}
              hint={`Начислено за весь период: ${activeBalance.totalAccrued.toLocaleString(
                "ru-RU"
              )} UZS`}
            />
            <StatCard
              label="Ежемесячный тариф"
              value={`${activeBalance.monthlyTuition.toLocaleString("ru-RU")} UZS`}
              hint={`Активных групп: ${activeBalance.enrollments.length}`}
            />
          </div>

          {activeBalance.enrollments.length > 0 && (
            <Card>
              <CardHeader className="flex flex-col gap-1 pb-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-sm">
                  Группы и оплаченный период ({activeBalance.fullName})
                </CardTitle>
                {!merchantVerified && (
                  <span className="text-xs text-muted-foreground">
                    Онлайн-оплата Click пока не подключена для этого центра
                  </span>
                )}
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-3 pt-0 md:grid-cols-2">
                {activeBalance.enrollments.map((en) => (
                  <div
                    key={en.enrollmentId}
                    className="flex flex-col justify-between gap-3 rounded-lg border border-border bg-muted/40 p-3.5 sm:flex-row sm:items-center"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">
                          {en.groupName}
                        </span>
                        {en.status === "FROZEN" ? (
                          <Badge variant="info">
                            <Snowflake className="mr-1 h-3 w-3" aria-hidden="true" />
                            Заморожен
                          </Badge>
                        ) : en.isOverdue ? (
                          <Badge variant="destructive">
                            Просрочено
                          </Badge>
                        ) : en.daysRemaining != null ? (
                          <Badge variant="success">
                            Осталось {en.daysRemaining} дн.
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {en.courseTitle} · {en.priceMonthly.toLocaleString("ru-RU")} UZS/мес.
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Оплачено до:{" "}
                        <span className="font-medium text-foreground tabular-nums">
                          {en.paidUntil ? formatDate(en.paidUntil) : "не оплачено"}
                        </span>
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:items-end">
                      <span className="text-sm font-semibold text-foreground tabular-nums">
                        {en.openChargesAmount > 0
                          ? `К оплате: ${en.openChargesAmount.toLocaleString("ru-RU")} UZS`
                          : `${en.accruedAmount.toLocaleString("ru-RU")} UZS`}
                      </span>
                      {en.status !== "DROPPED" && en.status !== "COMPLETED" && (
                        <Button
                          type="button"
                          size="sm"
                          disabled={!merchantVerified}
                          onClick={() => {
                            setClickError("");
                            setClickTarget({
                              studentMembershipId: activeBalance.studentMembershipId,
                              groupId: en.groupId,
                              groupName: en.groupName,
                              priceMonthly: en.priceMonthly,
                              pricing: en.pricing,
                            });
                            setClickPeriod(1);
                            setClickPromo("");
                            setClickPromoCheck(null);
                            setClickIntent(null);
                          }}
                          title={
                            merchantVerified
                              ? "Оплатить онлайн через Click"
                              : "Онлайн-оплата Click недоступна — мерчант центра не настроен"
                          }
                        >
                          <CreditCard className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Оплатить через Click</span>
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {initialPayments.length > 0 && (
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Поиск по ученику, группе или квитанции..."
          hasActiveFilters={Boolean(search || statusFilter)}
          onReset={() => {
            setSearch("");
            setStatusFilter("");
          }}
        >
          <select
            aria-label="Статус оплаты"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={`${SELECT_CLS} w-44 text-[13px]`}
          >
            <option value="">Все статусы</option>
            <option value="PAID">PAID</option>
            <option value="PENDING">PENDING</option>
            <option value="PARTIALLY_PAID">PARTIALLY_PAID</option>
            <option value="REFUNDED">REFUNDED</option>
          </select>
        </FilterBar>
      )}

      <DataTable
        data={filteredPayments}
        columns={columns}
        getRowId={(p) => p.id}
        emptyTitle="История оплат пока пуста."
        emptyDescription={
          canManage
            ? "Зафиксируйте первую оплату ученика вручную или дождитесь онлайн-платежа Click."
            : "Здесь будут отображаться все ваши платежи и квитанции."
        }
        mobileCardRender={(p) => (
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate font-medium text-foreground">
                  {p.student.user.fullName}
                </div>
                <div className="text-xs text-muted-foreground">
                  {p.group?.name || p.student.user.email || "—"}
                </div>
              </div>
              <Badge variant={statusVariant(p.status)}>
                {p.status}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs tabular-nums">
              <span className="font-semibold text-success">
                {p.amount.toLocaleString("ru-RU")} {p.currency}
              </span>
              <span className="text-muted-foreground">{formatDate(p.paidAt || p.createdAt)}</span>
            </div>
            <div className="text-xs">{renderMethod(p)}</div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => openReceiptForPayment(p)}
              >
                <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Квитанция</span>
              </Button>
              <a href={`/api/payments/${p.id}/receipt`} target="_blank" rel="noopener noreferrer">
                <Button type="button" variant="outline" size="sm">
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>PDF</span>
                </Button>
              </a>
            </div>
          </div>
        )}
      />

      {/* Printable Receipt Modal */}
      <Dialog open={Boolean(activeReceipt)} onOpenChange={(open) => !open && setActiveReceipt(null)}>
        <DialogContent className="max-w-md">
          {activeReceipt && (
            <>
              <DialogHeader>
                <p className="text-xs font-medium text-muted-foreground">Платёжная квитанция</p>
                <DialogTitle>№ {activeReceipt.receiptNumber}</DialogTitle>
              </DialogHeader>

              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Учебный центр:</span>
                  <span className="font-medium text-foreground">{activeReceipt.center.name}</span>
                </div>
                {activeReceipt.center.inn && (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">ИНН:</span>
                    <span className="text-foreground tabular-nums">{activeReceipt.center.inn}</span>
                  </div>
                )}
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Ученик:</span>
                  <span className="font-medium text-foreground">{activeReceipt.studentName}</span>
                </div>
                {activeReceipt.groupName && (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Группа:</span>
                    <span className="text-foreground">{activeReceipt.groupName}</span>
                  </div>
                )}
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Способ оплаты:</span>
                  <span className="text-foreground">{activeReceipt.paymentMethod || "CASH"}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Статус:</span>
                  <Badge variant={statusVariant(activeReceipt.status)}>
                    {activeReceipt.status}
                  </Badge>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Дата:</span>
                  <span className="text-foreground tabular-nums">
                    {formatDate(activeReceipt.paidAt || activeReceipt.createdAt)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between border-t border-border pt-3">
                  <span className="font-medium text-foreground">Итоговая сумма:</span>
                  <span className="text-lg font-semibold text-success tabular-nums">
                    {activeReceipt.amount.toLocaleString("ru-RU")} {activeReceipt.currency}
                  </span>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setActiveReceipt(null)}>
                  Закрыть
                </Button>
                <a
                  href={`/api/payments/${activeReceipt.id}/receipt`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button type="button" variant="outline">
                    <Download className="h-4 w-4" aria-hidden="true" />
                    <span>PDF с QR-кодом</span>
                  </Button>
                </a>
                <Button type="button" onClick={() => window.print()}>
                  <Printer className="h-4 w-4" aria-hidden="true" />
                  <span>Распечатать квитанцию</span>
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Record Payment Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Зафиксировать оплату учеником</DialogTitle>
          </DialogHeader>

          {recordError && (
            <Alert variant="destructive">
              <AlertDescription>{recordError}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleRecordPayment} className="space-y-4">
            <FormField label="Ученик" htmlFor="pay-student" required>
              <select
                id="pay-student"
                required
                value={studentMembershipId}
                onChange={(e) => {
                  setStudentMembershipId(e.target.value);
                  setSelectedGroupId("");
                  setPromoCheck(null);
                }}
                className={SELECT_CLS}
              >
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.user.fullName}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Сумма (UZS)" htmlFor="pay-amount" required>
              <Input
                id="pay-amount"
                type="number"
                required
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="например 500 000"
              />
            </FormField>

            <FormField label="Способ оплаты" htmlFor="pay-method" required>
              <select
                id="pay-method"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className={SELECT_CLS}
              >
                <option value="CASH">Наличные / Очно в кассу</option>
                <option value="ONLINE">Онлайн-эквайринг</option>
                <option value="BANK_TRANSFER">Банковский перевод на расчетный счет</option>
              </select>
            </FormField>

            {studentGroups.length > 0 && (
              <div className="space-y-3 border-t border-border pt-3">
                <FormField label="Группа и период (опционально)" htmlFor="pay-group">
                  <select
                    id="pay-group"
                    value={selectedGroupId}
                    onChange={(e) => {
                      const gid = e.target.value;
                      setSelectedGroupId(gid);
                      setPromoCheck(null);
                      if (gid) {
                        applyTariffToAmount(gid, periodMonths, 0, manualDiscountAmount);
                      }
                    }}
                    className={SELECT_CLS}
                  >
                    <option value="">Без привязки к группе (свободная оплата)</option>
                    {studentGroups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                        {g.course ? ` (${g.course.title})` : ""}
                      </option>
                    ))}
                  </select>
                </FormField>

                {selectedGroupId && (
                  <div className="space-y-1.5">
                    <span className="block text-[13px] font-medium text-foreground">
                      Период оплаты
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      {([1, 2, 3] as const).map((m) => {
                        const tariffPrice = getGroupTariffPrice(selectedGroupId, m);
                        const selected = periodMonths === m;
                        return (
                          <button
                            key={m}
                            type="button"
                            onClick={() => {
                              setPeriodMonths(m);
                              setPromoCheck(null);
                              applyTariffToAmount(selectedGroupId, m, 0, manualDiscountAmount);
                            }}
                            className={`rounded-md border p-2 text-center transition-colors ${
                              selected
                                ? "border-primary bg-primary/10 text-foreground"
                                : "border-border bg-card text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            <div className="text-xs font-semibold">{m} мес.</div>
                            {tariffPrice != null && (
                              <div className="text-xs text-muted-foreground tabular-nums">
                                {tariffPrice.toLocaleString("ru-RU")}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {selectedGroupId && (
                  <FormField label="Промокод" htmlFor="pay-promo">
                    <div className="flex gap-2">
                      <Input
                        id="pay-promo"
                        type="text"
                        value={promoCode}
                        onChange={(e) => {
                          setPromoCode(e.target.value.toUpperCase());
                          setPromoCheck(null);
                        }}
                        placeholder="SPRING20"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        disabled={promoChecking || !promoCode.trim()}
                        onClick={() =>
                          handleValidatePromo(
                            promoCode,
                            getGroupTariffPrice(selectedGroupId, periodMonths) ??
                              (parseInt(amount || "0", 10) || 0),
                            selectedGroupId,
                            "staff"
                          )
                        }
                      >
                        <Tag className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{promoChecking ? "..." : "Применить"}</span>
                      </Button>
                    </div>
                    {promoCheck && (
                      <p
                        className={`mt-1 text-xs ${
                          promoCheck.valid ? "text-success" : "text-destructive"
                        }`}
                      >
                        {promoCheck.valid
                          ? `Промокод ${promoCheck.code}: скидка ${promoCheck.discountAmount.toLocaleString("ru-RU")} UZS`
                          : promoCheck.message}
                      </p>
                    )}
                  </FormField>
                )}

                {selectedGroupId && effectiveCanDiscount && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <FormField label="Ручная скидка (UZS)" htmlFor="pay-manual-discount">
                      <Input
                        id="pay-manual-discount"
                        type="number"
                        min="0"
                        value={manualDiscountAmount}
                        onChange={(e) => {
                          const val = e.target.value;
                          setManualDiscountAmount(val);
                          applyTariffToAmount(
                            selectedGroupId,
                            periodMonths,
                            promoCheck?.valid ? promoCheck.discountAmount : 0,
                            val
                          );
                        }}
                        placeholder="0"
                      />
                    </FormField>
                    <FormField label="Причина скидки" htmlFor="pay-discount-reason">
                      <Input
                        id="pay-discount-reason"
                        type="text"
                        value={discountReason}
                        onChange={(e) => setDiscountReason(e.target.value)}
                        placeholder="Семья / льгота"
                      />
                    </FormField>
                  </div>
                )}
              </div>
            )}

            <FormActions>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowModal(false)}
                disabled={loading}
              >
                Отмена
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Сохранение..." : "Провести оплату"}
              </Button>
            </FormActions>
          </form>
        </DialogContent>
      </Dialog>

      {/* Refund Modal */}
      <Dialog open={Boolean(refundTarget)} onOpenChange={(open) => !open && setRefundTarget(null)}>
        <DialogContent className="max-w-md">
          {refundTarget && (
            <>
              <DialogHeader>
                <DialogTitle>Возврат оплаты</DialogTitle>
              </DialogHeader>

              <p className="text-xs text-muted-foreground tabular-nums">
                Ученик:{" "}
                <strong className="text-foreground">{refundTarget.student.user.fullName}</strong> ·
                Оплачено: {refundTarget.amount.toLocaleString("ru-RU")} {refundTarget.currency}
              </p>

              {refundTarget.paymentMethod === "ONLINE" && (
                <Alert variant="warning">
                  <AlertDescription>
                    Онлайн-оплата Click: после списания в системе необходимо вручную вернуть деньги в
                    кабинете Click и затем нажать «Возврат выполнен».
                  </AlertDescription>
                </Alert>
              )}

              {refundError && (
                <Alert variant="destructive">
                  <AlertDescription>{refundError}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleRefundSubmit} className="space-y-4">
                <FormField
                  label={`Сумма возврата (${refundTarget.currency})`}
                  htmlFor="refund-amount"
                  required
                >
                  <Input
                    id="refund-amount"
                    type="number"
                    required
                    min="1"
                    max={Math.max(1, refundTarget.amount - (refundTarget.refundedAmount ?? 0))}
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                  />
                </FormField>

                <FormField label="Причина возврата" htmlFor="refund-reason" required>
                  <Input
                    id="refund-reason"
                    type="text"
                    required
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    placeholder="Перевод в другую группу / отказ"
                  />
                </FormField>

                <FormActions>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setRefundTarget(null)}
                    disabled={refundLoading}
                  >
                    Отмена
                  </Button>
                  <Button type="submit" variant="destructive" disabled={refundLoading}>
                    {refundLoading ? "Обработка..." : "Подтвердить возврат"}
                  </Button>
                </FormActions>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Manual Click Refund Confirmation Modal */}
      <Dialog
        open={Boolean(manualRefundTarget)}
        onOpenChange={(open) => !open && setManualRefundTarget(null)}
      >
        <DialogContent className="max-w-md">
          {manualRefundTarget && (
            <>
              <DialogHeader>
                <DialogTitle>Подтвердить возврат в Click</DialogTitle>
              </DialogHeader>

              <Alert variant="warning">
                <AlertDescription className="tabular-nums">
                  Подтвердите после того, как фактически вернули{" "}
                  <strong>
                    {(manualRefundTarget.refundedAmount ?? 0).toLocaleString("ru-RU")} UZS
                  </strong>{" "}
                  ученику ({manualRefundTarget.student.user.fullName}) в кабинете Click.
                </AlertDescription>
              </Alert>

              {manualRefundError && (
                <Alert variant="destructive">
                  <AlertDescription>{manualRefundError}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleManualRefundCompleteSubmit} className="space-y-4">
                <FormField label="Дата возврата в Click" htmlFor="manual-refund-date" required>
                  <Input
                    id="manual-refund-date"
                    type="date"
                    required
                    value={manualRefundDate}
                    onChange={(e) => setManualRefundDate(e.target.value)}
                  />
                </FormField>

                <FormField
                  label="Комментарий / причина / номер операции Click"
                  htmlFor="manual-refund-note"
                  required
                >
                  <Input
                    id="manual-refund-note"
                    type="text"
                    required
                    value={manualRefundNote}
                    onChange={(e) => setManualRefundNote(e.target.value)}
                    placeholder="Возврат проведён в кабинете Click"
                  />
                </FormField>

                <FormActions>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setManualRefundTarget(null)}
                    disabled={manualRefundLoading}
                  >
                    Отмена
                  </Button>
                  <Button type="submit" disabled={manualRefundLoading}>
                    {manualRefundLoading ? "Сохранение..." : "Возврат выполнен"}
                  </Button>
                </FormActions>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Click Payment Intent Modal */}
      <Dialog
        open={Boolean(clickTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setClickTarget(null);
            setClickIntent(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          {clickTarget && (
            <>
              <DialogHeader>
                <p className="text-xs font-medium text-muted-foreground">
                  Оплата онлайн · 0% комиссия платформы
                </p>
                <DialogTitle>{clickTarget.groupName}</DialogTitle>
              </DialogHeader>

              {clickError && (
                <Alert variant="destructive">
                  <AlertDescription>{clickError}</AlertDescription>
                </Alert>
              )}

              {!clickIntent ? (
                <form onSubmit={handleCreateClickIntent} className="space-y-4">
                  <div className="space-y-1.5">
                    <span className="block text-[13px] font-medium text-foreground">
                      Выберите период
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      {([1, 2, 3] as const).map((m) => {
                        const price = getClickTariffPrice(m);
                        const selected = clickPeriod === m;
                        return (
                          <button
                            key={m}
                            type="button"
                            onClick={() => {
                              setClickPeriod(m);
                              setClickPromoCheck(null);
                            }}
                            className={`rounded-md border p-2.5 text-center transition-colors ${
                              selected
                                ? "border-primary bg-primary/10 text-foreground"
                                : "border-border bg-card text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            <div className="text-xs font-semibold">{m} мес.</div>
                            <div className="text-xs text-muted-foreground tabular-nums">
                              {price.toLocaleString("ru-RU")}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <FormField label="Промокод (если есть)" htmlFor="click-promo">
                    <div className="flex gap-2">
                      <Input
                        id="click-promo"
                        type="text"
                        value={clickPromo}
                        onChange={(e) => {
                          setClickPromo(e.target.value.toUpperCase());
                          setClickPromoCheck(null);
                        }}
                        placeholder="PROMO10"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!clickPromo.trim()}
                        onClick={() =>
                          handleValidatePromo(
                            clickPromo,
                            getClickTariffPrice(clickPeriod),
                            clickTarget.groupId,
                            "click"
                          )
                        }
                      >
                        Проверить
                      </Button>
                    </div>
                    {clickPromoCheck && (
                      <p
                        className={`mt-1 text-xs ${
                          clickPromoCheck.valid ? "text-success" : "text-destructive"
                        }`}
                      >
                        {clickPromoCheck.valid
                          ? `Итого со скидкой: ${clickPromoCheck.finalAmount.toLocaleString("ru-RU")} UZS`
                          : clickPromoCheck.message}
                      </p>
                    )}
                  </FormField>

                  <div className="flex items-center justify-between rounded-lg border border-border bg-muted/50 p-3">
                    <span className="text-xs text-muted-foreground">К оплате через Click:</span>
                    <span className="text-base font-semibold text-foreground tabular-nums">
                      {(clickPromoCheck?.valid
                        ? clickPromoCheck.finalAmount
                        : getClickTariffPrice(clickPeriod)
                      ).toLocaleString("ru-RU")}{" "}
                      UZS
                    </span>
                  </div>

                  <FormActions>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setClickTarget(null)}
                      disabled={clickLoading}
                    >
                      Отмена
                    </Button>
                    <Button type="submit" disabled={clickLoading}>
                      {clickLoading ? "Создание счета..." : "Сформировать счёт Click"}
                    </Button>
                  </FormActions>
                </form>
              ) : (
                <div className="space-y-4 text-center">
                  <div className="inline-block rounded-lg border border-border bg-card p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={clickIntent.qrDataUrl}
                      alt="QR для оплаты Click"
                      className="h-44 w-44"
                    />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Заказ:{" "}
                      <span className="font-mono text-foreground">{clickIntent.merchantTransId}</span>
                    </p>
                    <p className="mt-1 text-lg font-semibold text-success tabular-nums">
                      {clickIntent.amount.toLocaleString("ru-RU")} UZS
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Отсканируйте QR в приложении Click или нажмите кнопку ниже
                    </p>
                  </div>
                  <DialogFooter className="sm:justify-center">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setClickTarget(null);
                        setClickIntent(null);
                        router.refresh();
                      }}
                    >
                      Закрыть
                    </Button>
                    <a href={clickIntent.clickUrl} target="_blank" rel="noopener noreferrer">
                      <Button type="button">
                        <ExternalLink className="h-4 w-4" aria-hidden="true" />
                        <span>Перейти к оплате Click</span>
                      </Button>
                    </a>
                  </DialogFooter>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

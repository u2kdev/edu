"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Plus, Copy, Check } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormActions, FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";

const SELECT_CLS =
  "flex h-9 w-full rounded-md border border-input bg-card px-3 py-1.5 text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50";

export interface InviteItem {
  id: string;
  code: string;
  targetRole: string;
  usesCount: number;
  maxUses: number | null;
  course?: { title: string } | null;
  group?: { name: string } | null;
}

export interface CourseSelectItem {
  id: string;
  title: string;
}

export interface GroupSelectItem {
  id: string;
  name: string;
}

interface InvitesManagerProps {
  initialInvites: InviteItem[];
  courses: CourseSelectItem[];
  groups: GroupSelectItem[];
  role?: string;
}

export default function InvitesManager({
  initialInvites,
  courses,
  role,
}: InvitesManagerProps) {
  const router = useRouter();
  const [invites] = useState(initialInvites);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [targetRole, setTargetRole] = useState("STUDENT");
  const [courseId, setCourseId] = useState("");
  const [groupId] = useState("");
  const [maxUses, setMaxUses] = useState("10");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const [redeemCode, setRedeemCode] = useState("");
  const [redeemSuccess, setRedeemSuccess] = useState<string | null>(null);
  const [redeemError, setRedeemError] = useState<string | null>(null);

  const canGenerate = role === "DIRECTOR" || role === "CENTER_ADMIN";

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setGenerateError(null);
    try {
      const res = await fetch("/api/invites/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetRole, courseId, groupId, maxUses }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowGenerateModal(false);
        router.refresh();
      } else {
        setGenerateError(
          typeof data.error === "string" && data.error ? data.error : "Не удалось создать код"
        );
      }
    } catch {
      setGenerateError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  };

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    setRedeemSuccess(null);
    setRedeemError(null);
    try {
      const res = await fetch("/api/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: redeemCode }),
      });
      const data = await res.json();
      if (res.ok) {
        setRedeemSuccess(
          `Вы успешно присоединились к центру «${data.center.name}» с ролью ${data.role}`
        );
        setRedeemCode("");
        router.refresh();
      } else {
        setRedeemError(data.error || null);
      }
    } catch {
      setRedeemError("Ошибка при активации");
    }
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const columns = useMemo<DataTableColumn<InviteItem>[]>(
    () => [
      {
        id: "code",
        header: "Инвайт-код",
        sortable: true,
        sortValue: (inv) => inv.code,
        cell: (inv) => <span className="font-mono font-semibold text-primary">{inv.code}</span>,
      },
      {
        id: "role",
        header: "Роль",
        cell: (inv) => <Badge variant="neutral">{inv.targetRole}</Badge>,
      },
      {
        id: "scope",
        header: "Курс / Группа",
        cell: (inv) => (
          <span className="text-muted-foreground">
            {inv.course?.title || inv.group?.name || "Общий код центра"}
          </span>
        ),
      },
      {
        id: "uses",
        header: "Использования",
        cell: (inv) => (
          <span className="tabular-nums">
            <span className="font-medium text-foreground">{inv.usesCount}</span> / {inv.maxUses}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Действие",
        align: "right",
        cell: (inv) => (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => copyToClipboard(inv.code)}
          >
            {copiedCode === inv.code ? (
              <>
                <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                <span className="text-success">Скопировано</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Копировать</span>
              </>
            )}
          </Button>
        ),
      },
    ],
    [copiedCode]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Приглашения и инвайт-коды"
        description="Активация приглашений и управление кодами доступа учебного центра"
        actions={
          canGenerate ? (
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setGenerateError(null);
                setShowGenerateModal(true);
              }}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>Сгенерировать код</span>
            </Button>
          ) : undefined
        }
      />

      {/* Quick Redeem Banner */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4 text-primary" aria-hidden="true" />
            <span>Активировать инвайт-код</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Вам выдали пригласительный код? Введите его ниже для входа в курс или родительской
            привязки:
          </p>

          {redeemSuccess && (
            <Alert variant="success">
              <AlertDescription>{redeemSuccess}</AlertDescription>
            </Alert>
          )}
          {redeemError && (
            <Alert variant="destructive">
              <AlertDescription>{redeemError}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleRedeem} className="flex flex-col gap-3 sm:flex-row">
            <Input
              type="text"
              required
              value={redeemCode}
              onChange={(e) => setRedeemCode(e.target.value)}
              placeholder="e.g. JOIN-JS2026 или PARENT-1234"
              className="flex-1 font-mono uppercase"
            />
            <Button type="submit" className="shrink-0">
              Применить код
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Generated Invites Table (Admin View) */}
      {canGenerate && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">
            Существующие инвайт-коды центра
          </h2>

          <DataTable
            data={invites}
            columns={columns}
            getRowId={(inv) => inv.id}
            emptyTitle="Инвайт-коды еще не созданы."
            emptyDescription="Сгенерируйте пригласительный код для зачисления учеников, родителей или сотрудников."
            mobileCardRender={(inv) => (
              <div className="space-y-2 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono font-semibold text-primary">{inv.code}</span>
                  <Badge variant="neutral">{inv.targetRole}</Badge>
                </div>
                <div className="flex items-center justify-between gap-2 text-muted-foreground tabular-nums">
                  <span>{inv.course?.title || inv.group?.name || "Общий код центра"}</span>
                  <span>
                    {inv.usesCount} / {inv.maxUses}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(inv.code)}
                >
                  {copiedCode === inv.code ? "Скопировано" : "Копировать"}
                </Button>
              </div>
            )}
          />
        </div>
      )}

      {/* Generate Modal */}
      <Dialog open={showGenerateModal} onOpenChange={setShowGenerateModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Создать новый инвайт-код</DialogTitle>
          </DialogHeader>

          {generateError && (
            <Alert variant="destructive">
              <AlertDescription>{generateError}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleGenerate} className="space-y-4">
            <FormField label="Назначение роли" htmlFor="inv-role" required>
              <select
                id="inv-role"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                className={SELECT_CLS}
              >
                <option value="STUDENT">Ученик (STUDENT)</option>
                <option value="TEACHER">Учитель (TEACHER)</option>
                <option value="PARENT">Родитель (PARENT)</option>
                <option value="CENTER_ADMIN">Администратор центра (CENTER_ADMIN)</option>
              </select>
            </FormField>

            <FormField label="Привязать к курсу (опционально)" htmlFor="inv-course">
              <select
                id="inv-course"
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                className={SELECT_CLS}
              >
                <option value="">-- Общий инвайт центра --</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Максимум активаций" htmlFor="inv-max-uses" required>
              <Input
                id="inv-max-uses"
                type="number"
                min="1"
                max="1000"
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
              />
            </FormField>

            <FormActions>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowGenerateModal(false)}
                disabled={loading}
              >
                Отмена
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Генерация..." : "Создать код"}
              </Button>
            </FormActions>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

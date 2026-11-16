"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Plus, UserPlus } from "lucide-react";
import {
  Alert,
  AlertDescription,
  Badge,
  type BadgeVariant,
  Button,
  DataTable,
  type DataTableColumn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  FormActions,
  FormField,
  Input,
  StatCard,
} from "@/components/ui";

export interface PlanOption {
  id: string;
  name: string;
  priceMonthly?: number;
}

export interface AdminCenterItem {
  id: string;
  name: string;
  slug: string;
  status: string;
  owner?: { fullName?: string | null; email?: string | null } | null;
  subscriptions: Array<{ plan?: { name: string } | null }>;
}

interface PlatformAdminManagerProps {
  initialCenters: AdminCenterItem[];
  plans: PlanOption[];
  metrics: {
    totalCenters: number;
    activeCenters: number;
    pausedCenters: number;
  };
}

const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh",
  щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

function slugifyCenterName(value: string): string {
  return value
    .toLowerCase()
    .split("")
    .map((ch) => CYRILLIC_TO_LATIN[ch] ?? ch)
    .join("")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  ACTIVE: "success",
  TRIAL: "info",
  PAUSED: "warning",
  BLOCKED: "destructive",
};

export default function PlatformAdminManager({
  initialCenters,
  plans,
  metrics,
}: PlatformAdminManagerProps) {
  const router = useRouter();
  const [centers] = useState(initialCenters);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [centerType, setCenterType] = useState("HYBRID");
  const [planId, setPlanId] = useState(plans[0]?.id || "");
  const [directorEmail, setDirectorEmail] = useState("");
  const [directorFullName, setDirectorFullName] = useState("");
  const [directorPhone, setDirectorPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [statusError, setStatusError] = useState("");

  const handleNameChange = (val: string) => {
    setName(val);
    if (!slugTouched) {
      setSlug(slugifyCenterName(val));
    }
  };

  const openCreateModal = () => {
    setError("");
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    setError("");
    setShowCreateModal(false);
  };

  const handleCreateCenter = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/platform/centers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug,
          centerType,
          planId,
          directorEmail,
          directorFullName,
          directorPhone,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setShowCreateModal(false);
        setName("");
        setSlug("");
        setSlugTouched(false);
        setDirectorEmail("");
        setDirectorFullName("");
        setDirectorPhone("");
        setError("");
        router.refresh();
      } else {
        setError(data.error || "Ошибка при создании центра");
      }
    } catch {
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (centerId: string, newStatus: string) => {
    setStatusError("");
    try {
      const res = await fetch(`/api/platform/centers/${centerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ centerId, status: newStatus }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json();
        setStatusError(data.error || "Ошибка изменения статуса");
      }
    } catch {
      setStatusError("Ошибка сети");
    }
  };

  const columns: DataTableColumn<AdminCenterItem>[] = [
    {
      id: "center",
      header: "Учебный центр",
      isMobilePrimary: true,
      cell: (c) => (
        <div>
          <div className="flex items-center gap-2 font-medium text-foreground">
            <Building2 className="h-4 w-4 text-primary" aria-hidden="true" />
            <span>{c.name}</span>
          </div>
          <div className="mt-0.5 font-mono text-xs text-muted-foreground">slug: {c.slug}</div>
        </div>
      ),
    },
    {
      id: "owner",
      header: "Владелец (директор)",
      cell: (c) => (
        <div>
          <div className="font-medium text-foreground">{c.owner?.fullName}</div>
          <div className="text-xs text-muted-foreground">{c.owner?.email}</div>
        </div>
      ),
    },
    {
      id: "plan",
      header: "Тариф подписки",
      cell: (c) => {
        const sub = c.subscriptions[0];
        return <Badge variant="neutral">{sub?.plan?.name || "Trial"}</Badge>;
      },
    },
    {
      id: "status",
      header: "Статус",
      cell: (c) => (
        <Badge variant={STATUS_VARIANTS[c.status] || "neutral"}>{c.status}</Badge>
      ),
    },
    {
      id: "actions",
      header: "Управление статусом",
      align: "right",
      hideable: false,
      cell: (c) => (
        <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
          {c.status !== "ACTIVE" && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleUpdateStatus(c.id, "ACTIVE")}
            >
              Активировать
            </Button>
          )}
          {c.status !== "PAUSED" && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleUpdateStatus(c.id, "PAUSED")}
            >
              Заморозить
            </Button>
          )}
          {c.status !== "BLOCKED" && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => handleUpdateStatus(c.id, "BLOCKED")}
            >
              Заблокировать
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="grid w-full flex-1 grid-cols-1 gap-4 sm:w-auto sm:grid-cols-3">
          <StatCard label="Всего центров" value={metrics.totalCenters} />
          <StatCard label="Активных" value={metrics.activeCenters} />
          <StatCard label="Заморожены" value={metrics.pausedCenters} />
        </div>

        <Button
          type="button"
          variant="primary"
          onClick={openCreateModal}
          className="w-full shrink-0 sm:w-auto"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>Создать учебный центр</span>
        </Button>
      </div>

      {statusError && (
        <Alert variant="destructive">
          <AlertDescription>{statusError}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-3">
        <h2 className="font-display text-base font-semibold text-foreground">
          Реестр учебных центров
        </h2>

        <DataTable
          data={centers}
          columns={columns}
          getRowId={(c) => c.id}
          showColumnToggle={false}
          showDensityToggle={false}
          emptyTitle="Центры ещё не созданы"
          emptyDescription="Нажмите «Создать учебный центр», чтобы добавить первый центр."
          emptyAction={
            <Button type="button" variant="primary" size="sm" onClick={openCreateModal}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>Создать учебный центр</span>
            </Button>
          }
        />
      </div>

      <Dialog open={showCreateModal} onOpenChange={(next) => !next && closeCreateModal()}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Создание учебного центра и аккаунта директора</DialogTitle>
            <DialogDescription>
              Создайте новый центр и назначьте руководителя. Директору будет привязан доступ.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleCreateCenter} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Название центра" htmlFor="pam-name" required>
                <Input
                  id="pam-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Школа Кодинга Квантум"
                />
              </FormField>

              <FormField label="Slug (URL-идентификатор)" htmlFor="pam-slug" required>
                <Input
                  id="pam-slug"
                  type="text"
                  required
                  value={slug}
                  onChange={(e) => {
                    setSlug(e.target.value);
                    setSlugTouched(true);
                  }}
                  placeholder="e.g. quantum-coding"
                  className="font-mono"
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Формат обучения" htmlFor="pam-type">
                <select
                  id="pam-type"
                  value={centerType}
                  onChange={(e) => setCenterType(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="HYBRID">Гибридный (офлайн + онлайн)</option>
                  <option value="OFFLINE">Офлайн-центр</option>
                  <option value="ONLINE">Онлайн-школа</option>
                </select>
              </FormField>

              <FormField label="Тариф подписки" htmlFor="pam-plan">
                <select
                  id="pam-plan"
                  value={planId}
                  onChange={(e) => setPlanId(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({Math.round(p.priceMonthly || 0).toLocaleString("ru-RU")} UZS/мес)
                    </option>
                  ))}
                </select>
              </FormField>
            </div>

            <div className="space-y-4 border-t border-border pt-4">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <UserPlus className="h-4 w-4 text-primary" aria-hidden="true" />
                <span>Данные директора центра</span>
              </div>

              <FormField label="ФИО директора" htmlFor="pam-dir-name" required>
                <Input
                  id="pam-dir-name"
                  type="text"
                  required
                  value={directorFullName}
                  onChange={(e) => setDirectorFullName(e.target.value)}
                  placeholder="e.g. Александр Волков"
                />
              </FormField>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="Email директора" htmlFor="pam-dir-email" required>
                  <Input
                    id="pam-dir-email"
                    type="email"
                    required
                    value={directorEmail}
                    onChange={(e) => setDirectorEmail(e.target.value)}
                    placeholder="director@quantum.ru"
                  />
                </FormField>

                <FormField label="Телефон" htmlFor="pam-dir-phone">
                  <Input
                    id="pam-dir-phone"
                    type="tel"
                    value={directorPhone}
                    onChange={(e) => setDirectorPhone(e.target.value)}
                    placeholder="+7 (999) 111-22-33"
                  />
                </FormField>
              </div>
            </div>

            <FormActions>
              <Button type="button" variant="outline" onClick={closeCreateModal}>
                Отмена
              </Button>
              <Button type="submit" variant="primary" disabled={loading}>
                {loading ? "Создание..." : "Создать центр и директора"}
              </Button>
            </FormActions>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

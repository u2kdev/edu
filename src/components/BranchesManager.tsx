"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  Users,
  Plus,
  Edit2,
  Archive,
  RotateCcw,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { StatusDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { cn } from "@/lib/utils";

export interface BranchItem {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  createdAt: string | Date;
  _count: { groups: number };
}

interface BranchesManagerProps {
  initialBranches: BranchItem[];
  locale?: string;
}

export default function BranchesManager({
  initialBranches,
  locale = "ru",
}: BranchesManagerProps) {
  const router = useRouter();
  const [branches, setBranches] = useState<BranchItem[]>(initialBranches);
  const [showModal, setShowModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState<BranchItem | null>(null);
  const [confirmBranch, setConfirmBranch] = useState<BranchItem | null>(null);
  const [toggling, setToggling] = useState(false);

  // Form fields
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setBranches(initialBranches);
  }, [initialBranches]);

  const activeBranches = branches.filter((b) => b.isActive);
  const inactiveBranches = branches.filter((b) => !b.isActive);
  const totalGroups = branches.reduce((sum, b) => sum + (b._count?.groups || 0), 0);

  const openCreateModal = () => {
    setEditingBranch(null);
    setName("");
    setAddress("");
    setPhone("");
    setEmail("");
    setErrorMessage(null);
    setShowModal(true);
  };

  const openEditModal = (branch: BranchItem) => {
    setEditingBranch(branch);
    setName(branch.name);
    setAddress(branch.address || "");
    setPhone(branch.phone || "");
    setEmail(branch.email || "");
    setErrorMessage(null);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setErrorMessage(null);

    try {
      if (editingBranch) {
        const res = await fetch("/api/tenant/branches", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingBranch.id,
            name: name.trim(),
            address: address.trim() || null,
            phone: phone.trim() || null,
            email: email.trim() || null,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setErrorMessage(data.error || "Не удалось обновить филиал");
          return;
        }
        setShowModal(false);
        router.refresh();
      } else {
        const res = await fetch("/api/tenant/branches", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            address: address.trim() || null,
            phone: phone.trim() || null,
            email: email.trim() || null,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setErrorMessage(data.error || "Не удалось создать филиал");
          return;
        }
        setShowModal(false);
        router.refresh();
      }
    } catch {
      setErrorMessage("Ошибка сети при сохранении филиала");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmToggleArchive = async () => {
    if (!confirmBranch) return;
    setToggling(true);
    setActionError(null);

    try {
      const res = await fetch("/api/tenant/branches", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: confirmBranch.id,
          isActive: !confirmBranch.isActive,
        }),
      });
      if (res.ok) {
        setBranches((prev) =>
          prev.map((b) =>
            b.id === confirmBranch.id ? { ...b, isActive: !b.isActive } : b
          )
        );
        setConfirmBranch(null);
        router.refresh();
      } else {
        const data = await res.json();
        setActionError(data.error || "Не удалось изменить статус филиала");
        setConfirmBranch(null);
      }
    } catch {
      setActionError("Ошибка сети при изменении статуса филиала");
      setConfirmBranch(null);
    } finally {
      setToggling(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Филиалы"
        description={`${activeBranches.length} активных · ${inactiveBranches.length} архивированных`}
        actions={
          <Button type="button" size="sm" onClick={openCreateModal}>
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>Добавить филиал</span>
          </Button>
        }
      />

      {actionError && (
        <Alert variant="destructive">
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Всего филиалов" value={branches.length} />
        <StatCard label="Активные" value={activeBranches.length} />
        <StatCard label="Групп в сумме" value={totalGroups} />
      </div>

      {branches.length === 0 ? (
        <EmptyState
          icon={<Building2 className="w-5 h-5" aria-hidden="true" />}
          title="Нет филиалов"
          description="Добавьте первый филиал для организации расписания и учебных групп."
          action={
            <Button type="button" size="sm" onClick={openCreateModal}>
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>Добавить филиал</span>
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {branches.map((branch) => (
            <Card
              key={branch.id}
              className={cn(
                "flex flex-col justify-between transition-colors",
                !branch.isActive && "opacity-70"
              )}
            >
              <CardContent className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-md bg-muted border border-border flex items-center justify-center shrink-0 text-primary">
                        <Building2 className="w-4 h-4" aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-foreground truncate">
                          {branch.name}
                        </h3>
                        <div className="mt-0.5">
                          <StatusDot
                            tone={branch.isActive ? "success" : "neutral"}
                            label={branch.isActive ? "Активен" : "Архивирован"}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 text-[13px] text-muted-foreground pt-3 border-t border-border">
                    {branch.address && (
                      <div className="flex items-center gap-2 min-w-0">
                        <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span className="truncate">{branch.address}</span>
                      </div>
                    )}
                    {branch.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>{branch.phone}</span>
                      </div>
                    )}
                    {branch.email && (
                      <div className="flex items-center gap-2 min-w-0">
                        <Mail className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span className="truncate">{branch.email}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 pt-0.5 text-foreground">
                      <Users className="w-3.5 h-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                      <span className="tabular-nums">
                        {branch._count?.groups || 0} учебных групп
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => openEditModal(branch)}
                  >
                    <Edit2 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Изменить</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmBranch(branch)}
                    className={
                      branch.isActive
                        ? "hover:text-destructive hover:border-destructive/40"
                        : "hover:text-success hover:border-success/40"
                    }
                  >
                    {branch.isActive ? (
                      <>
                        <Archive className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Архивировать</span>
                      </>
                    ) : (
                      <>
                        <RotateCcw className="w-3.5 h-3.5 text-success" aria-hidden="true" />
                        <span>Восстановить</span>
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent locale={locale} className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" aria-hidden="true" />
              <span>
                {editingBranch ? "Редактировать филиал" : "Новый филиал"}
              </span>
            </DialogTitle>
          </DialogHeader>

          {errorMessage && (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="branch-name">Название филиала *</Label>
              <Input
                id="branch-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Например: Главный кампус или Чиланзар"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="branch-address">Адрес</Label>
              <Input
                id="branch-address"
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Например: ул. Амира Темура, 45"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="branch-phone">Телефон</Label>
              <Input
                id="branch-phone"
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+998 71 123 45 67"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="branch-email">Email</Label>
              <Input
                id="branch-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="branch@edarschi.uz"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowModal(false)}
              >
                Отмена
              </Button>
              <Button type="submit" loading={loading}>
                {editingBranch ? "Сохранить изменения" : "Создать филиал"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(confirmBranch)}
        onOpenChange={(open) => {
          if (!open) setConfirmBranch(null);
        }}
        locale={locale}
        variant={confirmBranch?.isActive ? "destructive" : "primary"}
        loading={toggling}
        title={confirmBranch?.isActive ? "Архивировать филиал" : "Восстановить филиал"}
        description={
          confirmBranch
            ? `Вы действительно хотите ${
                confirmBranch.isActive ? "архивировать" : "восстановить"
              } филиал «${confirmBranch.name}»?`
            : undefined
        }
        confirmLabel={confirmBranch?.isActive ? "Архивировать" : "Восстановить"}
        onConfirm={handleConfirmToggleArchive}
      />
    </div>
  );
}

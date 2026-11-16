"use client";

import { useState } from "react";
import Link from "next/link";
import { Clock, Mail, Phone, Plus, Send, Users } from "lucide-react";
import { t } from "@/i18n";
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  DataTable,
  type DataTableColumn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  FilterBar,
  FormActions,
  FormField,
  Input,
  PageHeader,
} from "@/components/ui";
import { CredentialsModal, type CredentialsData } from "@/components/CredentialsModal";

export interface ParentItem {
  id: string;
  userId: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  status: string;
  lastLoginAt: string | null;
  children: Array<{
    id: string;
    fullName: string;
    relationship?: string | null;
  }>;
}

interface ParentsManagerProps {
  initialParents: ParentItem[];
  locale: string;
  role: string;
}

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-card px-3 py-1.5 text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background";

export function ParentsManager({
  initialParents,
  locale,
  role,
}: ParentsManagerProps) {
  const [parents, setParents] = useState<ParentItem[]>(initialParents);
  const [search, setSearch] = useState("");
  const [filterNeverLoggedIn, setFilterNeverLoggedIn] = useState(false);

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addRelationship, setAddRelationship] = useState("MOTHER");
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [credentials, setCredentials] = useState<CredentialsData | null>(null);
  const [actionNotice, setActionNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const canManage = role === "DIRECTOR" || role === "CENTER_ADMIN" || role === "";

  const filteredParents = parents.filter((p) => {
    const q = search.toLowerCase();
    const matchesSearch =
      p.fullName.toLowerCase().includes(q) ||
      (p.phone && p.phone.includes(q)) ||
      (p.email && p.email.toLowerCase().includes(q)) ||
      p.children.some((c) => c.fullName.toLowerCase().includes(q));

    if (!matchesSearch) return false;
    if (filterNeverLoggedIn && p.lastLoginAt) return false;

    return true;
  });

  const handleCreateParent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addPhone && !addEmail) {
      setAddError("Укажите телефон или email родителя");
      return;
    }

    setAddLoading(true);
    setAddError(null);

    try {
      const res = await fetch("/api/tenant/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: addName,
          phone: addPhone || undefined,
          email: addEmail || undefined,
          role: "PARENT",
          parent: {
            fullName: addName,
            phone: addPhone,
            email: addEmail,
            relationship: addRelationship,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка создания родителя");

      setParents((prev) => [
        {
          id: data.user?.membershipId || String(Date.now()),
          userId: data.user?.id || "",
          fullName: addName,
          phone: data.user?.phone || null,
          email: data.user?.email || null,
          status: "ACTIVE",
          lastLoginAt: null,
          children: [],
        },
        ...prev,
      ]);

      if (data.credentials) {
        setCredentials(data.credentials);
      }

      setAddModalOpen(false);
      setAddName("");
      setAddPhone("");
      setAddEmail("");
      setActionNotice({ type: "success", text: "Родитель успешно добавлен" });
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : "Неизвестная ошибка");
    } finally {
      setAddLoading(false);
    }
  };

  const handleSendReset = async (membershipId: string) => {
    try {
      const res = await fetch(`/api/tenant/users/${membershipId}/send-reset-link`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка отправки ссылки");

      setActionNotice({
        type: "success",
        text: data.resetUrl ? `Ссылка создана: ${data.resetUrl}` : "Ссылка для сброса пароля отправлена",
      });
    } catch (err: unknown) {
      setActionNotice({ type: "error", text: err instanceof Error ? err.message : "Неизвестная ошибка" });
    }
  };

  const columns: DataTableColumn<ParentItem>[] = [
    {
      id: "fullName",
      header: "Родитель",
      isMobilePrimary: true,
      sortable: true,
      sortValue: (p) => p.fullName,
      cell: (p) => (
        <div className="space-y-1">
          <div className="font-medium text-foreground">{p.fullName}</div>
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
            {p.lastLoginAt ? (
              <span className="tabular-nums">
                Последний вход: {new Date(p.lastLoginAt).toLocaleDateString()}
              </span>
            ) : (
              <span>Ни разу не входил</span>
            )}
          </div>
        </div>
      ),
    },
    {
      id: "contacts",
      header: "Контакты",
      cell: (p) => (
        <div className="space-y-0.5 text-xs text-muted-foreground">
          {p.phone && (
            <div className="flex items-center gap-1.5 tabular-nums">
              <Phone className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span>{p.phone}</span>
            </div>
          )}
          {p.email && (
            <div className="flex items-center gap-1.5">
              <Mail className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span className="truncate">{p.email}</span>
            </div>
          )}
          {!p.phone && !p.email && <span>—</span>}
        </div>
      ),
    },
    {
      id: "children",
      header: "Ученики",
      cell: (p) =>
        p.children.length === 0 ? (
          <span className="text-xs text-muted-foreground">Нет привязок</span>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {p.children.map((c) => (
              <Link key={c.id} href={`/center/students/${c.id}`}>
                <Badge variant="primary" className="hover:opacity-85 transition-opacity">
                  <Users className="h-3 w-3" aria-hidden="true" />
                  <span>{c.fullName}</span>
                </Badge>
              </Link>
            ))}
          </div>
        ),
    },
    {
      id: "status",
      header: "Статус",
      cell: (p) => (
        <Badge variant={p.status === "ACTIVE" ? "success" : p.status === "BLOCKED" ? "destructive" : "neutral"}>
          {p.status === "ACTIVE" ? "Активен" : p.status === "BLOCKED" ? "Заблокирован" : "В архиве"}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "Действия",
      align: "right",
      cell: (p) => (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => handleSendReset(p.id)}
        >
          <Send className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Сброс пароля</span>
        </Button>
      ),
    },
  ];

  const hasFilters = Boolean(search) || filterNeverLoggedIn;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t(locale, "nav.parents")}
        description="Управление аккаунтами родителей и привязками к ученикам центра"
        actions={
          canManage ? (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => {
                setAddError(null);
                setAddModalOpen(true);
              }}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>Добавить родителя</span>
            </Button>
          ) : undefined
        }
      />

      {actionNotice && (
        <Alert variant={actionNotice.type === "success" ? "success" : "destructive"}>
          <AlertDescription>{actionNotice.text}</AlertDescription>
        </Alert>
      )}

      <FilterBar
        locale={locale}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Поиск по имени, телефону, email или ребёнку..."
        hasActiveFilters={hasFilters}
        onReset={() => {
          setSearch("");
          setFilterNeverLoggedIn(false);
        }}
      >
        <Button
          type="button"
          variant={filterNeverLoggedIn ? "primary" : "secondary"}
          size="sm"
          onClick={() => setFilterNeverLoggedIn(!filterNeverLoggedIn)}
        >
          Ни разу не входил
        </Button>
      </FilterBar>

      <DataTable
        data={filteredParents}
        columns={columns}
        getRowId={(p) => p.id}
        locale={locale}
        emptyTitle="Родители не найдены"
        emptyDescription={t(locale, "ui4.emptyParentsDesc")}
        emptyAction={
          canManage ? (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => {
                setAddError(null);
                setAddModalOpen(true);
              }}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>Добавить родителя</span>
            </Button>
          ) : undefined
        }
        mobileMode="cards"
      />

      <Dialog open={addModalOpen} onOpenChange={(next) => !next && setAddModalOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Добавить родителя</DialogTitle>
            <DialogDescription>
              Создайте аккаунт родителя. Если нужно привязать существующего к ученику, сделайте это в карточке ученика.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateParent} className="space-y-4">
            {addError && (
              <Alert variant="destructive">
                <AlertDescription>{addError}</AlertDescription>
              </Alert>
            )}

            <FormField label="ФИО родителя" htmlFor="parent-fullname" required>
              <Input
                id="parent-fullname"
                type="text"
                required
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="Имя Фамилия"
              />
            </FormField>

            <FormField label="Телефон" htmlFor="parent-phone">
              <Input
                id="parent-phone"
                type="text"
                value={addPhone}
                onChange={(e) => setAddPhone(e.target.value)}
                placeholder="+998901234567"
              />
            </FormField>

            <FormField label="Email (необязательно)" htmlFor="parent-email">
              <Input
                id="parent-email"
                type="email"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                placeholder="parent@example.uz"
              />
            </FormField>

            <FormField label="Кем приходится" htmlFor="parent-rel">
              <select
                id="parent-rel"
                value={addRelationship}
                onChange={(e) => setAddRelationship(e.target.value)}
                className={selectClassName}
              >
                <option value="MOTHER">Мама</option>
                <option value="FATHER">Папа</option>
                <option value="GUARDIAN">Опекун</option>
                <option value="OTHER">Другой родственник</option>
              </select>
            </FormField>

            <FormActions>
              <Button type="button" variant="secondary" onClick={() => setAddModalOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" variant="primary" disabled={addLoading} loading={addLoading}>
                {addLoading ? "Создание..." : "Создать аккаунт"}
              </Button>
            </FormActions>
          </form>
        </DialogContent>
      </Dialog>

      {credentials && (
        <CredentialsModal
          isOpen={Boolean(credentials)}
          onClose={() => setCredentials(null)}
          credentials={credentials}
          locale={locale}
        />
      )}
    </div>
  );
}

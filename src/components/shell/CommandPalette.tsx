"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Compass, GraduationCap, Search, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { t } from "@/i18n";
import type { AppScope, ResolvedNavGroup } from "@/config/navigation";

interface SearchResultEntry {
  id: string;
  label: string;
  subtitle?: string;
  href: string;
  category: "section" | "student" | "group" | "center";
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scope: AppScope;
  groups: ResolvedNavGroup[];
  locale: string;
  canSearchStudents?: boolean;
  canSearchGroups?: boolean;
  canSearchCenters?: boolean;
}

export function CommandPalette({
  open,
  onOpenChange,
  scope,
  groups,
  locale,
  canSearchStudents = false,
  canSearchGroups = false,
  canSearchCenters = false,
}: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [remoteResults, setRemoteResults] = useState<SearchResultEntry[]>([]);
  const [loadingRemote, setLoadingRemote] = useState(false);

  // Register global Ctrl+K / Cmd+K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setActiveIndex(0);
      setRemoteResults([]);
    }
  }, [open]);

  const staticEntries = useMemo<SearchResultEntry[]>(() => {
    const items: SearchResultEntry[] = [];
    for (const group of groups) {
      const groupName = group.labelKey ? t(locale, group.labelKey) : undefined;
      for (const item of group.items) {
        items.push({
          id: item.id,
          label: t(locale, item.labelKey),
          subtitle: groupName,
          href: item.href,
          category: "section",
        });
      }
    }
    items.push({
      id: "account-profile",
      label: t(locale, "account.title"),
      subtitle: t(locale, "shell.accountSettings"),
      href: "/account",
      category: "section",
    });
    return items;
  }, [groups, locale]);

  const filteredSections = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return staticEntries.slice(0, 10);
    return staticEntries.filter(
      (entry) =>
        entry.label.toLowerCase().includes(q) ||
        (entry.subtitle && entry.subtitle.toLowerCase().includes(q)) ||
        entry.href.toLowerCase().includes(q)
    );
  }, [staticEntries, query]);

  useEffect(() => {
    const q = query.trim();
    if (!open || q.length < 2) {
      setRemoteResults([]);
      setLoadingRemote(false);
      return;
    }

    const canFetchAnything =
      (scope === "center" && (canSearchStudents || canSearchGroups)) ||
      (scope === "platform" && canSearchCenters);
    if (!canFetchAnything) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoadingRemote(true);
      const collected: SearchResultEntry[] = [];
      try {
        const tasks: Promise<void>[] = [];

        if (scope === "center" && canSearchStudents) {
          tasks.push(
            fetch(`/api/students?search=${encodeURIComponent(q)}&pageSize=5`)
              .then((res) => (res.ok ? res.json() : null))
              .then((data) => {
                if (!data || !Array.isArray(data.students)) return;
                for (const st of data.students.slice(0, 5)) {
                  const fullName = st.user?.fullName || st.fullName;
                  if (!fullName || !st.id) continue;
                  collected.push({
                    id: `st-${st.id}`,
                    label: fullName,
                    subtitle: st.user?.email || st.user?.phone || undefined,
                    href: `/center/students/${st.id}`,
                    category: "student",
                  });
                }
              })
              .catch(() => {})
          );
        }

        if (scope === "center" && canSearchGroups) {
          tasks.push(
            fetch("/api/groups")
              .then((res) => (res.ok ? res.json() : null))
              .then((data) => {
                if (!data || !Array.isArray(data.groups)) return;
                const qLower = q.toLowerCase();
                for (const g of data.groups) {
                  if (collected.filter((c) => c.category === "group").length >= 5) break;
                  const name = String(g.name || "");
                  const courseTitle = String(g.course?.title || "");
                  if (
                    name.toLowerCase().includes(qLower) ||
                    courseTitle.toLowerCase().includes(qLower)
                  ) {
                    collected.push({
                      id: `grp-${g.id}`,
                      label: name,
                      subtitle: courseTitle || undefined,
                      href: `/center/groups?search=${encodeURIComponent(name)}`,
                      category: "group",
                    });
                  }
                }
              })
              .catch(() => {})
          );
        }

        if (scope === "platform" && canSearchCenters) {
          tasks.push(
            fetch(`/api/platform/centers?search=${encodeURIComponent(q)}&limit=5`)
              .then((res) => (res.ok ? res.json() : null))
              .then((data) => {
                if (!data || !Array.isArray(data.centers)) return;
                for (const c of data.centers.slice(0, 5)) {
                  if (!c.id || !c.name) continue;
                  collected.push({
                    id: `ctr-${c.id}`,
                    label: c.name,
                    subtitle: c.slug,
                    href: `/platform-admin/centers/${c.id}`,
                    category: "center",
                  });
                }
              })
              .catch(() => {})
          );
        }

        await Promise.all(tasks);
        if (!cancelled) {
          setRemoteResults(collected);
        }
      } finally {
        if (!cancelled) setLoadingRemote(false);
      }
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, query, scope, canSearchStudents, canSearchGroups, canSearchCenters]);

  const combinedResults = useMemo(
    () => [...filteredSections, ...remoteResults],
    [filteredSections, remoteResults]
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [combinedResults.length, query]);

  const handleSelect = (entry: SearchResultEntry) => {
    onOpenChange(false);
    router.push(entry.href);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (combinedResults.length > 0) {
        setActiveIndex((prev) => (prev + 1) % combinedResults.length);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (combinedResults.length > 0) {
        setActiveIndex((prev) => (prev - 1 + combinedResults.length) % combinedResults.length);
      }
    } else if (e.key === "Enter") {
      const target = combinedResults[activeIndex];
      if (target) {
        e.preventDefault();
        handleSelect(target);
      }
    }
  };

  const getIcon = (category: SearchResultEntry["category"]) => {
    if (category === "student") return <GraduationCap className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />;
    if (category === "group") return <Users className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />;
    if (category === "center") return <Building2 className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />;
    return <Compass className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />;
  };

  const categoryLabel = (category: SearchResultEntry["category"]) => {
    if (category === "student") return t(locale, "shell.studentsGroup");
    if (category === "group") return t(locale, "shell.groupsGroup");
    if (category === "center") return t(locale, "shell.centersGroup");
    return t(locale, "shell.sectionsGroup");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent locale={locale} className="p-0 overflow-hidden max-w-xl gap-0">
        <DialogHeader className="sr-only">
          <DialogTitle>{t(locale, "shell.commandPaletteTitle")}</DialogTitle>
          <DialogDescription>{t(locale, "shell.commandHint")}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border pr-12">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder={t(locale, "shell.commandPlaceholder")}
            aria-label={t(locale, "shell.commandPlaceholder")}
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>

        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {combinedResults.length === 0 && !loadingRemote ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {t(locale, "shell.noCommandResults")}
            </div>
          ) : (
            combinedResults.map((item, idx) => {
              const isSelected = idx === activeIndex;
              return (
                <button
                  key={`${item.category}-${item.id}`}
                  type="button"
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => handleSelect(item)}
                  className={`w-full min-h-[40px] px-3 py-2 rounded-md flex items-center gap-3 text-left transition-colors ${
                    isSelected
                      ? "bg-accent text-accent-foreground"
                      : "text-foreground hover:bg-muted"
                  }`}
                >
                  {getIcon(item.category)}
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium truncate">{item.label}</span>
                    {item.subtitle && (
                      <span className="block text-xs text-muted-foreground truncate">
                        {item.subtitle}
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {categoryLabel(item.category)}
                  </span>
                </button>
              );
            })
          )}
          {loadingRemote && (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              {t(locale, "common.loading")}
            </div>
          )}
        </div>

        <div className="px-3.5 py-2 border-t border-border bg-muted/40 text-xs text-muted-foreground flex items-center justify-between gap-2">
          <span>{t(locale, "shell.commandHint")}</span>
          <kbd className="px-1.5 py-0.5 rounded border border-border bg-card font-mono text-xs text-foreground">
            Ctrl+K
          </kbd>
        </div>
      </DialogContent>
    </Dialog>
  );
}

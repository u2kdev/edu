"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { t } from "@/i18n";
import {
  buildStudentsQuery,
  canManageStudents,
  parseSortValue,
  type CsvImportResult,
  type CsvPreviewData,
  type StudentItem,
} from "./students-utils";

/** Locale-independent fallback copy, owned by the public entry module. */
export interface StudentsMessages {
  networkError: string;
  createError: string;
  csvPreviewError: string;
  csvExecuteError: string;
}

export interface UseStudentsArgs {
  role: string;
  locale: string;
  messages: StudentsMessages;
}

export function useStudents({ role, locale, messages }: UseStudentsArgs) {
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters and pagination state
  const [search, setSearch] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);

  // Add form state
  const [addFullName, setAddFullName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addGroupId, setAddGroupId] = useState("");
  const [addWithInvite, setAddWithInvite] = useState(true);
  const [addLoading, setAddLoading] = useState(false);
  const [addCreatedCode, setAddCreatedCode] = useState<string | null>(null);

  // CSV modal state
  const [csvContent, setCsvContent] = useState("");
  const [csvPreviewData, setCsvPreviewData] = useState<CsvPreviewData | null>(null);
  const [csvLoading, setCsvLoading] = useState(false);
  const [csvResult, setCsvResult] = useState<CsvImportResult | null>(null);

  const canManage = canManageStudents(role);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = buildStudentsQuery({
        page,
        search,
        groupId: selectedGroup,
        status: selectedStatus,
        sortBy,
        sortOrder,
      });

      const res = await fetch(`/api/students?${params}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || t(locale, "students.errorLoading"));
      }

      setStudents(data.students || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotalCount(data.pagination?.totalCount || 0);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t(locale, "students.errorLoading");
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [page, search, selectedGroup, selectedStatus, sortBy, sortOrder, locale]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const updateSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };
  const updateGroup = (value: string) => {
    setSelectedGroup(value);
    setPage(1);
  };
  const updateStatus = (value: string) => {
    setSelectedStatus(value);
    setPage(1);
  };
  const updateSort = (value: string) => {
    const parsed = parseSortValue(value);
    setSortBy(parsed.sortBy);
    setSortOrder(parsed.sortOrder);
  };

  const goPrevPage = () => setPage((p) => Math.max(1, p - 1));
  const goNextPage = () => setPage((p) => Math.min(totalPages, p + 1));

  const resetAddForm = () => {
    setAddFullName("");
    setAddEmail("");
    setAddPhone("");
    setAddGroupId("");
  };

  const openAddModal = () => {
    setAddCreatedCode(null);
    setShowAddModal(true);
  };
  const closeAddModal = () => setShowAddModal(false);
  const closeAddModalAndReset = () => {
    setShowAddModal(false);
    setAddCreatedCode(null);
    resetAddForm();
  };

  const openCsvModal = () => {
    setCsvPreviewData(null);
    setCsvResult(null);
    setCsvContent("");
    setShowCsvModal(true);
  };
  const closeCsvModal = () => setShowCsvModal(false);

  const handleAddSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAddLoading(true);
    try {
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: addFullName,
          email: addEmail,
          phone: addPhone,
          groupId: addGroupId || undefined,
          withInvite: addWithInvite,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || messages.createError);
      } else {
        if (data.inviteCode) {
          setAddCreatedCode(data.inviteCode);
        } else {
          setShowAddModal(false);
          resetAddForm();
        }
        fetchStudents();
      }
    } catch {
      alert(messages.networkError);
    } finally {
      setAddLoading(false);
    }
  };

  const handleCsvPreview = async () => {
    if (!csvContent.trim()) return;
    setCsvLoading(true);
    try {
      const res = await fetch("/api/students/import-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvContent, mode: "preview" }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || messages.csvPreviewError);
      } else {
        setCsvPreviewData(data);
      }
    } catch {
      alert(messages.networkError);
    } finally {
      setCsvLoading(false);
    }
  };

  const handleCsvExecute = async () => {
    if (!csvContent.trim()) return;
    setCsvLoading(true);
    try {
      const res = await fetch("/api/students/import-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvContent, mode: "execute" }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || messages.csvExecuteError);
      } else {
        setCsvResult(data);
        fetchStudents();
      }
    } catch {
      alert(messages.networkError);
    } finally {
      setCsvLoading(false);
    }
  };

  return {
    students,
    loading,
    error,
    search,
    updateSearch,
    selectedGroup,
    updateGroup,
    selectedStatus,
    updateStatus,
    sortBy,
    sortOrder,
    updateSort,
    page,
    totalPages,
    totalCount,
    goPrevPage,
    goNextPage,
    canManage,
    fetchStudents,
    showAddModal,
    openAddModal,
    closeAddModal,
    closeAddModalAndReset,
    addFullName,
    setAddFullName,
    addEmail,
    setAddEmail,
    addPhone,
    setAddPhone,
    addGroupId,
    setAddGroupId,
    addWithInvite,
    setAddWithInvite,
    addLoading,
    addCreatedCode,
    handleAddSubmit,
    showCsvModal,
    openCsvModal,
    closeCsvModal,
    csvContent,
    setCsvContent,
    csvPreviewData,
    csvResult,
    csvLoading,
    handleCsvPreview,
    handleCsvExecute,
  };
}

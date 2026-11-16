"use client";

import type { FormEvent } from "react";
import { AlertTriangle } from "lucide-react";
import { t } from "@/i18n";
import {
  Alert,
  AlertDescription,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  FormActions,
  FormField,
  Input,
} from "@/components/ui";
import type { CourseOption, TeacherOption, AssistantOption } from "./groups-utils";

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-card px-3 py-1.5 text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background";

function PeriodPricingInputs({
  locale,
  price1 = "",
  onPrice1Change,
  price2 = "",
  onPrice2Change,
  price3 = "",
  onPrice3Change,
}: {
  locale: string;
  price1?: string;
  onPrice1Change?: (v: string) => void;
  price2?: string;
  onPrice2Change?: (v: string) => void;
  price3?: string;
  onPrice3Change?: (v: string) => void;
}) {
  if (!onPrice1Change) return null;
  const n1 = parseInt(price1 || "0", 10);
  const n2 = parseInt(price2 || "0", 10);
  const n3 = parseInt(price3 || "0", 10);
  const warn2 = n1 > 0 && n2 > n1 * 2;
  const warn3 = n1 > 0 && n3 > n1 * 3;

  return (
    <div className="space-y-2 border-t border-border pt-3">
      <div className="text-xs font-medium text-muted-foreground">
        {t(locale, "billing.pricingPlans")} (UZS)
      </div>
      <div className="grid grid-cols-3 gap-2">
        <FormField label={t(locale, "billing.period1")} htmlFor="group-price-1">
          <Input
            id="group-price-1"
            type="number"
            min="0"
            value={price1}
            onChange={(e) => onPrice1Change(e.target.value)}
            placeholder="500000"
          />
        </FormField>
        <FormField label={t(locale, "billing.period2")} htmlFor="group-price-2">
          <Input
            id="group-price-2"
            type="number"
            min="0"
            value={price2}
            onChange={(e) => onPrice2Change?.(e.target.value)}
            placeholder="950000"
          />
        </FormField>
        <FormField label={t(locale, "billing.period3")} htmlFor="group-price-3">
          <Input
            id="group-price-3"
            type="number"
            min="0"
            value={price3}
            onChange={(e) => onPrice3Change?.(e.target.value)}
            placeholder="1350000"
          />
        </FormField>
      </div>
      {warn2 && (
        <p className="flex items-center gap-1.5 text-xs text-warning">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{t(locale, "billing.priceWarningHigher", { months: "2", base: (n1 * 2).toLocaleString("ru-RU") })}</span>
        </p>
      )}
      {warn3 && (
        <p className="flex items-center gap-1.5 text-xs text-warning">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{t(locale, "billing.priceWarningHigher", { months: "3", base: (n1 * 3).toLocaleString("ru-RU") })}</span>
        </p>
      )}
    </div>
  );
}

interface CreateGroupModalProps {
  open: boolean;
  locale: string;
  courses: CourseOption[];
  teachers: TeacherOption[];
  assistants?: AssistantOption[];
  namePlaceholder: string;
  courseId: string;
  onCourseIdChange: (value: string) => void;
  name: string;
  onNameChange: (value: string) => void;
  teacherMembershipId: string;
  onTeacherMembershipIdChange: (value: string) => void;
  assistantMembershipId?: string;
  onAssistantMembershipIdChange?: (value: string) => void;
  maxStudents: string;
  onMaxStudentsChange: (value: string) => void;
  price1?: string;
  onPrice1Change?: (value: string) => void;
  price2?: string;
  onPrice2Change?: (value: string) => void;
  price3?: string;
  onPrice3Change?: (value: string) => void;
  loading: boolean;
  error?: string | null;
  onSubmit: (e: FormEvent) => void;
  onClose: () => void;
}

export function CreateGroupModal({
  open,
  locale,
  courses,
  teachers,
  assistants = [],
  namePlaceholder,
  courseId,
  onCourseIdChange,
  name,
  onNameChange,
  teacherMembershipId,
  onTeacherMembershipIdChange,
  assistantMembershipId = "",
  onAssistantMembershipIdChange,
  maxStudents,
  onMaxStudentsChange,
  price1,
  onPrice1Change,
  price2,
  onPrice2Change,
  price3,
  onPrice3Change,
  loading,
  error,
  onSubmit,
  onClose,
}: CreateGroupModalProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t(locale, "groups.createGroup")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <FormField label={t(locale, "groups.selectCourse")} htmlFor="create-group-course" required>
            <select
              id="create-group-course"
              required
              value={courseId}
              onChange={(e) => onCourseIdChange(e.target.value)}
              className={selectClassName}
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label={t(locale, "groups.groupName")} htmlFor="create-group-name" required>
            <Input
              id="create-group-name"
              type="text"
              required
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder={namePlaceholder}
            />
          </FormField>

          <FormField label={t(locale, "groups.assignTeacher")} htmlFor="create-group-teacher">
            <select
              id="create-group-teacher"
              value={teacherMembershipId}
              onChange={(e) => onTeacherMembershipIdChange(e.target.value)}
              className={selectClassName}
            >
              <option value="">{t(locale, "groups.noTeacher")}</option>
              {teachers.map((tr) => (
                <option key={tr.id} value={tr.id}>
                  {tr.user.fullName}
                </option>
              ))}
            </select>
          </FormField>

          {assistants.length > 0 && onAssistantMembershipIdChange && (
            <FormField
              label={locale === "uz-Latn" ? "Yordamchi oʻqituvchi" : "Ассистент преподавателя"}
              htmlFor="create-group-assistant"
            >
              <select
                id="create-group-assistant"
                value={assistantMembershipId}
                onChange={(e) => onAssistantMembershipIdChange(e.target.value)}
                className={selectClassName}
              >
                <option value="">{locale === "uz-Latn" ? "Yordamchisiz" : "Без ассистента"}</option>
                {assistants.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.user.fullName}
                  </option>
                ))}
              </select>
            </FormField>
          )}

          <FormField label={t(locale, "groups.maxStudents")} htmlFor="create-group-max" required>
            <Input
              id="create-group-max"
              type="number"
              min="1"
              max="200"
              required
              value={maxStudents}
              onChange={(e) => onMaxStudentsChange(e.target.value)}
            />
          </FormField>

          <PeriodPricingInputs
            locale={locale}
            price1={price1}
            onPrice1Change={onPrice1Change}
            price2={price2}
            onPrice2Change={onPrice2Change}
            price3={price3}
            onPrice3Change={onPrice3Change}
          />

          <FormActions>
            <Button type="button" variant="secondary" onClick={onClose}>
              {t(locale, "common.cancel")}
            </Button>
            <Button type="submit" variant="primary" disabled={loading} loading={loading}>
              {loading ? t(locale, "common.loading") : t(locale, "groups.createGroup")}
            </Button>
          </FormActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface EditGroupModalProps {
  open: boolean;
  locale: string;
  teachers: TeacherOption[];
  assistants?: AssistantOption[];
  name: string;
  onNameChange: (value: string) => void;
  teacherMembershipId: string;
  onTeacherMembershipIdChange: (value: string) => void;
  assistantMembershipId?: string;
  onAssistantMembershipIdChange?: (value: string) => void;
  maxStudents: string;
  onMaxStudentsChange: (value: string) => void;
  price1?: string;
  onPrice1Change?: (value: string) => void;
  price2?: string;
  onPrice2Change?: (value: string) => void;
  price3?: string;
  onPrice3Change?: (value: string) => void;
  loading: boolean;
  error?: string | null;
  onSubmit: (e: FormEvent) => void;
  onClose: () => void;
}

export function EditGroupModal({
  open,
  locale,
  teachers,
  assistants = [],
  name,
  onNameChange,
  teacherMembershipId,
  onTeacherMembershipIdChange,
  assistantMembershipId = "",
  onAssistantMembershipIdChange,
  maxStudents,
  onMaxStudentsChange,
  price1,
  onPrice1Change,
  price2,
  onPrice2Change,
  price3,
  onPrice3Change,
  loading,
  error,
  onSubmit,
  onClose,
}: EditGroupModalProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t(locale, "groups.editGroup")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <FormField label={t(locale, "groups.groupName")} htmlFor="edit-group-name" required>
            <Input
              id="edit-group-name"
              type="text"
              required
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
            />
          </FormField>

          <FormField label={t(locale, "groups.assignTeacher")} htmlFor="edit-group-teacher">
            <select
              id="edit-group-teacher"
              value={teacherMembershipId}
              onChange={(e) => onTeacherMembershipIdChange(e.target.value)}
              className={selectClassName}
            >
              <option value="">{t(locale, "groups.noTeacher")}</option>
              {teachers.map((tr) => (
                <option key={tr.id} value={tr.id}>
                  {tr.user.fullName}
                </option>
              ))}
            </select>
          </FormField>

          {onAssistantMembershipIdChange && assistants.length > 0 && (
            <FormField
              label={locale === "uz-Latn" ? "Yordamchi oʻqituvchi" : "Ассистент преподавателя"}
              htmlFor="edit-group-assistant"
            >
              <select
                id="edit-group-assistant"
                value={assistantMembershipId}
                onChange={(e) => onAssistantMembershipIdChange(e.target.value)}
                className={selectClassName}
              >
                <option value="">{locale === "uz-Latn" ? "Yordamchisiz" : "Без ассистента"}</option>
                {assistants.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.user.fullName}
                  </option>
                ))}
              </select>
            </FormField>
          )}

          <FormField label={t(locale, "groups.maxStudents")} htmlFor="edit-group-max" required>
            <Input
              id="edit-group-max"
              type="number"
              min="1"
              max="200"
              required
              value={maxStudents}
              onChange={(e) => onMaxStudentsChange(e.target.value)}
            />
          </FormField>

          <PeriodPricingInputs
            locale={locale}
            price1={price1}
            onPrice1Change={onPrice1Change}
            price2={price2}
            onPrice2Change={onPrice2Change}
            price3={price3}
            onPrice3Change={onPrice3Change}
          />

          <FormActions>
            <Button type="button" variant="secondary" onClick={onClose}>
              {t(locale, "common.cancel")}
            </Button>
            <Button type="submit" variant="primary" disabled={loading} loading={loading}>
              {loading ? t(locale, "common.loading") : t(locale, "common.save")}
            </Button>
          </FormActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}

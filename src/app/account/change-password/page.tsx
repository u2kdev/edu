"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, CheckCircle2, ShieldCheck, ArrowRight } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState("");
  const [successBanner, setSuccessBanner] = useState("");

  const hasMinLength = newPassword.length >= 8;
  const hasLower = /[a-z]/.test(newPassword);
  const hasUpper = /[A-Z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const isMatch = newPassword.length > 0 && newPassword === confirmPassword;

  const isFormValid = hasMinLength && hasLower && hasUpper && hasNumber && isMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    setErrorBanner("");
    setSuccessBanner("");
    setLoading(true);

    try {
      const res = await fetch("/api/account/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorBanner(data.error || "Не удалось изменить пароль");
        return;
      }

      setSuccessBanner("Пароль успешно обновлён! Перенаправление...");
      setTimeout(() => {
        router.push(data.redirectUrl || "/center");
        router.refresh();
      }, 1500);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : "Произошла ошибка при сохранении");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-accent border border-border text-primary flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <CardTitle>Смена пароля</CardTitle>
            <CardDescription>Установите постоянный надёжный пароль для учётной записи</CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <Alert variant="warning">
            Требуется сменить временный пароль перед началом работы в системе.
          </Alert>

          {errorBanner && <Alert variant="destructive">{errorBanner}</Alert>}
          {successBanner && <Alert variant="success">{successBanner}</Alert>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="cp-current">Текущий пароль</Label>
              <div className="relative">
                <Input
                  id="cp-current"
                  type={showCurrent ? "text" : "password"}
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  aria-label="Toggle current password visibility"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cp-new">Новый пароль</Label>
              <div className="relative">
                <Input
                  id="cp-new"
                  type={showNew ? "text" : "password"}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  aria-label="Toggle new password visibility"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cp-confirm">Подтверждение нового пароля</Label>
              <div className="relative">
                <Input
                  id="cp-confirm"
                  type={showConfirm ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  aria-label="Toggle confirm password visibility"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="p-3 rounded-lg border border-border bg-muted/40 space-y-1 text-xs">
              {[
                { ok: hasMinLength, label: "Минимум 8 символов" },
                { ok: hasLower, label: "Строчные буквы (a-z)" },
                { ok: hasUpper, label: "Заглавные буквы (A-Z)" },
                { ok: hasNumber, label: "Цифры (0-9)" },
                { ok: isMatch, label: "Пароли совпадают" },
              ].map((item) => (
                <div
                  key={item.label}
                  className={`flex items-center gap-2 ${
                    item.ok ? "text-success font-medium" : "text-muted-foreground"
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>{item.label}</span>
                </div>
              ))}
            </div>

            <Button
              type="submit"
              disabled={!isFormValid || loading}
              loading={loading}
              className="w-full min-h-[42px]"
            >
              <span>Сохранить новый пароль</span>
              {!loading && <ArrowRight className="w-4 h-4" aria-hidden="true" />}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

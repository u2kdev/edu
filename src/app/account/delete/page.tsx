"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle, ShieldAlert, KeyRound, ArrowLeft } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AccountDeletePage() {
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDeleted, setIsDeleted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setErrorMessage("Введите пароль для подтверждения удаления");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/auth/account/delete", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      const data: unknown = await res.json().catch(() => ({}));
      const typedData = data as { success?: boolean; error?: { message?: string; code?: string } };

      if (!res.ok) {
        if (typedData.error?.code === "SOLE_DIRECTOR_CONFLICT") {
          setErrorMessage(
            "Невозможно удалить аккаунт: вы являетесь единственным директором центра. Назначьте другого директора перед удалением."
          );
        } else {
          setErrorMessage(typedData.error?.message || "Ошибка при удалении аккаунта");
        }
        setIsSubmitting(false);
        return;
      }

      setIsDeleted(true);
      setTimeout(() => {
        window.location.href = "/login";
      }, 3000);
    } catch {
      setErrorMessage("Сетевая ошибка при обращении к серверу");
      setIsSubmitting(false);
    }
  };

  if (isDeleted) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center p-6 space-y-4">
          <CheckCircle className="w-12 h-12 text-success mx-auto" aria-hidden="true" />
          <h2 className="text-xl font-bold text-foreground">Аккаунт успешно удалён</h2>
          <p className="text-muted-foreground text-sm">
            Все персональные данные анонимизированы, а сессии отозваны. Вы будете перенаправлены на страницу входа.
          </p>
          <div className="pt-2">
            <Link
              href="/login"
              className="inline-flex items-center justify-center px-5 py-2.5 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-sm font-medium"
            >
              Войти
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto py-4">
      <Card>
        <CardHeader className="space-y-3">
          <Link
            href="/account?tab=profile"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-fit"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Назад в профиль</span>
          </Link>

          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-destructive-subtle border border-destructive/30 rounded-lg">
              <ShieldAlert className="w-6 h-6 text-destructive" aria-hidden="true" />
            </div>
            <div>
              <CardTitle>Удаление учётной записи</CardTitle>
              <CardDescription>Необратимое действие</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="p-4 bg-muted/50 rounded-lg border border-border space-y-2.5 text-xs text-muted-foreground">
            <div className="flex items-start gap-2 text-warning">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span className="font-semibold text-foreground">Что произойдёт после удаления:</span>
            </div>
            <ul className="list-disc list-inside space-y-1.5">
              <li>Ваше имя, email и номер телефона будут полностью анонимизированы.</li>
              <li>Все активные сессии на сайте и в мобильном приложении будут немедленно закрыты.</li>
              <li>Родительские связи с учащимися будут расторгнуты.</li>
              <li>
                Академические записи (оценки и посещаемость) сохраняются в центрах в обезличенном виде для отчётности.
              </li>
              <li>
                Если вы единственный директор учебного центра, сначала передайте роль директора другому сотруднику.
              </li>
            </ul>
          </div>

          {errorMessage && <Alert variant="destructive">{errorMessage}</Alert>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="delete-account-pw">Для подтверждения введите ваш текущий пароль</Label>
              <div className="relative">
                <KeyRound
                  className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2"
                  aria-hidden="true"
                />
                <Input
                  id="delete-account-pw"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ваш пароль"
                  required
                  className="pl-9"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Link
                href="/account?tab=profile"
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Отмена
              </Link>
              <Button
                type="submit"
                variant="destructive"
                disabled={isSubmitting || !password}
                loading={isSubmitting}
                className="min-h-[40px]"
              >
                {isSubmitting ? "Удаление..." : "Удалить мой аккаунт"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

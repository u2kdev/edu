"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertOctagon, HelpCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function CenterError({
  error,
  reset,
}: {
  error: Error & { digest?: string; code?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Center page error caught by error boundary:", error);
  }, [error]);

  const isSuspended =
    error.message?.includes("Tenant suspended") ||
    error.message?.includes("CENTER_SUSPENDED") ||
    (error as { code?: string })?.code === "CENTER_SUSPENDED";

  if (isSuspended) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center p-6">
        <Card className="w-full max-w-xl border-destructive/30">
          <CardContent className="space-y-5 p-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-destructive-subtle text-destructive">
              <AlertOctagon className="h-7 w-7" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">
                Доступ к центру приостановлен
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Действие учебного центра временно заблокировано или истек срок действия подписки.
              </p>
            </div>
            <div className="flex flex-col items-center justify-center gap-3 pt-2 sm:flex-row">
              <Link href="/center/suspended" className="w-full sm:w-auto">
                <Button type="button" className="w-full sm:w-auto">
                  Подробнее о статусе
                </Button>
              </Link>
              <Link href="/center/support" className="w-full sm:w-auto">
                <Button type="button" variant="outline" className="w-full sm:w-auto">
                  <HelpCircle className="h-4 w-4" aria-hidden="true" />
                  <span>Поддержка</span>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-6">
      <Card className="w-full max-w-lg">
        <CardContent className="space-y-5 p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-warning-subtle text-warning">
            <AlertOctagon className="h-7 w-7" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">Произошла ошибка</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {error.message || "Не удалось загрузить раздел. Попробуйте обновить страницу."}
            </p>
          </div>
          <Button type="button" onClick={() => reset()}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            <span>Попробовать снова</span>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

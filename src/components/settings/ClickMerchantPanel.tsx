"use client";

import { useState, useEffect, useCallback } from "react";
import { ShieldCheck, Lock, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { StatusDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { t } from "@/i18n";

const SELECT_CLS =
  "flex h-9 w-full rounded-md border border-input bg-card px-3 py-1.5 text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50";

interface MerchantConfigDTO {
  configured: boolean;
  provider: string;
  serviceId: string | null;
  merchantId: string | null;
  merchantUserId: string | null;
  secretKeyMasked: string | null;
  targetAccountId: string | null;
  targetAccount: { id: string; name: string; type: string } | null;
  isActive: boolean;
  isVerified: boolean;
  lastTestedAt: string | null;
  lastError: string | null;
}

interface AccountOption {
  id: string;
  name: string;
  type: string;
}

interface ClickMerchantPanelProps {
  locale: string;
  isDirector: boolean;
  isImpersonating: boolean;
}

export function ClickMerchantPanel({
  locale,
  isDirector,
  isImpersonating,
}: ClickMerchantPanelProps) {
  const isUz = locale === "uz-Latn";
  const canEditCredentials = isDirector && !isImpersonating;

  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<MerchantConfigDTO | null>(null);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);

  const [serviceId, setServiceId] = useState("");
  const [merchantId, setMerchantId] = useState("");
  const [merchantUserId, setMerchantUserId] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [targetAccountId, setTargetAccountId] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [currentPassword, setCurrentPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/center/merchant-config");
      const data = await res.json();
      if (res.ok && data.config) {
        const cfg = data.config as MerchantConfigDTO;
        setConfig(cfg);
        setAccounts(data.accounts || []);
        setServiceId(cfg.serviceId || "");
        setMerchantId(cfg.merchantId || "");
        setMerchantUserId(cfg.merchantUserId || "");
        setTargetAccountId(cfg.targetAccountId || "");
        setIsActive(cfg.isActive);
      }
    } catch {
      // Ignore transient error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditCredentials) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/center/merchant-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: serviceId.trim(),
          merchantId: merchantId.trim(),
          merchantUserId: merchantUserId.trim() || null,
          secretKey: secretKey.trim() || null,
          targetAccountId: targetAccountId || null,
          isActive,
          currentPassword,
          totpCode: totpCode.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "err", text: data.error || "Ошибка сохранения" });
        return;
      }
      setConfig(data.config);
      setSecretKey("");
      setCurrentPassword("");
      setTotpCode("");
      setMessage({
        type: "ok",
        text: isUz
          ? "Sozlamalar saqlandi. Endi ulanishni tekshiring."
          : "Настройки сохранены. Нажмите «Проверить подключение» для активации.",
      });
    } catch {
      setMessage({ type: "err", text: isUz ? "Tarmoq xatoligi" : "Ошибка сети" });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!canEditCredentials) return;
    setTesting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/center/merchant-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({
          type: "err",
          text: data.error || "Проверка не пройдена",
        });
        await loadConfig();
        return;
      }
      setConfig(data.config);
      setMessage({
        type: "ok",
        text: isUz
          ? "Click ulanishi muvaffaqiyatli tasdiqlandi"
          : "Подключение Click успешно проверено и активировано",
      });
    } catch {
      setMessage({ type: "err", text: isUz ? "Tarmoq xatoligi" : "Ошибка сети" });
    } finally {
      setTesting(false);
    }
  };

  const verifiedActive = Boolean(config?.isVerified && config.isActive);

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" aria-hidden="true" />
            <span>{t(locale, "click.merchantSettings")}</span>
          </CardTitle>
          <CardDescription>
            {isUz
              ? "To'lovlar to'g'ridan-to'g'ri markazingiz Click merchant hisobiga tushadi."
              : "Деньги зачисляются напрямую на мерчант-аккаунт вашего центра в Click без комиссии платформы."}
          </CardDescription>
        </div>

        <StatusDot
          tone={verifiedActive ? "success" : "warning"}
          label={
            verifiedActive ? t(locale, "click.verified") : t(locale, "click.notVerified")
          }
        />
      </CardHeader>

      <CardContent className="space-y-4">
        {isImpersonating && (
          <Alert variant="warning">
            <AlertDescription className="flex items-center gap-2">
              <Lock className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{t(locale, "click.impersonationBlocked")}</span>
            </AlertDescription>
          </Alert>
        )}

        {!isDirector && !isImpersonating && (
          <Alert variant="neutral">
            <AlertDescription className="flex items-center gap-2">
              <Lock className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>
                {isUz
                  ? "Click kalitlarini faqat Markaz direktori o'zgartira oladi"
                  : "Редактировать ключи мерчанта может только директор учебного центра"}
              </span>
            </AlertDescription>
          </Alert>
        )}

        {message && (
          <Alert variant={message.type === "ok" ? "success" : "destructive"}>
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <form onSubmit={(e) => void handleSave(e)} className="space-y-4 text-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="click-service-id">
                  {t(locale, "click.serviceId")}
                </Label>
                <Input
                  id="click-service-id"
                  type="text"
                  required
                  disabled={!canEditCredentials}
                  value={serviceId}
                  onChange={(e) => setServiceId(e.target.value)}
                  placeholder="12345"
                  className="font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="click-merchant-id">
                  {t(locale, "click.merchantId")}
                </Label>
                <Input
                  id="click-merchant-id"
                  type="text"
                  required
                  disabled={!canEditCredentials}
                  value={merchantId}
                  onChange={(e) => setMerchantId(e.target.value)}
                  placeholder="67890"
                  className="font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="click-merchant-user-id">
                  {t(locale, "click.merchantUserId")}
                </Label>
                <Input
                  id="click-merchant-user-id"
                  type="text"
                  disabled={!canEditCredentials}
                  value={merchantUserId}
                  onChange={(e) => setMerchantUserId(e.target.value)}
                  placeholder="12345"
                  className="font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="click-default-account">
                  {t(locale, "click.defaultAccount")}
                </Label>
                <select
                  id="click-default-account"
                  disabled={!canEditCredentials}
                  value={targetAccountId}
                  onChange={(e) => setTargetAccountId(e.target.value)}
                  className={SELECT_CLS}
                >
                  <option value="">
                    {isUz
                      ? "Avtomatik (Asosiy bank/karta hisobi)"
                      : "Автовыбор (Банк / Карта по умолчанию)"}
                  </option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.type})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {canEditCredentials && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-border">
                <div className="space-y-1.5">
                  <Label htmlFor="click-secret-key">
                    {t(locale, "click.secretKey")}{" "}
                    {config?.secretKeyMasked ? `(${config.secretKeyMasked})` : ""}
                  </Label>
                  <Input
                    id="click-secret-key"
                    type="password"
                    value={secretKey}
                    onChange={(e) => setSecretKey(e.target.value)}
                    placeholder={
                      config?.configured
                        ? "•••••• (оставьте пустым чтобы не менять)"
                        : "Secret Key"
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="click-confirm-pw">
                    {t(locale, "click.confirmPassword")} *
                  </Label>
                  <Input
                    id="click-confirm-pw"
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="click-totp">{t(locale, "click.totpCode")}</Label>
                  <Input
                    id="click-totp"
                    type="text"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                    placeholder="123456"
                    className="font-mono"
                  />
                </div>
              </div>
            )}

            {canEditCredentials && (
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="h-4 w-4 rounded border-input accent-primary"
                  />
                  <span>
                    {isUz
                      ? "Onlayn to'lov yoqilgan"
                      : "Приём онлайн-оплат активен"}
                  </span>
                </label>

                <div className="flex items-center gap-2">
                  {config?.configured && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={testing}
                      onClick={() => void handleTest()}
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${testing ? "animate-spin" : ""}`}
                        aria-hidden="true"
                      />
                      <span>{t(locale, "click.testConnection")}</span>
                    </Button>
                  )}
                  <Button type="submit" size="sm" loading={saving}>
                    {isUz ? "Kalitlarni saqlash" : "Сохранить ключи"}
                  </Button>
                </div>
              </div>
            )}
          </form>
        )}
      </CardContent>
    </Card>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { CheckCircle2, Copy, KeyRound, MonitorSmartphone, ShieldCheck, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateLocalized, t } from "@/i18n";

interface SessionItem {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  lastSeenAt: string;
  isCurrent: boolean;
}

interface SecurityTabPanelProps {
  initialTwoFactorEnabled: boolean;
  locale: string;
  isReadOnly: boolean;
}

export function SecurityTabPanel({
  initialTwoFactorEnabled,
  locale,
  isReadOnly,
}: SecurityTabPanelProps) {
  // 1. Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwNotice, setPwNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const hasMinLength = newPassword.length >= 8;
  const hasLower = /[a-z]/.test(newPassword);
  const hasUpper = /[A-Z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const isMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const isPwValid = hasMinLength && hasLower && hasUpper && hasNumber && isMatch;

  // 2. 2FA state
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(initialTwoFactorEnabled);
  const [setupData, setSetupData] = useState<{ secret: string; uri: string; qrDataUrl: string } | null>(null);
  const [twoFactorPassword, setTwoFactorPassword] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);
  const [twoFactorNotice, setTwoFactorNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [codesCopied, setCodesCopied] = useState(false);

  // 3. Sessions state
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState("");
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);
  const [revokeAllOpen, setRevokeAllOpen] = useState(false);

  const fetchSessions = useCallback(async () => {
    setSessionsLoading(true);
    setSessionsError("");
    try {
      const res = await fetch("/api/auth/sessions");
      const data = await res.json();
      if (res.ok && Array.isArray(data.sessions)) {
        setSessions(data.sessions);
      } else {
        setSessionsError(t(locale, data.error?.message || "common.error"));
      }
    } catch {
      setSessionsError(t(locale, "common.error"));
    } finally {
      setSessionsLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    void fetchSessions();
  }, [fetchSessions]);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPwValid || isReadOnly) return;
    setPwSaving(true);
    setPwNotice(null);
    try {
      const res = await fetch("/api/account/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || t(locale, "common.error"));
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPwNotice({ type: "success", text: t(locale, "account.passwordUpdated") });
    } catch (err) {
      setPwNotice({
        type: "error",
        text: err instanceof Error ? err.message : t(locale, "common.error"),
      });
    } finally {
      setPwSaving(false);
    }
  };

  const handleStart2FASetup = async () => {
    if (isReadOnly) return;
    setTwoFactorLoading(true);
    setTwoFactorNotice(null);
    try {
      const res = await fetch("/api/auth/2fa?action=setup");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t(locale, "common.error"));
      if (data.enabled) {
        setTwoFactorEnabled(true);
        return;
      }
      const qrDataUrl = data.uri ? await QRCode.toDataURL(data.uri, { width: 180, margin: 1 }) : "";
      setSetupData({ secret: data.secret, uri: data.uri, qrDataUrl });
    } catch (err) {
      setTwoFactorNotice({
        type: "error",
        text: err instanceof Error ? err.message : t(locale, "common.error"),
      });
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const handleEnable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly || !setupData) return;
    setTwoFactorLoading(true);
    setTwoFactorNotice(null);
    try {
      const res = await fetch("/api/auth/2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: twoFactorPassword,
          code: twoFactorCode.trim(),
          secret: setupData.secret,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t(locale, "common.error"));
      setTwoFactorEnabled(true);
      setSetupData(null);
      setTwoFactorPassword("");
      setTwoFactorCode("");
      setBackupCodes(Array.isArray(data.backupCodes) ? data.backupCodes : null);
      setTwoFactorNotice({ type: "success", text: t(locale, "account.twoFactorEnabled") });
    } catch (err) {
      setTwoFactorNotice({
        type: "error",
        text: err instanceof Error ? err.message : t(locale, "common.error"),
      });
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const handleDisable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    setTwoFactorLoading(true);
    setTwoFactorNotice(null);
    try {
      const res = await fetch("/api/auth/2fa", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: twoFactorPassword,
          ...(twoFactorCode.trim() ? { code: twoFactorCode.trim() } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t(locale, "common.error"));
      setTwoFactorEnabled(false);
      setBackupCodes(null);
      setTwoFactorPassword("");
      setTwoFactorCode("");
      setTwoFactorNotice({ type: "success", text: t(locale, "account.twoFactorDisabled") });
    } catch (err) {
      setTwoFactorNotice({
        type: "error",
        text: err instanceof Error ? err.message : t(locale, "common.error"),
      });
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const handleRevokeSession = async (id: string) => {
    if (isReadOnly) return;
    setRevokingId(id);
    try {
      const res = await fetch(`/api/auth/sessions?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== id));
      } else {
        const data = await res.json();
        setSessionsError(t(locale, data.error?.message || "common.error"));
      }
    } catch {
      setSessionsError(t(locale, "common.error"));
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeAll = () => {
    if (isReadOnly) return;
    setRevokeAllOpen(true);
  };

  const handleConfirmRevokeAll = async () => {
    if (isReadOnly) return;
    setRevokingAll(true);
    try {
      const res = await fetch("/api/auth/sessions?allButCurrent=true", { method: "DELETE" });
      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.isCurrent));
        setRevokeAllOpen(false);
      } else {
        const data = await res.json();
        setSessionsError(t(locale, data.error?.message || "common.error"));
        setRevokeAllOpen(false);
      }
    } catch {
      setSessionsError(t(locale, "common.error"));
      setRevokeAllOpen(false);
    } finally {
      setRevokingAll(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Password section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-primary" aria-hidden="true" />
            <span>{t(locale, "account.passwordSectionTitle")}</span>
          </CardTitle>
          <CardDescription>{t(locale, "account.passwordSectionDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          {pwNotice && (
            <div className="mb-4">
              <Alert variant={pwNotice.type === "success" ? "success" : "destructive"}>
                {pwNotice.text}
              </Alert>
            </div>
          )}
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="sec-cur-pw">{t(locale, "auth.currentPassword")}</Label>
                <Input
                  id="sec-cur-pw"
                  type="password"
                  required
                  disabled={isReadOnly}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sec-new-pw">{t(locale, "auth.newPassword")}</Label>
                <Input
                  id="sec-new-pw"
                  type="password"
                  required
                  disabled={isReadOnly}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sec-conf-pw">{t(locale, "account.passwordConfirm")}</Label>
                <Input
                  id="sec-conf-pw"
                  type="password"
                  required
                  disabled={isReadOnly}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 rounded-lg border border-border bg-muted/40 text-xs">
              {[
                { ok: hasMinLength, text: t(locale, "account.passwordMin8") },
                { ok: hasLower, text: t(locale, "account.passwordLower") },
                { ok: hasUpper, text: t(locale, "account.passwordUpper") },
                { ok: hasNumber, text: t(locale, "account.passwordNumber") },
              ].map((rule) => (
                <div
                  key={rule.text}
                  className={`flex items-center gap-1.5 ${
                    rule.ok ? "text-success font-medium" : "text-muted-foreground"
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>{rule.text}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={!isPwValid || pwSaving || isReadOnly}
                loading={pwSaving}
                className="min-h-[40px]"
              >
                {t(locale, "auth.changePassword")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* 2FA section */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" aria-hidden="true" />
              <span>{t(locale, "account.twoFactorTitle")}</span>
            </CardTitle>
            <CardDescription>{t(locale, "account.twoFactorDesc")}</CardDescription>
          </div>
          <Badge variant={twoFactorEnabled ? "success" : "neutral"}>
            {twoFactorEnabled
              ? t(locale, "account.twoFactorEnabled")
              : t(locale, "account.twoFactorDisabled")}
          </Badge>
        </CardHeader>

        <CardContent className="space-y-4">
          {twoFactorNotice && (
            <Alert variant={twoFactorNotice.type === "success" ? "success" : "destructive"}>
              {twoFactorNotice.text}
            </Alert>
          )}

          {backupCodes && backupCodes.length > 0 && (
            <div className="p-4 rounded-lg border border-warning/40 bg-warning-subtle space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-warning-subtle-foreground">
                  {t(locale, "account.twoFactorBackupCodes")}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard?.writeText(backupCodes.join("\n"));
                    setCodesCopied(true);
                  }}
                >
                  <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>
                    {codesCopied
                      ? t(locale, "account.twoFactorCopied")
                      : t(locale, "account.twoFactorCopyCodes")}
                  </span>
                </Button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 font-mono text-xs">
                {backupCodes.map((code) => (
                  <div
                    key={code}
                    className="px-2.5 py-1.5 rounded border border-border bg-card text-foreground text-center"
                  >
                    {code}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!twoFactorEnabled && !setupData && (
            <Button
              type="button"
              variant="secondary"
              disabled={twoFactorLoading || isReadOnly}
              loading={twoFactorLoading}
              onClick={handleStart2FASetup}
              className="min-h-[40px]"
            >
              {t(locale, "account.twoFactorSetupStart")}
            </Button>
          )}

          {!twoFactorEnabled && setupData && (
            <form
              onSubmit={handleEnable2FA}
              className="p-4 rounded-lg border border-border bg-muted/40 space-y-4"
            >
              <div className="flex flex-col sm:flex-row items-center gap-4">
                {setupData.qrDataUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={setupData.qrDataUrl}
                    alt="2FA QR Code"
                    className="w-36 h-36 rounded-lg border border-border bg-card p-1.5 shrink-0"
                  />
                )}
                <div className="space-y-1.5 min-w-0 w-full">
                  <div className="text-xs font-medium text-muted-foreground">
                    {t(locale, "account.twoFactorManualKey")}
                  </div>
                  <div className="font-mono text-xs p-2.5 rounded border border-border bg-card text-foreground break-all">
                    {setupData.secret}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="tfa-enable-pw">{t(locale, "account.twoFactorCurrentPassword")}</Label>
                  <Input
                    id="tfa-enable-pw"
                    type="password"
                    required
                    value={twoFactorPassword}
                    onChange={(e) => setTwoFactorPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tfa-enable-code">{t(locale, "account.twoFactorTotpCode")}</Label>
                  <Input
                    id="tfa-enable-code"
                    inputMode="numeric"
                    maxLength={9}
                    required
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setSetupData(null)}>
                  {t(locale, "common.cancel")}
                </Button>
                <Button type="submit" loading={twoFactorLoading} className="min-h-[40px]">
                  {t(locale, "account.twoFactorEnable")}
                </Button>
              </div>
            </form>
          )}

          {twoFactorEnabled && (
            <form
              onSubmit={handleDisable2FA}
              className="p-4 rounded-lg border border-border bg-muted/40 space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="tfa-dis-pw">{t(locale, "account.twoFactorCurrentPassword")}</Label>
                  <Input
                    id="tfa-dis-pw"
                    type="password"
                    required
                    disabled={isReadOnly}
                    value={twoFactorPassword}
                    onChange={(e) => setTwoFactorPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tfa-dis-code">{t(locale, "account.twoFactorTotpCode")}</Label>
                  <Input
                    id="tfa-dis-code"
                    inputMode="numeric"
                    maxLength={9}
                    disabled={isReadOnly}
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={twoFactorLoading || isReadOnly}
                  loading={twoFactorLoading}
                  className="min-h-[40px]"
                >
                  {t(locale, "account.twoFactorDisable")}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Active Sessions section */}
      <Card id="sessions">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MonitorSmartphone className="w-4 h-4 text-primary" aria-hidden="true" />
              <span>{t(locale, "account.sessionsTitle")}</span>
            </CardTitle>
            <CardDescription>{t(locale, "account.sessionsDesc")}</CardDescription>
          </div>
          {sessions.length > 1 && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={revokingAll || isReadOnly}
              loading={revokingAll}
              onClick={handleRevokeAll}
              className="min-h-[40px]"
            >
              {t(locale, "profile.revokeAll")}
            </Button>
          )}
        </CardHeader>

        <CardContent>
          {sessionsError && (
            <div className="mb-4">
              <Alert variant="destructive">{sessionsError}</Alert>
            </div>
          )}

          {sessionsLoading ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {t(locale, "common.loading")}
            </div>
          ) : sessions.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {t(locale, "profile.noDevices")}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className={`p-4 rounded-lg border flex flex-col justify-between gap-3 ${
                    s.isCurrent ? "border-primary/40 bg-accent/40" : "border-border bg-card"
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm text-foreground truncate" title={s.userAgent || "Unknown Device"}>
                        {s.userAgent || "Unknown Device"}
                      </span>
                      {s.isCurrent && (
                        <Badge variant="info">{t(locale, "profile.currentDevice")}</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground space-y-0.5 tabular-nums">
                      <div>IP: {s.ipAddress || "N/A"}</div>
                      <div>
                        {t(locale, "profile.lastSeen")}: {formatDateLocalized(s.lastSeenAt, locale)}
                      </div>
                      <div>
                        {t(locale, "profile.loginDate")}: {formatDateLocalized(s.createdAt, locale)}
                      </div>
                    </div>
                  </div>

                  {!s.isCurrent && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={revokingId === s.id || isReadOnly}
                      loading={revokingId === s.id}
                      onClick={() => handleRevokeSession(s.id)}
                      className="min-h-[36px] text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{t(locale, "profile.revokeSession")}</span>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={revokeAllOpen}
        onOpenChange={setRevokeAllOpen}
        locale={locale}
        variant="destructive"
        loading={revokingAll}
        title={t(locale, "profile.revokeAll")}
        description={t(locale, "profile.confirmRevokeAll")}
        confirmLabel={t(locale, "profile.revokeAll")}
        onConfirm={handleConfirmRevokeAll}
      />
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  CreditCard,
  ExternalLink,
  Link2Off,
  Lock,
  Save,
  Send,
  Users,
} from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t, formatDateLocalized } from "@/i18n";

export interface ProfileTabData {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  username: string | null;
  avatarUrl: string | null;
  preferredLanguage: string;
  createdAt: string;
  role: string;
  canEditFullName: boolean;
  twoFactorEnabled: boolean;
}

interface ProfileTabPanelProps {
  profile: ProfileTabData;
  locale: string;
  isReadOnly: boolean;
  studentEnrollments?: Array<{ id: string; status: string; groupName: string }>;
  parentChildren?: Array<{ id: string; fullName: string }>;
  onAvatarSaved?: (avatarUrl: string | null) => void;
}

export function ProfileTabPanel({
  profile,
  locale,
  isReadOnly,
  studentEnrollments = [],
  parentChildren = [],
  onAvatarSaved,
}: ProfileTabPanelProps) {
  const router = useRouter();
  const [fullName, setFullName] = useState(profile.fullName);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl || "");
  const [phone, setPhone] = useState(profile.phone || "");
  const [phoneConfirmOpen, setPhoneConfirmOpen] = useState(false);
  const [confirmationCode, setConfirmationCode] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Telegram integration state
  const [tgLoading, setTgLoading] = useState(false);
  const [tgLinked, setTgLinked] = useState(false);
  const [tgAccount, setTgAccount] = useState<{
    username: string | null;
    firstName: string | null;
    isBlocked: boolean;
  } | null>(null);
  const [tgBotUsername, setTgBotUsername] = useState<string | null>(null);
  const [tgLinkPayload, setTgLinkPayload] = useState<{
    token: string;
    deepLink: string | null;
    qrDataUrl: string | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/account/telegram")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setTgLinked(Boolean(data.linked));
        setTgAccount(data.account || null);
        setTgBotUsername(data.botUsername || null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const handleAvatarUpload = async (file: File | null) => {
    if (!file || isReadOnly) return;
    setUploadingAvatar(true);
    setNotice(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", "AVATAR");
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t(locale, "common.error"));
      setAvatarUrl(data.fileUrl);
      onAvatarSaved?.(data.fileUrl);
      setNotice({ type: "success", text: t(locale, "account.avatarUploadedNotice") });
    } catch (err) {
      setNotice({
        type: "error",
        text: err instanceof Error ? err.message : t(locale, "common.error"),
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const submitProfileUpdate = async () => {
    if (isReadOnly) return;
    setSavingProfile(true);
    setNotice(null);
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(profile.canEditFullName ? { fullName } : {}),
          avatarUrl: avatarUrl || null,
          phone: phone.trim() || null,
          phoneConfirmationCode: confirmationCode || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t(locale, "common.error"));
      setPhoneConfirmOpen(false);
      setConfirmationCode("");
      setNotice({ type: "success", text: t(locale, "account.profileSaved") });
      router.refresh();
    } catch (err) {
      setNotice({
        type: "error",
        text: err instanceof Error ? err.message : t(locale, "common.error"),
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    const phoneChanged = (phone.trim() || "") !== (profile.phone || "");
    if (phoneChanged && phone.trim() !== "" && !phoneConfirmOpen) {
      setPhoneConfirmOpen(true);
      return;
    }
    await submitProfileUpdate();
  };

  const handleGenerateTelegram = async () => {
    if (isReadOnly) return;
    setTgLoading(true);
    setNotice(null);
    try {
      const res = await fetch("/api/account/telegram", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t(locale, "common.error"));
      setTgLinkPayload({
        token: data.token,
        deepLink: data.deepLink || null,
        qrDataUrl: data.qrDataUrl || null,
      });
    } catch (err) {
      setNotice({
        type: "error",
        text: err instanceof Error ? err.message : t(locale, "common.error"),
      });
    } finally {
      setTgLoading(false);
    }
  };

  const handleUnlinkTelegram = async () => {
    if (isReadOnly) return;
    setTgLoading(true);
    setNotice(null);
    try {
      const res = await fetch("/api/account/telegram", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t(locale, "common.error"));
      setTgLinked(false);
      setTgAccount(null);
      setTgLinkPayload(null);
    } catch (err) {
      setNotice({
        type: "error",
        text: err instanceof Error ? err.message : t(locale, "common.error"),
      });
    } finally {
      setTgLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {notice && (
        <Alert variant={notice.type === "success" ? "success" : "destructive"}>
          {notice.text}
        </Alert>
      )}

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <Avatar src={avatarUrl || null} name={fullName || profile.fullName} size="lg" />
            <div className="min-w-0">
              <CardTitle className="truncate">{fullName || profile.fullName}</CardTitle>
              <CardDescription className="truncate">
                {profile.email} · {t(locale, "account.joinedAt")}:{" "}
                {formatDateLocalized(profile.createdAt, locale)}
              </CardDescription>
            </div>
          </div>

          <label
            className={`inline-flex items-center justify-center gap-2 min-h-[40px] px-3.5 py-2 rounded-lg border border-border bg-secondary text-secondary-foreground text-sm font-medium transition-colors shrink-0 ${
              isReadOnly ? "opacity-50 cursor-not-allowed" : "hover:bg-muted cursor-pointer"
            }`}
          >
            <Camera className="w-4 h-4 text-primary" aria-hidden="true" />
            <span>
              {uploadingAvatar ? t(locale, "account.uploadingAvatar") : t(locale, "account.changeAvatar")}
            </span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              disabled={uploadingAvatar || isReadOnly}
              onChange={(e) => {
                handleAvatarUpload(e.target.files?.[0] || null);
                e.target.value = "";
              }}
              className="sr-only"
            />
          </label>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="acc-full-name">{t(locale, "account.fullName")}</Label>
                  {!profile.canEditFullName && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Lock className="w-3 h-3" aria-hidden="true" />
                      <span>{t(locale, "account.fullNameLocked")}</span>
                    </span>
                  )}
                </div>
                <Input
                  id="acc-full-name"
                  value={fullName}
                  disabled={!profile.canEditFullName || isReadOnly}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="acc-email">{t(locale, "account.email")}</Label>
                <Input id="acc-email" value={profile.email} disabled />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="acc-phone">{t(locale, "account.phone")}</Label>
                <Input
                  id="acc-phone"
                  type="tel"
                  value={phone}
                  disabled={isReadOnly}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t(locale, "account.phonePlaceholder")}
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                disabled={savingProfile || uploadingAvatar || isReadOnly}
                loading={savingProfile}
                className="min-h-[40px]"
              >
                <Save className="w-4 h-4" aria-hidden="true" />
                <span>{t(locale, "account.saveProfile")}</span>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Telegram integration card */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Send className="w-4 h-4 text-primary" aria-hidden="true" />
              <span>{t(locale, "account.telegramTitle")}</span>
            </CardTitle>
            <CardDescription>{t(locale, "account.telegramDesc")}</CardDescription>
          </div>
          {tgLinked && tgAccount ? (
            <Button
              type="button"
              variant="outline"
              disabled={tgLoading || isReadOnly}
              onClick={handleUnlinkTelegram}
              className="min-h-[40px]"
            >
              <Link2Off className="w-4 h-4 text-destructive" aria-hidden="true" />
              <span>{t(locale, "account.telegramDisconnect")}</span>
            </Button>
          ) : (
            <Button
              type="button"
              variant="secondary"
              disabled={tgLoading || isReadOnly}
              loading={tgLoading}
              onClick={handleGenerateTelegram}
              className="min-h-[40px]"
            >
              <Send className="w-4 h-4" aria-hidden="true" />
              <span>{t(locale, "account.telegramConnect")}</span>
            </Button>
          )}
        </CardHeader>

        {(tgLinked || tgLinkPayload) && (
          <CardContent className="space-y-3">
            {tgLinked && tgAccount && (
              <div className="p-3.5 rounded-lg bg-success-subtle border border-success/30 text-sm text-success-subtle-foreground flex flex-wrap items-center justify-between gap-2">
                <span>
                  <strong>{t(locale, "account.telegramLinkedAs")}</strong>{" "}
                  {tgAccount.username ? `@${tgAccount.username}` : tgAccount.firstName || "Telegram"}
                </span>
                {tgAccount.isBlocked && (
                  <Badge variant="destructive">{t(locale, "account.telegramBlocked")}</Badge>
                )}
              </div>
            )}

            {tgLinkPayload && !tgLinked && (
              <div className="p-4 rounded-lg bg-muted/50 border border-border flex flex-col sm:flex-row items-center gap-4">
                {tgLinkPayload.qrDataUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={tgLinkPayload.qrDataUrl}
                    alt="Telegram QR"
                    className="w-32 h-32 rounded-lg border border-border bg-card p-1.5 shrink-0"
                  />
                )}
                <div className="space-y-2 text-sm text-foreground">
                  <p className="text-muted-foreground">{t(locale, "account.telegramScanQr")}</p>
                  {tgLinkPayload.deepLink && (
                    <a
                      href={tgLinkPayload.deepLink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary-hover"
                    >
                      <span>{tgBotUsername ? `@${tgBotUsername}` : "Telegram Bot"}</span>
                      <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                    </a>
                  )}
                  <div className="font-mono text-xs bg-card px-3 py-1.5 rounded border border-border text-foreground">
                    /start {tgLinkPayload.token}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Student groups summary */}
      {profile.role === "STUDENT" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-primary" aria-hidden="true" />
              <span>{t(locale, "account.myGroups")}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {studentEnrollments.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t(locale, "account.noGroups")}</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {studentEnrollments.map((en) => (
                  <div
                    key={en.id}
                    className="p-3 rounded-lg border border-border bg-muted/40 flex items-center justify-between gap-2"
                  >
                    <span className="font-medium text-sm text-foreground">{en.groupName}</span>
                    <Badge variant="success">{en.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Parent children summary */}
      {profile.role === "PARENT" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" aria-hidden="true" />
              <span>{t(locale, "account.myChildren")}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {parentChildren.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t(locale, "account.noChildren")}</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {parentChildren.map((child) => (
                  <div
                    key={child.id}
                    className="p-3 rounded-lg border border-border bg-muted/40 flex items-center justify-between gap-2"
                  >
                    <span className="font-medium text-sm text-foreground">{child.fullName}</span>
                    <Badge variant="neutral">{t(locale, "roles.STUDENT")}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Phone confirmation modal */}
      <Dialog open={phoneConfirmOpen} onOpenChange={setPhoneConfirmOpen}>
        <DialogContent locale={locale}>
          <DialogHeader>
            <DialogTitle>{t(locale, "account.phoneConfirmTitle")}</DialogTitle>
            <DialogDescription>
              {t(locale, "account.phoneConfirmDesc", { phone })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="acc-phone-code">{t(locale, "account.phoneConfirmCode")}</Label>
            <Input
              id="acc-phone-code"
              value={confirmationCode}
              onChange={(e) => setConfirmationCode(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPhoneConfirmOpen(false)}
              className="min-h-[40px]"
            >
              {t(locale, "common.cancel")}
            </Button>
            <Button
              type="button"
              loading={savingProfile}
              onClick={submitProfileUpdate}
              className="min-h-[40px]"
            >
              {t(locale, "common.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

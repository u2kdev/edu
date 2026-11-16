"use client";

import { useEffect, useState } from "react";
import { Check, ShieldAlert } from "lucide-react";
import {
  Badge,
  Card,
  PageHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";

interface PlatformOwnerItem {
  id: string;
  email: string;
  fullName: string;
  platformRole: string;
  isActive: boolean;
  createdAt: string;
}

export default function PlatformOwnersPage() {
  const [owners, setOwners] = useState<PlatformOwnerItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/developer/platform-owners")
      .then((res) => res.json())
      .then((json) => setOwners(json.owners || []))
      .catch(() => setOwners([]))
      .finally(() => setLoading(false));
  }, []);

  const roleBadgeVariant = (role: string) => {
    if (role === "DEVELOPER") return "info" as const;
    if (role === "SUPERADMIN") return "destructive" as const;
    return "neutral" as const;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Administrators"
        description="Global system administrators and developers (Read-only)"
      />

      <Card>
        <div className="overflow-x-auto" tabIndex={0}>
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted/60">
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    Fetching administrators...
                  </TableCell>
                </TableRow>
              ) : (
                owners.map((owner) => (
                  <TableRow key={owner.id}>
                    <TableCell className="font-mono text-xs text-primary">{owner.email}</TableCell>
                    <TableCell className="font-medium text-foreground">{owner.fullName}</TableCell>
                    <TableCell>
                      <Badge variant={roleBadgeVariant(owner.platformRole)}>
                        {owner.platformRole}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {owner.isActive ? (
                        <Badge variant="success">
                          <Check className="h-3 w-3" aria-hidden="true" />
                          <span>ACTIVE</span>
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <ShieldAlert className="h-3 w-3" aria-hidden="true" />
                          <span>SUSPENDED</span>
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground tabular-nums">
                      {new Date(owner.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      System Managed
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

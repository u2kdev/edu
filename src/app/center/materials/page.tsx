import { requireTenantPageAccess } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { checkStorageQuota } from "@/lib/storage";
import {
  getScopedMaterialWhere,
  getActorAcademicScope,
  isActorImpersonating,
} from "@/lib/tenant-access";
import MaterialsManager from "@/components/materials/MaterialsManager";

export default async function CenterMaterialsPage() {
  const tenantCtx = await requireTenantPageAccess();
  const { center, role, session, getTenantDb } = tenantCtx;
  const tenantDb = getTenantDb();

  const canManage =
    !isActorImpersonating(tenantCtx) &&
    (hasPermission("materials.upload", session.user.platformRole, role) ||
      hasPermission("materials.manage", session.user.platformRole, role) ||
      role === "TEACHER" ||
      role === "TEACHER_ASSISTANT");

  const [scopedMaterialWhere, academicScope, quota] = await Promise.all([
    getScopedMaterialWhere(tenantCtx),
    getActorAcademicScope(tenantCtx),
    checkStorageQuota(center.id),
  ]);

  const [materials, courses, groups] = await Promise.all([
    tenantDb.material.findMany({
      where: scopedMaterialWhere,
      include: {
        course: { select: { id: true, title: true } },
        group: { select: { id: true, name: true } },
        lesson: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    tenantDb.course.findMany({
      where: academicScope.isUnrestricted
        ? { centerId: center.id }
        : {
            centerId: center.id,
            id: {
              in:
                academicScope.courseIds.length > 0
                  ? academicScope.courseIds
                  : ["00000000-0000-0000-0000-000000000000"],
            },
          },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
    tenantDb.group.findMany({
      where: academicScope.isUnrestricted
        ? { centerId: center.id }
        : {
            centerId: center.id,
            id: {
              in:
                academicScope.groupIds.length > 0
                  ? academicScope.groupIds
                  : ["00000000-0000-0000-0000-000000000000"],
            },
          },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <MaterialsManager
      initialMaterials={materials.map((m) => ({
        id: m.id,
        title: m.title,
        materialType: m.materialType,
        fileUrl: m.fileUrl,
        externalUrl: m.externalUrl,
        contentText: m.contentText,
        fileSizeBytes: m.fileSizeBytes,
        durationMinutes: m.durationMinutes,
        createdAt: m.createdAt.toISOString(),
        course: m.course,
        group: m.group,
        lesson: m.lesson,
      }))}
      initialQuota={{
        usedBytes: quota.usedBytes,
        maxBytes: quota.maxBytes,
        percent: quota.percent,
        usedMb: Math.round((quota.usedBytes / (1024 * 1024)) * 100) / 100,
        maxMb: Math.round(quota.maxBytes / (1024 * 1024)),
      }}
      canManage={canManage}
      courses={courses}
      groups={groups}
    />
  );
}

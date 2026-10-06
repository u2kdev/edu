import { describe, it, expect, beforeAll } from "vitest";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

describe("Migrations", () => {
  let db: any;

  beforeAll(() => {
    // Create an in-memory DB or temporary file
    db = new Database(":memory:");
  });

  it("Applies init and phase3_auth, inserts user, applies phase3_fixes, verifies emailVerified backfill", () => {
    const migrationsDir = path.join(process.cwd(), "prisma/migrations");
    const m0 = fs.readFileSync(path.join(migrationsDir, "0_init/migration.sql"), "utf-8");
    const m1 = fs.readFileSync(path.join(migrationsDir, "20261005122700_phase3_auth/migration.sql"), "utf-8");
    const m2 = fs.readFileSync(path.join(migrationsDir, "20261005152002_phase3_fixes/migration.sql"), "utf-8");

    // Apply init and auth
    db.exec(m0);
    db.exec(m1);

    // Insert user without emailVerified
    const insertStmt = db.prepare(`INSERT INTO "PlatformUser" (id, email, passwordHash, fullName, isActive, preferredLanguage, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    insertStmt.run("user-1", "test@test.com", "hash", "Test", 1, "ru", new Date().toISOString(), new Date().toISOString());

    const beforeUser = db.prepare(`SELECT * FROM "PlatformUser" WHERE id = 'user-1'`).get();
    expect(beforeUser.emailVerified).toBeNull();

    // Apply phase3_fixes
    db.exec(m2);

    // Insert InviteCode before phase3_harden
    db.prepare(`INSERT INTO "LearningCenter" (id, ownerId, name, slug, status, createdAt, updatedAt) VALUES ('center-1', 'user-1', 'Test', 'slug', 'ACTIVE', '2026-01-01', '2026-01-01')`).run();
    db.prepare(`INSERT INTO "CenterMembership" (id, centerId, userId, role, status, createdAt, updatedAt) VALUES ('mem-1', 'center-1', 'user-1', 'DIRECTOR', 'ACTIVE', '2026-01-01', '2026-01-01')`).run();
    db.prepare(`INSERT INTO "InviteCode" (id, centerId, createdByMembershipId, code, targetRole, maxUses, usesCount, expiresAt, createdAt, updatedAt) VALUES ('inv-1', 'center-1', 'mem-1', 'TESTCODE', 'STUDENT', 5, 1, null, '2026-01-01', '2026-01-01')`).run();

    const m3 = fs.readFileSync(path.join(migrationsDir, "20261006071614_phase3_harden/migration.sql"), "utf-8");
    db.exec(m3);

    const afterUser = db.prepare(`SELECT * FROM "PlatformUser" WHERE id = 'user-1'`).get();
    expect(afterUser.emailVerified).not.toBeNull();

    const afterInvite = db.prepare(`SELECT * FROM "InviteCode" WHERE id = 'inv-1'`).get();
    expect(afterInvite.code).toBe('TESTCODE');
    expect(afterInvite.maxUses).toBe(5);
  });
});

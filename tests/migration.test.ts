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

    // Insert 3 InviteCodes before phase3_harden
    db.prepare(`INSERT INTO "LearningCenter" (id, ownerId, name, slug, status, createdAt, updatedAt) VALUES ('center-1', 'user-1', 'Test', 'slug', 'ACTIVE', '2026-01-01', '2026-01-01')`).run();
    db.prepare(`INSERT INTO "CenterMembership" (id, centerId, userId, role, status, createdAt, updatedAt) VALUES ('mem-1', 'center-1', 'user-1', 'DIRECTOR', 'ACTIVE', '2026-01-01', '2026-01-01')`).run();
    
    db.prepare(`INSERT INTO "InviteCode" (id, centerId, createdByMembershipId, code, targetRole, maxUses, usesCount, expiresAt, createdAt, updatedAt) VALUES ('inv-1', 'center-1', 'mem-1', 'CODE1', 'STUDENT', 5, 1, null, '2026-01-01', '2026-01-01')`).run();
    db.prepare(`INSERT INTO "InviteCode" (id, centerId, createdByMembershipId, code, targetRole, maxUses, usesCount, expiresAt, createdAt, updatedAt) VALUES ('inv-2', 'center-1', 'mem-1', 'CODE2', 'TEACHER', 20, 0, '2026-12-31', '2026-01-01', '2026-01-01')`).run();
    db.prepare(`INSERT INTO "InviteCode" (id, centerId, createdByMembershipId, code, targetRole, maxUses, usesCount, expiresAt, createdAt, updatedAt) VALUES ('inv-3', 'center-1', 'mem-1', 'CODE3', 'PARENT', 10, 10, '2025-01-01', '2026-01-01', '2026-01-01')`).run();

    const m3 = fs.readFileSync(path.join(migrationsDir, "20261006071614_phase3_harden/migration.sql"), "utf-8");
    db.exec(m3);

    const afterUser = db.prepare(`SELECT * FROM "PlatformUser" WHERE id = 'user-1'`).get();
    expect(afterUser.emailVerified).not.toBeNull();

    const afterInvites = db.prepare(`SELECT * FROM "InviteCode" ORDER BY id`).all() as any[];
    expect(afterInvites.length).toBe(3);
    
    expect(afterInvites[0].code).toBe('CODE1');
    expect(afterInvites[0].targetRole).toBe('STUDENT');
    expect(afterInvites[0].maxUses).toBe(5);
    
    expect(afterInvites[1].code).toBe('CODE2');
    expect(afterInvites[1].targetRole).toBe('TEACHER');
    expect(afterInvites[1].maxUses).toBe(20);
    
    expect(afterInvites[2].code).toBe('CODE3');
    expect(afterInvites[2].targetRole).toBe('PARENT');
    expect(afterInvites[2].maxUses).toBe(10);
    
    // Check foreign keys
    const fks = db.prepare(`PRAGMA foreign_key_list("InviteCode")`).all() as any[];
    expect(fks.some(fk => fk.table === 'LearningCenter' && fk.from === 'centerId' && fk.to === 'id')).toBe(true);
    expect(fks.some(fk => fk.table === 'CenterMembership' && fk.from === 'createdByMembershipId' && fk.to === 'id')).toBe(true);
    
    // Check indexes
    const indexes = db.prepare(`PRAGMA index_list("InviteCode")`).all() as any[];
    expect(indexes.some(idx => idx.unique === 1)).toBe(true); // There should be a unique index on 'code'
    
    // Check specific index on 'code'
    const codeIndex = indexes.find(idx => idx.unique === 1);
    const indexInfo = db.prepare(`PRAGMA index_info("${codeIndex.name}")`).all() as any[];
    expect(indexInfo[0].name).toBe('code');
  });
});

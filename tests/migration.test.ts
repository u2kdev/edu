import { describe, it, expect, beforeAll } from 'vitest';
import { db } from '../src/lib/db';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

describe('Migration Test: old centers are preserved', () => {
  it('should run migrations on a clean db, insert old data, migrate, and read correctly', async () => {
    const testDbPath = path.join(__dirname, '../prisma/mig_test.db');
    const env = { ...process.env, DATABASE_URL: `file:./mig_test.db` };

    // Clean up if exists
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    // 1. Move the new migration temporarily out of the way
    const migrationsDir = path.join(__dirname, '../prisma/migrations');
    const allMigrations = fs.readdirSync(migrationsDir);
    const newMigrationDir = allMigrations.find(m => m.includes('add_center_fields'));
    if (!newMigrationDir) throw new Error("New migration not found");
    
    const newMigrationPath = path.join(migrationsDir, newMigrationDir);
    const tempMigrationPath = path.join(__dirname, '../prisma/temp_migration');
    
    fs.renameSync(newMigrationPath, tempMigrationPath);

    const { PrismaClient } = require('@prisma/client');
    const migDb = new PrismaClient({ datasources: { db: { url: `file:./mig_test.db` } } });

    try {
      // 2. Deploy old migrations
      execSync('npx prisma migrate deploy', { env, stdio: 'pipe' });

      // 3. Insert raw SQL for the old center (it doesn't have phone, email, suspensionReason)
      const centerId = uuidv4();
      const ownerId = uuidv4();

      // We need a platform user first to satisfy foreign key
      await migDb.$executeRawUnsafe(`
        INSERT INTO "PlatformUser" ("id", "email", "passwordHash", "fullName", "updatedAt") 
        VALUES ('${ownerId}', 'mig-${Date.now()}@test.com', 'x', 'Test', CURRENT_TIMESTAMP)
      `);

      await migDb.$executeRawUnsafe(`
        INSERT INTO "LearningCenter" ("id", "slug", "name", "ownerId", "updatedAt") 
        VALUES ('${centerId}', 'mig-slug-${Date.now()}', 'Old Center', '${ownerId}', CURRENT_TIMESTAMP)
      `);

      // 4. Move migration back
      fs.renameSync(tempMigrationPath, newMigrationPath);

      // 5. Deploy the new migration
      execSync('npx prisma migrate deploy', { env, stdio: 'pipe' });

      // 6. Read with prisma client to ensure fields are null
      const center = await migDb.learningCenter.findUnique({ where: { id: centerId } });
      expect(center).toBeDefined();
      expect(center?.name).toBe('Old Center');
      expect(center?.suspensionReason).toBeNull();
      expect(center?.phone).toBeNull();
      expect(center?.email).toBeNull();
    } finally {
      // Cleanup
      await migDb.$disconnect();
      if (fs.existsSync(tempMigrationPath)) {
        fs.renameSync(tempMigrationPath, newMigrationPath);
      }
      if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
      }
    }
  }, 30000);
});

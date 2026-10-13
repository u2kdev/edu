import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { PrismaClient } from '@prisma/client';

describe('Migration Test: deploy on clean DB', () => {
  it('should run migrations on a clean db successfully', async () => {
    const baseDbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || "postgresql://postgres:admin@localhost:5432/lms_test?schema=public";
    const schemaName = `mig_test_${Date.now()}`;
    const urlObj = new URL(baseDbUrl);
    urlObj.searchParams.set("schema", schemaName);
    const isolatedUrl = urlObj.toString();
    const env = { ...process.env, DATABASE_URL: isolatedUrl, DIRECT_URL: isolatedUrl };

    // Deploy all migrations on a fresh schema
    execSync('node node_modules/prisma/build/index.js migrate deploy', { env, stdio: 'pipe' });

    const migDb = new PrismaClient({ datasources: { db: { url: isolatedUrl } } });

    try {
      // Insert raw data simulating old records if we wanted, 
      // but since we deploy all at once here, we just verify the schema accepts nulls.
      const centerId = uuidv4();
      const ownerId = uuidv4();

      await migDb.platformUser.create({
        data: {
          id: ownerId,
          email: `mig-${Date.now()}@test.com`,
          passwordHash: 'x',
          fullName: 'Test'
        }
      });

      // Insert without phone/email
      await migDb.$executeRawUnsafe(`
        INSERT INTO "LearningCenter" ("id", "slug", "name", "ownerId", "updatedAt") 
        VALUES ('${centerId}', 'mig-slug-${Date.now()}', 'Old Center', '${ownerId}', CURRENT_TIMESTAMP)
      `);

      const center = await migDb.learningCenter.findUnique({ where: { id: centerId } });
      expect(center).toBeDefined();
      expect(center?.name).toBe('Old Center');
      expect(center?.suspensionReason).toBeNull();
      expect(center?.phone).toBeNull();
      expect(center?.email).toBeNull();
    } finally {
      await migDb.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
      await migDb.$disconnect();
    }
  }, 30000);
});

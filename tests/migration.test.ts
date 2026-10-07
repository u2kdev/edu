import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { PrismaClient } from '@prisma/client';

describe('Migration Test: deploy on clean DB', () => {
  it('should run migrations on a clean db successfully', async () => {
    const testDbPath = path.join(__dirname, '../prisma/mig_test.db');
    const env = { ...process.env, DATABASE_URL: `file:./mig_test.db` };

    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    // Deploy all migrations on a fresh database
    execSync('npx prisma migrate deploy', { env, stdio: 'pipe' });

    const migDb = new PrismaClient({ datasources: { db: { url: `file:./mig_test.db` } } });

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
      await migDb.$disconnect();
      if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
      }
    }
  }, 30000);
});

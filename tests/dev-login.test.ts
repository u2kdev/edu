import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { POST } from '../src/app/api/auth/dev-login/route';
import { db } from '../src/lib/db';

describe('Dev Login API Env Protection', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalDevLogin = process.env.DEV_LOGIN;

  let testUserId = "";

  beforeAll(async () => {
    const user = await db.platformUser.create({
      data: { email: `devtest-${Date.now()}@x.com`, passwordHash: "x", fullName: "Dev Test" }
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    await db.userSession.deleteMany({ where: { userId: testUserId } });
    await db.platformUser.delete({ where: { id: testUserId } });
    if (originalEnv) vi.stubEnv('NODE_ENV', originalEnv); else vi.unstubAllEnvs();
    
  });

  const testCases = [
    { env: 'production', devLogin: 'true', expectAccess: false },
    { env: 'production', devLogin: 'false', expectAccess: false },
    { env: 'development', devLogin: 'false', expectAccess: false },
    { env: 'development', devLogin: 'true', expectAccess: true },
  ];

  describe('API: /api/auth/dev-login', () => {
    testCases.forEach(({ env, devLogin, expectAccess }) => {
      it(`env=${env}, DEV_LOGIN=${devLogin} -> ${expectAccess ? 'ALLOW' : '404'}`, async () => {
        vi.stubEnv('NODE_ENV', env);
        vi.stubEnv('DEV_LOGIN', devLogin);

        const req = new Request('http://localhost/api/auth/dev-login', {
          method: 'POST',
          body: JSON.stringify({ userId: testUserId })
        });
        const res = await POST(req);
        const data = await res.json();
        
        if (expectAccess) {
          expect(data.error).not.toBe('Not Found');
          expect(res.status).toBe(200);
        } else {
          expect(res.status).toBe(404);
          expect(data.error).toBe('Not Found');
        }
      });
    });
  });
});

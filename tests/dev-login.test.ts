import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { POST } from '../src/app/api/auth/dev-login/route';

describe('Dev Login API Env Protection', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalDevLogin = process.env.DEV_LOGIN;

  afterAll(() => {
    process.env.NODE_ENV = originalEnv;
    process.env.DEV_LOGIN = originalDevLogin;
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
        process.env.NODE_ENV = env as any;
        process.env.DEV_LOGIN = devLogin;

        const req = new Request('http://localhost/api/auth/dev-login', {
          method: 'POST',
          body: JSON.stringify({ userId: '123' })
        });
        const res = await POST(req);
        const data = await res.json();
        
        if (expectAccess) {
          // It should NOT be the env 404 error
          expect(data.error).not.toBe('Not Found');
        } else {
          expect(res.status).toBe(404);
          expect(data.error).toBe('Not Found');
        }
      });
    });
  });
});

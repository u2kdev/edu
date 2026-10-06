import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { POST } from '../src/app/api/auth/dev-login/route';

describe('Dev Login in Production', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalDevLogin = process.env.DEV_LOGIN;

  beforeAll(() => {
    process.env.NODE_ENV = 'production';
    process.env.DEV_LOGIN = 'true';
  });

  afterAll(() => {
    process.env.NODE_ENV = originalEnv;
    process.env.DEV_LOGIN = originalDevLogin;
  });

  it('should return 404 in production even if DEV_LOGIN=true', async () => {
    const req = new Request('http://localhost/api/auth/dev-login', {
      method: 'POST',
      body: JSON.stringify({ userId: '123' })
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });
});

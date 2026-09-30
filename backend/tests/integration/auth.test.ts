import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { useTestServer, registerUser } from '../helpers/testServer.js';

describe('auth integration', () => {
  const getApp = useTestServer();

  it('registers with normalized email and issues tokens', async () => {
    const response = await registerUser(request, getApp(), '  OWNER@Example.COM  ');

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user.email).toBe('owner@example.com');
    expect(response.body.data.tokens.accessToken).toEqual(expect.any(String));
    expect(response.body.data.tokens.refreshToken).toEqual(expect.any(String));
  });

  it('rejects duplicate email and incorrect credentials with stable codes', async () => {
    await registerUser(request, getApp(), 'owner@example.com');

    const duplicate = await registerUser(request, getApp(), 'OWNER@example.com');
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.code).toBe('EMAIL_ALREADY_REGISTERED');

    const wrongPassword = await request(getApp())
      .post('/api/v1/auth/login')
      .send({ email: 'owner@example.com', password: 'wrong-password' });
    expect(wrongPassword.status).toBe(401);
    expect(wrongPassword.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('protects /me and rotates refresh tokens', async () => {
    const registration = await registerUser(request, getApp(), 'owner@example.com');
    const { accessToken, refreshToken } = registration.body.data.tokens;

    const unauthenticated = await request(getApp()).get('/api/v1/auth/me');
    expect(unauthenticated.status).toBe(401);
    const invalidToken = await request(getApp())
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer invalid-token');
    expect(invalidToken.status).toBe(401);

    const currentUser = await request(getApp())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(currentUser.status).toBe(200);
    expect(currentUser.body.data.user.email).toBe('owner@example.com');

    const rotated = await request(getApp())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken });
    expect(rotated.status).toBe(200);
    expect(rotated.body.data.tokens.refreshToken).not.toBe(refreshToken);

    const reusedOldToken = await request(getApp())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken });
    expect(reusedOldToken.status).toBe(401);
    expect(reusedOldToken.body.code).toBe('TOKEN_INVALID');
  });

  it('updates analytics preferences through the dedicated endpoint', async () => {
    const registration = await registerUser(request, getApp(), 'prefs@example.com');
    const response = await request(getApp())
      .patch('/api/v1/auth/me/preferences')
      .set('Authorization', `Bearer ${registration.body.data.tokens.accessToken}`)
      .send({ analyticsOptOut: true });

    expect(response.status).toBe(200);
    expect(response.body.data.user.analyticsOptOut).toBe(true);
  });
});
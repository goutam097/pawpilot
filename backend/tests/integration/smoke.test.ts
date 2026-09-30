import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { useTestServer } from '../helpers/testServer.js';

describe('API route-group smoke tests', () => {
  const getApp = useTestServer();

  it('serves health and mounts each authenticated feature group', async () => {
    const app = getApp();
    const health = await request(app).get('/health');
    expect(health.status).toBe(200);
    expect(health.body.data.status).toBe('ok');

    const authenticatedGroups = [
      '/api/v1/pets',
      '/api/v1/devices',
      '/api/v1/places',
      '/api/v1/pets/000000000000000000000000/reminders',
      '/api/v1/pets/000000000000000000000000/vaccinations',
      '/api/v1/pets/000000000000000000000000/medications',
      '/api/v1/pets/000000000000000000000000/vet-visits',
      '/api/v1/pets/000000000000000000000000/weights',
      '/api/v1/pets/000000000000000000000000/expenses',
      '/api/v1/pets/000000000000000000000000/documents',
      '/api/v1/pets/000000000000000000000000/travel-plans',
      '/api/v1/pets/000000000000000000000000/timeline',
      '/api/v1/pets/000000000000000000000000/members',
      '/api/v1/pets/000000000000000000000000/invitations',
      '/api/v1/pets/000000000000000000000000/lost-report',
    ];

    const responses = await Promise.all(
      authenticatedGroups.map((path) => request(app).get(path)),
    );
    for (const response of responses) {
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('UNAUTHORIZED');
    }
  });
});
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach } from 'vitest';
import { createApp } from '../../src/app.js';

let mongo: MongoMemoryServer;
let app: ReturnType<typeof createApp>;

export function useTestServer() {
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    app = createApp();
  }, 60_000);

  beforeEach(async () => {
    const collections = await mongoose.connection.db?.collections();
    await Promise.all(collections?.map((collection) => collection.deleteMany({})) ?? []);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo?.stop();
  });

  return () => app;
}

export async function registerUser(
  client: typeof import('supertest').default,
  appInstance: ReturnType<typeof createApp>,
  email: string,
  name = 'Test User',
) {
  const response = await client(appInstance)
    .post('/api/v1/auth/register')
    .send({ email, password: 'correct-horse-battery-staple', name });

  return response;
}
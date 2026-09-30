/**
 * One-time migration: rename `ownerId` to `createdBy` on child records.
 *
 * Affected collections: reminders, vaccinations, medications, vetvisits,
 * weightrecords, expenses, documents, travelplans.
 *
 * Uses `$rename` for atomicity within each document.
 *
 * Run once after createFamilyMembersForExistingPets.ts and before deploying
 * the schema version that requires `createdBy`:
 *   npx tsx scripts/migrateOwnerIdToCreatedBy.ts
 *
 * Safe to re-run (idempotent): only documents without `createdBy` are
 * selected, so an existing creator is never overwritten.
 */
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';

const COLLECTIONS = [
  'reminders',
  'vaccinations',
  'medications',
  'vetvisits',
  'weightrecords',
  'expenses',
  'documents',
  'travelplans',
];

async function migrate(): Promise<void> {
  console.log(JSON.stringify({ level: 'info', msg: 'migration started', collections: COLLECTIONS }));
  await mongoose.connect(env.mongodbUri);

  try {
    const db = mongoose.connection.db;
    if (!db) throw new Error('No DB connection');

    for (const collection of COLLECTIONS) {
      const result = await db
        .collection(collection)
        .updateMany(
          { ownerId: { $exists: true }, createdBy: { $exists: false } },
          { $rename: { ownerId: 'createdBy' } },
        );
      console.log(
        JSON.stringify({
          level: 'info',
          msg: 'collection migrated',
          collection,
          matched: result.matchedCount,
          modified: result.modifiedCount,
        }),
      );
    }

    console.log(JSON.stringify({ level: 'info', msg: 'migration complete' }));
  } finally {
    await mongoose.disconnect();
  }
}

migrate().catch((err) => {
  console.error(JSON.stringify({ level: 'error', msg: 'migration failed', error: String(err) }));
  process.exit(1);
});
/**
 * One-time migration: create a FamilyMember (role: owner) for every existing
 * pet that doesn't already have one.
 *
 * Run once after deploying the FamilyMember model:
 *   npx tsx scripts/createFamilyMembersForExistingPets.ts
 */
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { PetModel } from '../src/models/Pet.js';
import { FamilyMemberModel } from '../src/models/FamilyMember.js';

async function migrate(): Promise<void> {
  console.log(JSON.stringify({ level: 'info', msg: 'backfilling FamilyMembers' }));
  await mongoose.connect(env.mongodbUri);

  try {
    const pets = await PetModel.find({}).select('_id ownerId').lean().exec();
    let created = 0;
    let skipped = 0;

    for (const pet of pets) {
      const existing = await FamilyMemberModel.findOne({
        petId: pet._id,
        userId: pet.ownerId,
      }).exec();

      if (existing) {
        skipped += 1;
        continue;
      }

      await FamilyMemberModel.create({
        petId: pet._id,
        userId: pet.ownerId,
        role: 'owner',
        invitedBy: null,
        joinedAt: (pet as { createdAt?: Date }).createdAt ?? new Date(),
      });
      created += 1;
    }

    console.log(
      JSON.stringify({ level: 'info', msg: 'backfill complete', created, skipped }),
    );
  } finally {
    await mongoose.disconnect();
  }
}

migrate().catch((err) => {
  console.error(JSON.stringify({ level: 'error', msg: 'backfill failed', error: String(err) }));
  process.exit(1);
});